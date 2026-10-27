// PORTIERE DEI VEICOLI (apertura/chiusura animata)
// ---------------------------------------------------------------------
function createDoors(bw, height, length, doorColor) {
  function makeDoor(sign) {
    const pivot = new THREE.Group();
    pivot.position.set(sign * (bw / 2), height * 0.62, length * 0.14);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, height * 0.62, length * 0.4),
      new THREE.MeshStandardMaterial({color: doorColor, metalness: 0.5, roughness: 0.35})
    );
    panel.position.set(0, 0, -length * 0.2);
    panel.castShadow = true;
    pivot.add(panel);
    return {pivot, current: 0, target: 0, openAngle: sign * -1.15};
  }
  return {left: makeDoor(-1), right: makeDoor(1)};
}

function openDoors(vehicle, side) {
  const doors = vehicle.userData.doors;
  if (!doors) return;
  if (side === 'left' || side === 'both') doors.left.target = doors.left.openAngle;
  if (side === 'right' || side === 'both') doors.right.target = doors.right.openAngle;
}

function closeDoors(vehicle) {
  const doors = vehicle.userData.doors;
  if (!doors) return;
  doors.left.target = 0;
  doors.right.target = 0;
}

function updateVehicleDoors(vehicle, dt) {
  const doors = vehicle.userData.doors;
  if (!doors) return;
  ['left', 'right'].forEach(side => {
    const d = doors[side];
    d.current += (d.target - d.current) * Math.min(1, dt * 7);
    d.pivot.rotation.y = d.current;
  });
}

function getNearSide(vehicle, worldPos) {
  const local = vehicle.worldToLocal(worldPos.clone());
  return local.x < 0 ? 'left' : 'right';
}

function addVehicleHeadlights(vehicle) {
  const bulbMaterial = new THREE.MeshBasicMaterial({color: 0xfff7cc});
  vehicle.userData.headlightBulbs = [];
  const bulbPositions = [[-0.7, 0.75, 2.15], [0.7, 0.75, 2.15]];
  bulbPositions.forEach(position => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), bulbMaterial.clone());
    bulb.position.set(position[0], position[1], position[2]);
    vehicle.add(bulb);
    vehicle.userData.headlightBulbs.push(bulb);
  });

  const beam = new THREE.SpotLight(0xfff0c2, 0, 26, Math.PI / 4, 0.85, 1.3);
  beam.position.set(0, 0.82, 2.05);
  beam.castShadow = false;
  const target = new THREE.Object3D();
  target.position.set(0, 0.1, 18);
  vehicle.add(beam, target);
  beam.target = target;
  vehicle.userData.headlight = beam;
}

// ---------------------------------------------------------------------
// VEICOLI (auto guidabili: quella del giocatore + quelle civili rubabili)
// ---------------------------------------------------------------------
function buildVehicle(colorHex) {
  const group = new THREE.Group();

  const bw = 2.2, bh = 0.9, bl = 4.4;
  const bodyMat = new THREE.MeshStandardMaterial({color: colorHex, metalness: 0.5, roughness: 0.35});
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), bodyMat);
  body.position.y = 0.75; body.castShadow = true;
  group.add(body);

  const cabinMat = new THREE.MeshStandardMaterial({color: 0x111318, metalness: 0.3, roughness: 0.2});
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), cabinMat);
  cabin.position.set(0, 1.35, -0.1); cabin.castShadow = true;
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 14);
  const wheelMat = new THREE.MeshStandardMaterial({color: 0x0a0a0a});
  const wheelPositions = [[-1.05, 0.42, 1.4], [1.05, 0.42, 1.4], [-1.05, 0.42, -1.4], [1.05, 0.42, -1.4]];
  group.userData.wheels = [];
  wheelPositions.forEach(p => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], p[1], p[2]);
    w.castShadow = true;
    group.add(w);
    group.userData.wheels.push(w);
  });

  // fari
  addVehicleHeadlights(group);

  // portiere
  const doors = createDoors(bw, bh, bl, new THREE.Color(colorHex).multiplyScalar(0.92).getHex());
  group.add(doors.left.pivot, doors.right.pivot);
  group.userData.doors = doors;

  group.userData.hasDriver = false;
  group.userData.driverMesh = null;

  // velocità residua da urto, usata dalla fisica delle collisioni fra veicoli
  group.userData.vx = 0;
  group.userData.vz = 0;

  // danno alla carrozzeria (0=integra, 100=distrutta): più è alto, più il veicolo va lento
  group.userData.speedMult = 1;        // moltiplicatore di velocità massima, scende del 10% ad ogni scontro con un altro veicolo
  group.userData.collisionCooldown = 0; // evita che un urto prolungato conti come tanti scontri di fila
  group.userData.isWrecked = false;
  group.userData.breakEffects = null;

  scene.add(group);
  return group;
}

function buildSupercar(colorHex) {
  const group = buildVehicle(colorHex);
  group.scale.set(0.94, 0.72, 1.25);
  group.userData.vehicleType = 'supercar';
  group.userData.isSupercar = true;
  group.userData.playerDrivable = true;
  group.userData.collisionRadius = 2.25;
  return group;
}

function createVehicleBreakEffects(vehicle) {
  const effects = new THREE.Group();
  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x555555,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });
  const sparkMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
  const smoke = [];
  const sparks = [];

  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35 + i * 0.08, 8, 8), smokeMaterial.clone());
    puff.position.set((i - 2) * 0.18, 1.15 + i * 0.18, 0.15);
    puff.userData.phase = i * 1.7;
    effects.add(puff);
    smoke.push(puff);
  }

  for (let i = 0; i < 6; i++) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), sparkMaterial);
    spark.position.set((Math.random() - 0.5) * 1.6, 0.8 + Math.random() * 0.5, 1.2);
    spark.rotation.set(Math.random(), Math.random(), Math.random());
    spark.userData.phase = i * 0.8;
    effects.add(spark);
    sparks.push(spark);
  }

  effects.userData.smoke = smoke;
  effects.userData.sparks = sparks;
  vehicle.add(effects);
  vehicle.userData.breakEffects = effects;
}

function breakVehicle(vehicle) {
  if (!vehicle || vehicle.userData.isWrecked) return;
  const driver = vehicle.userData.driverMesh;
  if (driver) ejectCivilianDriver(vehicle, driver);
  vehicle.userData.isWrecked = true;
  vehicle.userData.wreckedAt = clock.elapsedTime;
  vehicle.userData.speedMult = 0;
  vehicle.userData.hasDriver = false;
  vehicle.userData.driverMesh = null;
  createVehicleBreakEffects(vehicle);
  if (vehicle === car) {
    carSpeed = 0;
    aiming = false;
    mouseHeld = false;
    mode = 'foot';
    player.position.set(vehicle.position.x + 3.2, 0, vehicle.position.z);
    updatePlayerVisibility();
    document.getElementById('mode-badge').textContent = 'A PIEDI';
    showToast('AUTO DISTRUTTA: non e piu utilizzabile');
  }
}

function ejectCivilianDriver(vehicle, driver) {
  const worldPosition = new THREE.Vector3();
  driver.getWorldPosition(worldPosition);
  vehicle.remove(driver);
  worldPosition.x += Math.cos(vehicle.rotation.y) * 2.2;
  worldPosition.z -= Math.sin(vehicle.rotation.y) * 2.2;
  worldPosition.y = 0;
  driver.position.copy(worldPosition);
  driver.rotation.y = vehicle.rotation.y;
  scene.add(driver);
  pedestrians.push({
    mesh: driver,
    dir: vehicle.rotation.y,
    speed: 1.2 + Math.random() * 0.5,
    timer: 0,
    alive: true
  });
}

function removeDestroyedVehicles() {
  const now = clock.elapsedTime;
  const wreckLifetime = 5;

  for (let i = worldVehicles.length - 1; i >= 0; i--) {
    const vehicle = worldVehicles[i];
    if (!vehicle.userData.isWrecked || now - vehicle.userData.wreckedAt < wreckLifetime) continue;
    scene.remove(vehicle);
    worldVehicles.splice(i, 1);
  }

  for (let i = policeCars.length - 1; i >= 0; i--) {
    const unit = policeCars[i];
    const vehicle = unit.mesh;
    if (!vehicle.userData.isWrecked || now - vehicle.userData.wreckedAt < wreckLifetime) continue;
    removePoliceUnit(unit);
    policeCars.splice(i, 1);
  }
}

function updateVehicleDamageEffects(dt) {
  const updateEffects = vehicle => {
    const effects = vehicle.userData.breakEffects;
    if (!effects) return;
    const time = clock.elapsedTime;
    effects.userData.smoke.forEach((puff, index) => {
      puff.position.y += dt * (0.12 + index * 0.025);
      puff.position.x += Math.sin(time * 1.4 + puff.userData.phase) * dt * 0.08;
      puff.material.opacity = 0.12 + (Math.sin(time * 2 + puff.userData.phase) + 1) * 0.1;
      puff.scale.setScalar(0.85 + (Math.sin(time * 1.5 + index) + 1) * 0.18);
      if (puff.position.y > 2.5) puff.position.y = 1.15 + index * 0.18;
    });
    effects.userData.sparks.forEach((spark, index) => {
      spark.visible = Math.sin(time * 8 + spark.userData.phase) > 0.25;
      spark.rotation.x += dt * (4 + index);
      spark.rotation.z += dt * 3;
    });
  };
  worldVehicles.forEach(updateEffects);
  policeCars.forEach(unit => updateEffects(unit.mesh));
}

function buildClosedTruck(colorHex) {

  const group = new THREE.Group();

  // -------------------------------------------------------------------
  // MATERIALI
  // -------------------------------------------------------------------

  const bodyColor = new THREE.Color(colorHex);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: 0.45,
    roughness: 0.32
  });

  const bodyDarkMat = new THREE.MeshStandardMaterial({
    color: bodyColor.clone().multiplyScalar(0.72),
    metalness: 0.5,
    roughness: 0.38
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x11151b,
    metalness: 0.5,
    roughness: 0.32
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x08090b,
    metalness: 0.15,
    roughness: 0.65
  });

  const glassMat = new THREE.MeshBasicMaterial({
    color: 0xdfeaf7,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x242931,
    metalness: 0.65,
    roughness: 0.32
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x686b70,
    metalness: 0.9,
    roughness: 0.2
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    metalness: 0.05,
    roughness: 0.8
  });

  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x565960,
    metalness: 0.85,
    roughness: 0.25
  });

  const headlightMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c7
  });

  const redLightMat = new THREE.MeshBasicMaterial({
    color: 0xff2020
  });

  // -------------------------------------------------------------------
  // UTILITY
  // -------------------------------------------------------------------

  function box(geo, mat, x, y, z, parent = group) {

    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(x, y, z);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    parent.add(mesh);

    return mesh;
  }

  // -------------------------------------------------------------------
  // MOTRICE
  // -------------------------------------------------------------------

  const tractor = new THREE.Group();

  group.add(tractor);

  // -------------------------------------------------------------------
  // BASE / TELAIO CABINA
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(2.5, 0.55, 2.35),
    bodyDarkMat,
    0,
    1.25,
    -0.25,
    tractor
  );

  box(
    new THREE.BoxGeometry(2.5, 0.45, 1.0),
    bodyMat,
    0,
    1.7,
    0.45,
    tractor
  );

  box(
    new THREE.BoxGeometry(2.5, 0.45, 0.55),
    bodyMat,
    0,
    1.7,
    -1.1,
    tractor
  );

  // -------------------------------------------------------------------
  // STRUTTURA CABINA
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.28, 1.65, 0.42),
    bodyMat,
    -1.11,
    2.4,
    0.72,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.28, 1.65, 0.42),
    bodyMat,
    1.11,
    2.4,
    0.72,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.28, 1.65, 0.42),
    bodyMat,
    -1.11,
    2.4,
    -1.12,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.28, 1.65, 0.42),
    bodyMat,
    1.11,
    2.4,
    -1.12,
    tractor
  );

  box(
    new THREE.BoxGeometry(2.5, 0.42, 2.35),
    bodyMat,
    0,
    3.12,
    -0.2,
    tractor
  );

  box(
    new THREE.BoxGeometry(2.48, 0.18, 2.38),
    trimMat,
    0,
    3.38,
    -0.2,
    tractor
  );

  // -------------------------------------------------------------------
  // PARABREZZA
  // -------------------------------------------------------------------

  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.86),
    glassMat
  );

  windshield.position.set(
    0,
    2.48,
    0.94
  );

  windshield.rotation.x = -0.08;

  tractor.add(windshield);

  box(
    new THREE.BoxGeometry(1.95, 0.09, 0.14),
    trimMat,
    0,
    2.94,
    0.92,
    tractor
  );

  // -------------------------------------------------------------------
  // FINESTRINI LATERALI
  // -------------------------------------------------------------------

  const sideWindowLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.9),
    glassMat
  );

  sideWindowLeft.position.set(
    -1.255,
    2.45,
    -0.18
  );

  sideWindowLeft.rotation.y = Math.PI / 2;

  tractor.add(sideWindowLeft);

  const sideWindowRight = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.9),
    glassMat
  );

  sideWindowRight.position.set(
    1.255,
    2.45,
    -0.18
  );

  sideWindowRight.rotation.y = -Math.PI / 2;

  tractor.add(sideWindowRight);

  // -------------------------------------------------------------------
  // FINESTRINO POSTERIORE
  // -------------------------------------------------------------------

  const rearCabWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 0.72),
    glassMat
  );

  rearCabWindow.position.set(
    0,
    2.45,
    -1.34
  );

  rearCabWindow.rotation.y = Math.PI;

  tractor.add(rearCabWindow);

  // -------------------------------------------------------------------
  // CORNICI VETRI
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.1, 1.05, 0.12),
    trimMat,
    -1.25,
    2.43,
    0.72,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.1, 1.05, 0.12),
    trimMat,
    1.25,
    2.43,
    0.72,
    tractor
  );

  // -------------------------------------------------------------------
  // GRIGLIA
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(1.8, 0.78, 0.12),
    chromeMat,
    0,
    1.72,
    1.48,
    tractor
  );

  box(
    new THREE.BoxGeometry(1.5, 0.56, 0.08),
    blackMat,
    0,
    1.72,
    1.56,
    tractor
  );

  for (let i = -4; i <= 4; i++) {

    box(
      new THREE.BoxGeometry(0.045, 0.48, 0.04),
      chromeMat,
      i * 0.17,
      1.72,
      1.61,
      tractor
    );

  }

  box(
    new THREE.BoxGeometry(0.38, 0.16, 0.05),
    chromeMat,
    0,
    1.72,
    1.66,
    tractor
  );

  // -------------------------------------------------------------------
  // PARAURTI ANTERIORE
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(2.6, 0.3, 0.5),
    trimMat,
    0,
    0.92,
    1.55,
    tractor
  );

  box(
    new THREE.BoxGeometry(2.25, 0.1, 0.5),
    chromeMat,
    0,
    1.04,
    1.73,
    tractor
  );

  // -------------------------------------------------------------------
  // FARI ANTERIORI
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.52, 0.30, 0.10),
    headlightMat,
    -0.78,
    1.72,
    1.59,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.52, 0.30, 0.10),
    headlightMat,
    0.78,
    1.72,
    1.59,
    tractor
  );

  // FARI BASSI

  box(
    new THREE.BoxGeometry(0.24, 0.17, 0.10),
    headlightMat,
    -0.94,
    1.18,
    1.62,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.24, 0.17, 0.10),
    headlightMat,
    0.94,
    1.18,
    1.62,
    tractor
  );

  // -------------------------------------------------------------------
  // SPECCHI
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    trimMat,
    -1.43,
    2.48,
    0.65,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.2, 0.38, 0.14),
    blackMat,
    -1.57,
    2.6,
    0.68,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.12, 0.12, 0.7),
    trimMat,
    1.43,
    2.48,
    0.65,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.2, 0.38, 0.14),
    blackMat,
    1.57,
    2.6,
    0.68,
    tractor
  );

  // -------------------------------------------------------------------
  // PEDANE
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.3, 0.18, 1.55),
    trimMat,
    -1.30,
    0.98,
    -0.3,
    tractor
  );

  box(
    new THREE.BoxGeometry(0.3, 0.18, 1.55),
    trimMat,
    1.30,
    0.98,
    -0.3,
    tractor
  );

  // -------------------------------------------------------------------
  // SERBATOI
  // -------------------------------------------------------------------

  const tankLeft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 1.55, 16),
    chromeMat
  );

  tankLeft.rotation.z = Math.PI / 2;

  tankLeft.position.set(
    -1.30,
    0.92,
    -0.72
  );

  tankLeft.castShadow = true;

  tractor.add(tankLeft);

  const tankRight = tankLeft.clone();

  tankRight.position.x = 1.30;

  tractor.add(tankRight);

  // -------------------------------------------------------------------
  // COLLEGAMENTO MOTRICE-RIMORCHIO
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(1.35, 0.38, 1.35),
    darkMat,
    0,
    1.05,
    -1.55,
    group
  );

  const fifthWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
    chromeMat
  );

  fifthWheel.rotation.x = Math.PI / 2;

  fifthWheel.position.set(
    0,
    1.20,
    -1.70
  );

  fifthWheel.castShadow = true;

  group.add(fifthWheel);

  // -------------------------------------------------------------------
  // RIMORCHIO
  // -------------------------------------------------------------------

  const trailer = new THREE.Group();

  group.add(trailer);

  box(
    new THREE.BoxGeometry(2.45, 0.28, 6.8),
    darkMat,
    0,
    0.86,
    -5.05,
    trailer
  );

  box(
    new THREE.BoxGeometry(2.72, 2.45, 6.7),
    bodyMat,
    0,
    2.05,
    -5.0,
    trailer
  );

  box(
    new THREE.BoxGeometry(2.76, 0.32, 6.78),
    bodyDarkMat,
    0,
    0.95,
    -5.0,
    trailer
  );

  box(
    new THREE.BoxGeometry(2.8, 0.18, 6.85),
    trimMat,
    0,
    3.34,
    -5.0,
    trailer
  );

  // -------------------------------------------------------------------
  // FASCE LATERALI
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.06, 0.14, 6.45),
    chromeMat,
    -1.37,
    2.72,
    -5.0,
    trailer
  );

  box(
    new THREE.BoxGeometry(0.06, 0.14, 6.45),
    chromeMat,
    1.37,
    2.72,
    -5.0,
    trailer
  );

  // -------------------------------------------------------------------
  // PANNELLI LATERALI
  // -------------------------------------------------------------------

  for (let i = 0; i < 6; i++) {

    const z = -2.35 - i * 1.05;

    box(
      new THREE.BoxGeometry(0.045, 2.05, 0.035),
      trimMat,
      -1.385,
      2.0,
      z,
      trailer
    );

    box(
      new THREE.BoxGeometry(0.045, 2.05, 0.035),
      trimMat,
      1.385,
      2.0,
      z,
      trailer
    );

  }

  // -------------------------------------------------------------------
  // POSTERIORE RIMORCHIO
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(2.62, 2.35, 0.1),
    bodyDarkMat,
    0,
    2.05,
    -8.38,
    trailer
  );

  box(
    new THREE.BoxGeometry(1.27, 2.15, 0.08),
    bodyMat,
    -0.66,
    2.05,
    -8.45,
    trailer
  );

  box(
    new THREE.BoxGeometry(1.27, 2.15, 0.08),
    bodyMat,
    0.66,
    2.05,
    -8.45,
    trailer
  );

  box(
    new THREE.BoxGeometry(0.05, 2.05, 0.1),
    trimMat,
    0,
    2.05,
    -8.5,
    trailer
  );

  // -------------------------------------------------------------------
  // MANIGLIE
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.08, 0.42, 0.08),
    chromeMat,
    -0.1,
    2.0,
    -8.55,
    trailer
  );

  box(
    new THREE.BoxGeometry(0.08, 0.42, 0.08),
    chromeMat,
    0.1,
    2.0,
    -8.55,
    trailer
  );

  // -------------------------------------------------------------------
  // PARAURTI POSTERIORE
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(2.72, 0.25, 0.35),
    trimMat,
    0,
    0.72,
    -8.55,
    trailer
  );

  box(
    new THREE.BoxGeometry(2.35, 0.1, 0.25),
    chromeMat,
    0,
    0.82,
    -8.72,
    trailer
  );

  // -------------------------------------------------------------------
  // FANALI POSTERIORI
  // -------------------------------------------------------------------

  box(
    new THREE.BoxGeometry(0.25, 0.42, 0.08),
    redLightMat,
    -1.1,
    1.45,
    -8.58,
    trailer
  );

  box(
    new THREE.BoxGeometry(0.25, 0.42, 0.08),
    redLightMat,
    1.1,
    1.45,
    -8.58,
    trailer
  );

  // -------------------------------------------------------------------
  // RUOTE
  // -------------------------------------------------------------------

  const wheelGeo = new THREE.CylinderGeometry(
    0.55,
    0.55,
    0.46,
    18
  );

  const wheelPositions = [

    // Motrice
    [-1.35, 0.55, 0.72],
    [1.35, 0.55, 0.72],

    // Rimorchio
    [-1.37, 0.55, -4.45],
    [1.37, 0.55, -4.45],

    [-1.37, 0.55, -5.75],
    [1.37, 0.55, -5.75],

    [-1.37, 0.55, -7.0],
    [1.37, 0.55, -7.0]
  ];

  group.userData.wheels = [];

  wheelPositions.forEach(p => {

    const tire = new THREE.Mesh(
      wheelGeo,
      rubberMat
    );

    tire.rotation.z = Math.PI / 2;

    tire.position.set(
      p[0],
      p[1],
      p[2]
    );

    tire.castShadow = true;

    group.add(tire);

    group.userData.wheels.push(tire);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.22,
        0.22,
        0.48,
        12
      ),
      hubMat
    );

    hub.rotation.z = Math.PI / 2;

    hub.position.copy(tire.position);

    group.add(hub);

  });

  // -------------------------------------------------------------------
  // FARI DINAMICI
  // -------------------------------------------------------------------

  const truckHeadlightBulbMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c7
  });

  group.userData.headlightBulbs = [];

  const truckHeadlightPositions = [
    [-0.78, 1.72, 1.64],
    [0.78, 1.72, 1.64]
  ];

  truckHeadlightPositions.forEach(p => {

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 10),
      truckHeadlightBulbMat.clone()
    );

    bulb.position.set(
      p[0],
      p[1],
      p[2]
    );

    tractor.add(bulb);

    group.userData.headlightBulbs.push(bulb);

  });

  const truckBeam = new THREE.SpotLight(
    0xfff0c2,
    35,
    32,
    Math.PI / 5,
    0.75,
    1.2
  );

  truckBeam.position.set(
    0,
    1.72,
    1.66
  );

  const truckBeamTarget = new THREE.Object3D();

  truckBeamTarget.position.set(
    0,
    1.0,
    18
  );

  tractor.add(truckBeam);
  tractor.add(truckBeamTarget);

  truckBeam.target = truckBeamTarget;

  truckBeam.castShadow = false;

  group.userData.headlight = truckBeam;

  // -------------------------------------------------------------------
  // PORTIERE
  // -------------------------------------------------------------------

  const doors = createDoors(
    2.8,
    2.4,
    3.0,
    bodyDarkMat.color.getHex()
  );

  doors.left.pivot.position.set(
    -1.27,
    1.35,
    -0.15
  );

  doors.right.pivot.position.set(
    1.27,
    1.35,
    -0.15
  );

  group.add(
    doors.left.pivot,
    doors.right.pivot
  );

  group.userData.doors = doors;

  // -------------------------------------------------------------------
  // USER DATA
  // -------------------------------------------------------------------

  group.userData.hasDriver = false;
  group.userData.driverMesh = null;

  group.userData.vx = 0;
  group.userData.vz = 0;

  group.userData.speedMult = 1;
  group.userData.collisionCooldown = 0;

  group.userData.isWrecked = false;
  group.userData.breakEffects = null;

  group.userData.isClosedTruck = true;
  group.userData.isTruck = true;
  group.userData.playerDrivable = true;

  group.userData.vehicleType = 'closedTruck';

  group.userData.collisionRadius = 2.8;

  scene.add(group);

  return group;
}

function buildCar() {
  car = buildVehicle(0xdd2b2b);
  const spawn = findSafeVehiclePosition(car, attempt => {
    const angle = attempt * 0.7;
    const distance = attempt === 0 ? 0 : 4 + Math.floor(attempt / 8) * 2;
    return {x: CAR_SPAWN.x + Math.cos(angle) * distance, z: CAR_SPAWN.z + Math.sin(angle) * distance, rot: 0};
  }, 80);
  if (spawn) car.position.set(spawn.x, 0, spawn.z);
  car.position.y = 0;
  worldVehicles.push(car);
}

// ---------------------------------------------------------------------
// PLAYER (a piedi)
// ---------------------------------------------------------------------
function buildPlayer() {
  player = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color: 0x2255cc});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 10), bodyMat);
  body.position.y = 1.0; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), new THREE.MeshStandardMaterial({color: 0xffd9b3}));
  head.position.y = 1.85; head.castShadow = true;
  player.add(body, head);
  addHumanoidLimbs(player, bodyMat, 1.2);
  addSimpleFace(player, 1.85, 1.12);
  player.position.copy(PLAYER_HOME);
  scene.add(player);
  updatePlayerWeaponMesh();
}

function createPlayerWeaponMesh(weaponKey) {
  const weapon = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({color: 0x171717, metalness: 0.65, roughness: 0.35});
  const barrelMaterial = new THREE.MeshStandardMaterial({color: 0x050505, metalness: 0.8, roughness: 0.25});
  const specifications = {
    pistol: {body: [0.14, 0.18, 0.42], barrel: [0.08, 0.08, 0.24], barrelZ: 0.3, handle: [0.12, 0.28, 0.14]},
    smg: {body: [0.16, 0.2, 0.5], barrel: [0.07, 0.07, 0.34], barrelZ: 0.4, handle: [0.12, 0.3, 0.16]},
    rifle: {body: [0.16, 0.2, 0.7], barrel: [0.07, 0.07, 0.58], barrelZ: 0.62, handle: [0.13, 0.34, 0.18]},
    shotgun: {body: [0.18, 0.22, 0.58], barrel: [0.1, 0.1, 0.65], barrelZ: 0.6, handle: [0.14, 0.34, 0.2]}
  }[weaponKey] || null;
  if (!specifications) return weapon;

  const body = new THREE.Mesh(new THREE.BoxGeometry(...specifications.body), material);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(...specifications.barrel), barrelMaterial);
  barrel.position.z = specifications.barrelZ;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(...specifications.handle), material);
  handle.position.set(0, -0.18, -0.08);
  weapon.add(body, barrel, handle);
  if (weaponKey !== 'pistol') {
    const foreGrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), material);
    foreGrip.position.set(0, -0.1, specifications.barrelZ * 0.6);
    weapon.add(foreGrip);
    weapon.userData.foreGrip = foreGrip;
  }
  weapon.position.set(0, 0.18, 0.08);
  weapon.rotation.set(0, 0, 0);
  weapon.userData.weaponKey = weaponKey;
  return weapon;
}

function updatePlayerWeaponMesh() {
  if (!player) return;
  if (player.userData.weaponMesh && player.userData.weaponMesh.parent) {
    player.userData.weaponMesh.parent.remove(player.userData.weaponMesh);
  }
  player.userData.weaponMesh = createPlayerWeaponMesh(currentWeapon);
  const leftHand = player.userData.limbs && player.userData.limbs.leftHand;
  if (leftHand) {
    leftHand.add(player.userData.weaponMesh);
  } else {
    player.add(player.userData.weaponMesh);
  }
}

// ---------------------------------------------------------------------
// AUTO CIVILI RUBABILI
// ---------------------------------------------------------------------
function createCivilianDriverMesh() {
  const g = new THREE.Group();
  const colors = [0xffa500, 0x66cc66, 0xcc6699, 0xffffff, 0x999999, 0x00cccc];
  const mat = new THREE.MeshStandardMaterial({color: colors[Math.floor(Math.random() * colors.length)]});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 8), mat);
  body.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), new THREE.MeshStandardMaterial({color: 0xffd9b3}));
  head.position.y = 1.62;
  g.add(body, head);
  addHumanoidLimbs(g, mat, 1.1);
  g.userData.isCivilian = true;
  g.userData.seated = true;
  g.userData.limbs.leftLeg.visible = false;
  g.userData.limbs.rightLeg.visible = false;
  g.userData.limbs.leftArm.visible = false;
  g.userData.limbs.rightArm.visible = false;
  addSimpleFace(g, 1.62, 0.86);
  return g;
}

function randomParkingSpot() {
  const i = Math.floor(Math.random() * (BLOCKS + 1));
  const alongRoad = (Math.random() - 0.5) * BLOCKS * BLOCK_SIZE * 0.85;
  const pos = -CITY_HALF + i * BLOCK_SIZE;
  if (Math.random() < 0.5) {
    return {x: pos + ROAD_WIDTH * 0.28, z: alongRoad, rot: 0};
  } else {
    return {x: alongRoad, z: pos + ROAD_WIDTH * 0.28, rot: Math.PI / 2};
  }
}

function randomTrafficWaypoint(vehicle) {
  const roadIndexX = Math.round((vehicle.position.x + CITY_HALF) / BLOCK_SIZE);
  const roadIndexZ = Math.round((vehicle.position.z + CITY_HALF) / BLOCK_SIZE);
  const roadX = -CITY_HALF + Math.max(0, Math.min(BLOCKS, roadIndexX)) * BLOCK_SIZE;
  const roadZ = -CITY_HALF + Math.max(0, Math.min(BLOCKS, roadIndexZ)) * BLOCK_SIZE;
  const alongRoad = (Math.random() - 0.5) * BLOCKS * BLOCK_SIZE * 0.86;
  const verticalRoad = vehicle.userData.trafficAxis === 'vertical';

  return verticalRoad ? {x: roadX, z: alongRoad} : {x: alongRoad, z: roadZ};
}

function spawnCivilianCars(n, candidateFactory = randomParkingSpot) {
  const palette = [0x2f6fd9, 0xdadada, 0x2fa85a, 0xd9c62f, 0x8a4fd9, 0xd96b2f, 0x2f2f2f];
  for (let i = 0; i < n; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const isSupercar = Math.random() < 0.1;
    const isClosedTruck = !isSupercar && Math.random() < 0.3;
    const v = isSupercar ? buildSupercar(color) : (isClosedTruck ? buildClosedTruck(color) : buildVehicle(color));
    const spot = findSafeVehiclePosition(v, attempt => candidateFactory(attempt, i));
    if (!spot) {
      scene.remove(v);
      continue;
    }
    v.position.set(spot.x, 0, spot.z);
    v.rotation.y = spot.rot;

    const driver = createCivilianDriverMesh();
    if (isClosedTruck) {
      driver.position.set(0, 0.7, 0.1);
      driver.scale.set(1.12, 1.12, 1.12);
    } else {
      driver.position.set(-0.4, 0, 0.3);
      driver.scale.set(1, 1, 1);
    }
    v.add(driver);
    v.userData.hasDriver = true;
    v.userData.driverMesh = driver;

    // traffico: l'auto gira per la città finché ha un autista vivo a bordo
    v.userData.trafficAxis = Math.abs(Math.sin(spot.rot)) < 0.5 ? 'vertical' : 'horizontal';
    v.userData.waypoint = randomTrafficWaypoint(v);
    v.userData.driveSpeed = isSupercar ? 35 + Math.random() * 12 : (isClosedTruck ? 12 + Math.random() * 4 : 18 + Math.random() * 8);

    worldVehicles.push(v);
  }
}

function updateTraffic(dt) {
  for (const v of worldVehicles) {
    if (!v.userData.hasDriver) continue; // autista morto o auto rubata: resta ferma dov'è
    if (v === car && mode === 'car') continue; // per sicurezza, non capita mai insieme a hasDriver

    const wp = v.userData.waypoint;
    const dx = wp.x - v.position.x, dz = wp.z - v.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3.5) {
      v.userData.waypoint = randomTrafficWaypoint(v);
      continue;
    }
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - v.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.rotation.y += diff * Math.min(1, dt * 2.2);

    const mv = slideMove(v.position.x, v.position.z, Math.sin(v.rotation.y) * v.userData.driveSpeed * vehicleSpeedMult(v) * dt, Math.cos(v.rotation.y) * v.userData.driveSpeed * vehicleSpeedMult(v) * dt, 1.6, v);
    v.position.x = mv.x; v.position.z = mv.z;
    if (mv.blocked) {
      v.userData.waypoint = randomTrafficWaypoint(v);
      v.rotation.y += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    v.userData.wheels.forEach(w => w.rotation.x -= v.userData.driveSpeed * dt * 2);
  }
}

// ---------------------------------------------------------------------
