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
  const lightMat = new THREE.MeshBasicMaterial({color: 0xfff7cc});
  [[-0.7, 0.75, 2.15], [0.7, 0.75, 2.15]].forEach(p => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lightMat);
    l.position.set(p[0], p[1], p[2]);
    group.add(l);
  });

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
  vehicle.userData.isWrecked = true;
  vehicle.userData.speedMult = 0;
  vehicle.userData.hasDriver = false;
  if (vehicle.userData.driverMesh) {
    vehicle.remove(vehicle.userData.driverMesh);
    vehicle.userData.driverMesh = null;
  }
  createVehicleBreakEffects(vehicle);
  if (vehicle === car) {
    carSpeed = 0;
    showToast('AUTO DISTRUTTA: non e piu utilizzabile');
  }
}

function updateVehicleDamageEffects(dt) {
  worldVehicles.concat(policeCars.map(p => p.mesh)).forEach(vehicle => {
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
  });
}

function buildCar() {
  car = buildVehicle(0xdd2b2b);
  car.position.copy(CAR_SPAWN);
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
  player.position.set(CAR_SPAWN.x + 4, 0, CAR_SPAWN.z + 4);
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

function spawnCivilianCars(n) {
  const palette = [0x2f6fd9, 0xdadada, 0x2fa85a, 0xd9c62f, 0x8a4fd9, 0xd96b2f, 0x2f2f2f];
  for (let i = 0; i < n; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const v = buildVehicle(color);
    const spot = randomParkingSpot();
    v.position.set(spot.x, 0, spot.z);
    v.rotation.y = spot.rot;

    const driver = createCivilianDriverMesh();
    driver.position.set(-0.4, 0, 0.3);
    v.add(driver);
    v.userData.hasDriver = true;
    v.userData.driverMesh = driver;

    // traffico: l'auto gira per la città finché ha un autista vivo a bordo
    v.userData.trafficAxis = spot.rot === 0 ? 'vertical' : 'horizontal';
    v.userData.waypoint = randomTrafficWaypoint(v);
    v.userData.driveSpeed = 5 + Math.random() * 4;

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
      v.rotation.y += Math.PI / 2;
    }
    v.userData.wheels.forEach(w => w.rotation.x -= v.userData.driveSpeed * dt * 2);
  }
}

// ---------------------------------------------------------------------
