// POLICE
// ---------------------------------------------------------------------
function spawnPoliceCar() {
  const g = new THREE.Group();
  const bw = 2.2, bh = 0.9, bl = 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), new THREE.MeshStandardMaterial({color: 0x0a0a2a}));
  body.position.y = 0.75; body.castShadow = true;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.3, 1.2), new THREE.MeshStandardMaterial({color: 0xffffff}));
  stripe.position.y = 0.75;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.5), new THREE.MeshStandardMaterial({color: 0x222222}));
  bar.position.set(0, 1.35, 0);
  const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), new THREE.MeshBasicMaterial({color: 0xff0000}));
  lightL.position.set(-0.3, 1.5, 0);
  const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), new THREE.MeshBasicMaterial({color: 0x0033ff}));
  lightR.position.set(0.3, 1.5, 0);
  g.add(body, stripe, bar, lightL, lightR);
  g.userData.lightL = lightL; g.userData.lightR = lightR; g.userData.blink = 0;
  addVehicleHeadlights(g);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 14);
  const wheelMat = new THREE.MeshStandardMaterial({color: 0x0a0a0a});
  [[-1.05, 0.42, 1.4], [1.05, 0.42, 1.4], [-1.05, 0.42, -1.4], [1.05, 0.42, -1.4]].forEach(p => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], p[1], p[2]);
    w.castShadow = true;
    g.add(w);
  });

  // portiere della volante
  const doors = createDoors(bw, bh, bl, 0x0a0a2a);
  g.add(doors.left.pivot, doors.right.pivot);
  g.userData.doors = doors;

  // velocità residua da urto, usata dalla fisica delle collisioni fra veicoli
  g.userData.vx = 0;
  g.userData.vz = 0;

  // danno alla carrozzeria (0=integra, 100=distrutta): più è alto, più il veicolo va lento
  g.userData.speedMult = 1;
  g.userData.collisionCooldown = 0;

  const refPos = mode === 'car' ? car.position : player.position;
  const spawn = findSafeVehiclePosition(g, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 30;
    return {
      x: refPos.x + Math.cos(angle) * dist,
      z: refPos.z + Math.sin(angle) * dist,
      rot: angle + Math.PI
    };
  });
  if (!spawn) return;
  g.position.set(spawn.x, 0, spawn.z);
  g.rotation.y = spawn.rot;
  scene.add(g);
  policeCars.push({mesh: g, speed: POLICE_BASE_MAX_SPEED, state: 'chasing', exitTimer: 0, officers: [], returnedCount: 0});
}

function createOfficerMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color: 0x162a5c});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 8), mat);
  body.position.y = 0.9; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshStandardMaterial({color: 0xffd9b3}));
  head.position.y = 1.65;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8), new THREE.MeshStandardMaterial({color: 0x0a0a0a}));
  cap.position.y = 1.85;
  g.add(body, head, cap);
  addHumanoidLimbs(g, mat, 1.1);
  addSimpleFace(g, 1.65, 1);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), new THREE.MeshStandardMaterial({color: 0x222222}));
  gun.position.set(0.34, 1.03, 0.28);
  g.add(gun);

  if (Math.random() < 0.5 && g.userData.limbs.leftHand) {
    const baton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.62, 8),
      new THREE.MeshStandardMaterial({color: 0x111111, metalness: 0.35, roughness: 0.55})
    );
    baton.rotation.x = Math.PI / 2;
    baton.position.set(0, -0.03, 0.2);
    baton.castShadow = true;
    g.userData.limbs.leftHand.add(baton);
    g.userData.baton = baton;
  }
  return g;
}

function deployOfficers(unit) {
  const officersCount = getPoliceProfile().officers;
  for (let i = 0; i < officersCount; i++) {
    const mesh = createOfficerMesh();
    const side = i === 0 ? -1 : 1;
    mesh.position.set(unit.mesh.position.x + side * 1.6, 0, unit.mesh.position.z);
    scene.add(mesh);
    unit.officers.push({mesh, speed: getPoliceProfile().officerSpeed + Math.random() * 0.6, returning: false});
  }
  showToast('La polizia scende dall\'auto!');
}

function removePoliceUnit(unit) {
  scene.remove(unit.mesh);
  unit.officers.forEach(o => scene.remove(o.mesh));
}

function spawnPoliceHelicopter() {
  const helicopter = new THREE.Group();

  // ================================================================
  // MATERIALI
  // ================================================================
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x182338,
    roughness: 0.42,
    metalness: 0.25
  });

  const bodyDarkMat = new THREE.MeshStandardMaterial({
    color: 0x0b101b,
    roughness: 0.5,
    metalness: 0.2
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x050608,
    roughness: 0.65
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    roughness: 0.3,
    metalness: 0.85
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x173d4c,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.58,
    transmission: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x101216,
    roughness: 0.55,
    metalness: 0.3
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xe8edf5,
    roughness: 0.35,
    metalness: 0.05
  });

  // ================================================================
  // FUSOLIERA
  // Niente sfera: corpo costruito con sezioni cilindriche
  // ================================================================
  const fuselage = new THREE.Group();

  // corpo centrale
  const mainBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.08, 3.8, 16, 1),
    bodyMat
  );

  mainBody.rotation.x = Math.PI / 2;
  mainBody.position.set(0, 0, 0);

  mainBody.castShadow = true;
  mainBody.receiveShadow = true;

  fuselage.add(mainBody);

  // parte inferiore
  const belly = new THREE.Mesh(
    new THREE.CylinderGeometry(1.02, 0.82, 2.8, 16),
    bodyDarkMat
  );

  belly.rotation.x = Math.PI / 2;
  belly.position.set(0, -0.55, 0.05);

  belly.castShadow = true;

  fuselage.add(belly);

  // ================================================================
  // MUSO
  // ================================================================
  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 1.28, 1.65, 16),
    bodyMat
  );

  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.03, 2.45);

  nose.castShadow = true;

  fuselage.add(nose);

  // punta del muso più affusolata
  const noseTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.82, 0.9, 16),
    bodyMat
  );

  noseTip.rotation.x = -Math.PI / 2;
  noseTip.position.set(0, 0.03, 3.25);

  noseTip.castShadow = true;

  fuselage.add(noseTip);

  // ================================================================
  // CABINA
  // ================================================================
  const cockpit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 1.08, 1.7, 16),
    glassMat
  );

  cockpit.rotation.x = Math.PI / 2;
  cockpit.position.set(0, 0.38, 2.15);

  fuselage.add(cockpit);

  // parabrezza frontale
  const windshield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.92, 0.12, 16),
    glassMat
  );

  windshield.rotation.x = Math.PI / 2;
  windshield.position.set(0, 0.38, 3.0);

  fuselage.add(windshield);

  // montante centrale del parabrezza
  const windshieldBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.9, 0.12),
    blackMat
  );

  windshieldBar.position.set(0, 0.4, 3.04);

  fuselage.add(windshieldBar);

  // ================================================================
  // FINESTRINI LATERALI
  // ================================================================
  const sideWindowL = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.82, 1.35),
    glassMat
  );

  sideWindowL.position.set(-1.18, 0.38, 1.9);
  sideWindowL.rotation.y = 0.05;

  const sideWindowR = sideWindowL.clone();
  sideWindowR.position.x = 1.18;

  fuselage.add(sideWindowL, sideWindowR);

  // ================================================================
  // PORTIERE
  // ================================================================
  const doorL = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 1.25, 1.45),
    bodyMat
  );

  doorL.position.set(-1.27, -0.05, 0.55);
  doorL.rotation.y = 0.04;

  const doorR = doorL.clone();
  doorR.position.x = 1.27;

  fuselage.add(doorL, doorR);

  // maniglie
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x777c85,
    metalness: 0.8,
    roughness: 0.25
  });

  const handleL = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.08, 0.28),
    handleMat
  );

  handleL.position.set(-1.31, 0.12, 0.65);

  const handleR = handleL.clone();
  handleR.position.x = 1.31;

  fuselage.add(handleL, handleR);

  // ================================================================
  // STRISCIA BIANCA POLIZIA
  // ================================================================
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.62, 0.16, 2.7),
    whiteMat
  );

  stripe.position.set(0, 0.03, 0.2);

  fuselage.add(stripe);

  // fascia scura sopra la livrea
  const stripeDark = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.11, 1.7),
    bodyDarkMat
  );

  stripeDark.position.set(0, 0.58, 0.25);

  fuselage.add(stripeDark);

  // ================================================================
  // CODA
  // ================================================================
  const tailBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.48, 1.6, 14),
    bodyMat
  );

  tailBase.rotation.x = Math.PI / 2;
  tailBase.position.set(0, 0.05, -2.55);

  fuselage.add(tailBase);

  const tailBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.13, 5.0, 12),
    bodyMat
  );

  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 0.18, -5.35);

  tailBoom.castShadow = true;

  fuselage.add(tailBoom);

  // ================================================================
  // PINNA VERTICALE
  // ================================================================
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 1.45, 1.25),
    bodyMat
  );

  fin.position.set(0, 0.85, -7.45);
  fin.rotation.x = -0.25;

  fuselage.add(fin);

  // ================================================================
  // STABILIZZATORE ORIZZONTALE
  // ================================================================
  const stabilizer = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.1, 0.55),
    bodyMat
  );

  stabilizer.position.set(0, 0.55, -6.9);

  fuselage.add(stabilizer);

  helicopter.add(fuselage);

  // ================================================================
  // ALBERO DEL ROTORE
  // ================================================================
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 0.95, 12),
    metalMat
  );

  mast.position.y = 1.35;

  helicopter.add(mast);

  // supporto superiore
  const rotorHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.18, 12),
    metalMat
  );

  rotorHub.position.y = 1.86;

  helicopter.add(rotorHub);

  // ================================================================
  // ROTORE PRINCIPALE
  // ================================================================
  const rotor = new THREE.Group();
  rotor.position.y = 1.96;

  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.055, 5.0),
      rotorMat
    );

    blade.position.z = 2.5;
    blade.rotation.y = i * Math.PI / 2;

    blade.castShadow = true;

    rotor.add(blade);
  }

  helicopter.add(rotor);

  // ================================================================
  // ROTORE DI CODA
  // ================================================================
  const tailRotor = new THREE.Group();

  tailRotor.position.set(0, 0.48, -7.72);

  const tailRotorHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.25, 12),
    metalMat
  );

  tailRotorHub.rotation.z = Math.PI / 2;

  tailRotor.add(tailRotorHub);

  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 1.1, 0.12),
      rotorMat
    );

    blade.position.y = 0.55;
    blade.rotation.z = i * Math.PI / 2;

    tailRotor.add(blade);
  }

  helicopter.add(tailRotor);

  // ================================================================
  // PATTINI
  // ================================================================
  function createSkid(x) {
    const skid = new THREE.Group();

    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 4.0, 10),
      metalMat
    );

    rail.rotation.x = Math.PI / 2;
    rail.position.z = 0;

    skid.add(rail);

    [-1.25, 0, 1.25].forEach(z => {
      const support = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.8, 8),
        metalMat
      );

      support.position.set(0, 0.3, z);
      support.rotation.z = x < 0 ? -0.15 : 0.15;

      skid.add(support);
    });

    skid.position.set(x, -1.05, 0);

    return skid;
  }

  helicopter.add(
    createSkid(-0.92),
    createSkid(0.92)
  );

  // ================================================================
  // LUCI POLIZIA
  // ================================================================
  const beaconRed = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff1111
    })
  );

  beaconRed.position.set(-0.62, 0.55, 0.8);

  const beaconBlue = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0x2266ff
    })
  );

  beaconBlue.position.set(0.62, 0.55, 0.8);

  helicopter.add(beaconRed, beaconBlue);

  // ================================================================
  // FARO DI RICERCA
  // ================================================================
  const searchLight = new THREE.SpotLight(
    0xffffff,
    5,
    50,
    Math.PI / 8,
    0.5,
    1
  );

  searchLight.position.set(0, -0.45, 1.7);
  searchLight.target.position.set(0, -20, 1.7);

  helicopter.add(searchLight);
  helicopter.add(searchLight.target);

  const searchBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff
    })
  );

  searchBulb.position.set(0, -0.5, 1.7);

  helicopter.add(searchBulb);

  // ================================================================
  // DATI UTILIZZATI DAL RESTO DEL GIOCO
  // ================================================================
  helicopter.userData.rotor = rotor;
  helicopter.userData.tailRotor = tailRotor;

  helicopter.userData.beaconRed = beaconRed;
  helicopter.userData.beaconBlue = beaconBlue;

  helicopter.userData.searchLight = searchLight;

  helicopter.userData.blink = 0;

  // ================================================================
  // SPAWN
  // ================================================================
  const target = mode === 'car'
    ? car.position
    : player.position;

  const angle = Math.random() * Math.PI * 2;

  helicopter.position.set(
    target.x + Math.cos(angle) * 18,
    28,
    target.z + Math.sin(angle) * 18
  );

  helicopter.rotation.y = angle + Math.PI;

  scene.add(helicopter);
  policeHelicopters.push(helicopter);
}

function removePoliceHelicopters() {
  policeHelicopters.forEach(helicopter => scene.remove(helicopter));
  policeHelicopters = [];
}

function updatePoliceHelicopters(dt) {
  if (state.wanted >= MAX_STARS && policeHelicopters.length === 0) spawnPoliceHelicopter();
  if (state.wanted < MAX_STARS && policeHelicopters.length > 0) removePoliceHelicopters();

  const target = mode === 'car' ? car.position : player.position;
  policeHelicopters.forEach(helicopter => {
    const dx = target.x - helicopter.position.x;
    const dz = target.z - helicopter.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const desiredAngle = Math.atan2(dx, dz);
    let angleDiff = desiredAngle - helicopter.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    helicopter.rotation.y += angleDiff * Math.min(1, dt * 2.5);
    const speed = Math.min(32, distance * 0.9);
    helicopter.position.x += Math.sin(helicopter.rotation.y) * speed * dt;
    helicopter.position.z += Math.cos(helicopter.rotation.y) * speed * dt;
    helicopter.position.y = 25 + Math.sin(clock.elapsedTime * 1.8) * 1.2;
    helicopter.userData.rotor.rotation.y += dt * 24;
    helicopter.userData.tailRotor.rotation.z += dt * 32;

    helicopter.userData.blink += dt * 8;

    const on = Math.sin(helicopter.userData.blink) > 0;

    helicopter.userData.beaconRed.visible = on;
    helicopter.userData.beaconBlue.visible = !on;

    helicopter.userData.searchLight.intensity = on ? 5 : 1;
  });
}

// richiama subito eventuali agenti scesi e mette l'auto in perlustrazione:
// non insegue più nessuno, ma continua a girare per la città invece di sparire
function startPolicePatrol(unit) {
  unit.officers.forEach(o => scene.remove(o.mesh));
  unit.officers = [];
  unit.returnedCount = 0;
  closeDoors(unit.mesh);
  unit.state = 'patrol';
  unit.patrolWaypoint = randomRoadPoint();
  unit.patrolSpeed = 5 + Math.random() * 3;
}

const POLICE_LEVELS = [
  {maxUnits: 1, carSpeed: 26, turnRate: 2.2, officers: 1, officerSpeed: 2.4, stopDist: 10, fleeDist: 26, resumeDist: 16, recallDist: 46},
  {maxUnits: 2, carSpeed: 29, turnRate: 2.6, officers: 2, officerSpeed: 2.8, stopDist: 9, fleeDist: 23, resumeDist: 15, recallDist: 42},
  {maxUnits: 3, carSpeed: 30, turnRate: 2.5, officers: 2, officerSpeed: 2.8, stopDist: 9, fleeDist: 24, resumeDist: 15, recallDist: 44},
  {maxUnits: 4, carSpeed: 32, turnRate: 2.8, officers: 2, officerSpeed: 3.0, stopDist: 8, fleeDist: 21, resumeDist: 13, recallDist: 40},
  {maxUnits: 5, carSpeed: 34, turnRate: 3.1, officers: 3, officerSpeed: 3.3, stopDist: 7, fleeDist: 18, resumeDist: 11, recallDist: 36}
];

function getPoliceProfile() {
  return POLICE_LEVELS[Math.max(0, Math.min(MAX_STARS, state.wanted)) - 1] || POLICE_LEVELS[0];
}

function getPoliceInterceptPoint() {
  const forward = {
    x: Math.sin(car.rotation.y),
    z: Math.cos(car.rotation.y)
  };
  const leadDistance = Math.max(7, Math.min(16, Math.abs(carSpeed) * 0.45 + 7));
  return {
    x: car.position.x + forward.x * leadDistance,
    z: car.position.z + forward.z * leadDistance
  };
}

function updatePolice(dt) {
  const target = mode === 'car' ? car.position : player.position;
  const profile = getPoliceProfile();

  // spawn in base al wanted level: reagisce subito, senza ritardi casuali.
  // le unità già in perlustrazione non contano ai fini dello spawn: se il
  // ricercato risale, ne arrivano comunque di fresche in inseguimento
  const desired = state.wanted > 0 ? profile.maxUnits : 0;
  const activeCount = policeCars.filter(p => p.state !== 'patrol').length;
  if (activeCount < desired) {
    spawnPoliceCar();
  }

  // quando il ricercato torna a 0 le volanti non spariscono più: smettono
  // di inseguire e si mettono a girare per la mappa in perlustrazione
  if (state.wanted === 0) {
    policeCars.forEach(p => {if (p.state !== 'patrol') startPolicePatrol(p);});
  }

  for (let ui = policeCars.length - 1; ui >= 0; ui--) {
    const p = policeCars[ui];
    const m = p.mesh;
    p.speed = profile.carSpeed;

    if (p.state === 'patrol') {
      // luci spente, nessun inseguimento: gira semplicemente per le strade
      m.userData.lightL.material.color.setHex(0x330000);
      m.userData.lightR.material.color.setHex(0x000033);
      updateVehicleDoors(m, dt);

      // se il giocatore torna a farsi notare, l'unità riprende subito l'inseguimento
      if (state.wanted > 0) {p.state = 'chasing'; continue;}

      const wp = p.patrolWaypoint;
      const dx = wp.x - m.position.x, dz = wp.z - m.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 3.5) {p.patrolWaypoint = randomRoadPoint(); continue;}

      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - m.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.rotation.y += diff * Math.min(1, dt * profile.turnRate * 0.7);

      const mv = slideMove(m.position.x, m.position.z, Math.sin(m.rotation.y) * p.patrolSpeed * vehicleSpeedMult(m) * dt, Math.cos(m.rotation.y) * p.patrolSpeed * vehicleSpeedMult(m) * dt, 1.6, m);
      m.position.x = mv.x; m.position.z = mv.z;
      if (mv.blocked) {
        p.patrolWaypoint = randomRoadPoint();
        m.rotation.y += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      continue;
    }

    // lampeggio sirene (attivo quando l'unità è in servizio attivo)
    m.userData.blink += dt * 10;
    const on = Math.sin(m.userData.blink) > 0;
    m.userData.lightL.material.color.setHex(on ? 0xff0000 : 0x330000);
    m.userData.lightR.material.color.setHex(on ? 0x0033ff : 0x000033);
    updateVehicleDoors(m, dt);

    if (p.state === 'chasing') {
      const targetPoint = mode === 'car' ? getPoliceInterceptPoint() : target;
      const dx = targetPoint.x - m.position.x;
      const dz = targetPoint.z - m.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - m.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.rotation.y += diff * Math.min(1, dt * profile.turnRate);

      if (dist > profile.stopDist) {
        const mv = slideMove(m.position.x, m.position.z, Math.sin(m.rotation.y) * p.speed * vehicleSpeedMult(m) * dt, Math.cos(m.rotation.y) * p.speed * vehicleSpeedMult(m) * dt, 1.6, m);
        m.position.x = mv.x; m.position.z = mv.z;
        if (mv.blocked) {
          p.patrolWaypoint = randomRoadPoint();
          m.rotation.y += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        }
      } else {
        // l'auto si ferma, apre le portiere e dopo un attimo scendono gli agenti
        p.state = 'exiting';
        p.exitTimer = 0.45;
        openDoors(m, 'both');
      }
      continue;
    }

    if (p.state === 'exiting') {
      p.exitTimer -= dt;
      if (p.exitTimer <= 0) {
        deployOfficers(p);
        p.state = 'busting';
      }
      continue;
    }

    if (p.state === 'busting') {
      // le portiere si aprono/chiudono in base a quanto sono vicini gli agenti all'auto
      const anyNear = p.officers.some(o => dist2D(o.mesh.position, m.position) < 3.2);
      if (anyNear) openDoors(m, 'both'); else closeDoors(m);

      const distCarTarget = dist2D(target, m.position);

      // se scappi troppo lontano (es. in auto), niente inseguimenti a piedi
      // infiniti: gli agenti risalgono subito e l'auto riparte a rincorrerti
      if (distCarTarget > profile.recallDist && p.officers.length > 0) {
        p.officers.forEach(o => scene.remove(o.mesh));
        p.returnedCount += p.officers.length;
        p.officers = [];
      }

      for (let oi = p.officers.length - 1; oi >= 0; oi--) {
        const off = p.officers[oi];
        off.speed = profile.officerSpeed;

        // se il giocatore scappa lontano, gli agenti tornano in auto;
        // se si riavvicina, riprendono l'inseguimento a piedi
        if (!off.returning && distCarTarget > profile.fleeDist) off.returning = true;
        if (off.returning && distCarTarget < profile.resumeDist) off.returning = false;

        const goal = off.returning ? m.position : target;
        const dx = goal.x - off.mesh.position.x;
        const dz = goal.z - off.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);
        off.mesh.rotation.y = angle;

        const stopDist = off.returning ? 1.6 : 1.3;
        if (dist > stopDist) {
          const mv = slideMove(off.mesh.position.x, off.mesh.position.z, Math.sin(angle) * off.speed * dt, Math.cos(angle) * off.speed * dt, 0.7);
          off.mesh.position.x = mv.x; off.mesh.position.z = mv.z;
          animateHumanoid(off.mesh, off.speed, dt);
        } else if (off.returning) {
          scene.remove(off.mesh);
          p.officers.splice(oi, 1);
          p.returnedCount++;
        } else {
          animateHumanoid(off.mesh, 0, dt);
          doArrest();
          return; // stato resettato ovunque, esci subito dal ciclo
        }
      }

      if (p.officers.length === 0) {
        if (p.returnedCount > 0) {
          // tutti gli agenti sono rientrati: l'auto riparte all'inseguimento
          p.state = 'chasing';
          p.returnedCount = 0;
          closeDoors(m);
        } else {
          // nessun agente è sopravvissuto: l'auto abbandonata se ne va
          removePoliceUnit(p);
          policeCars.splice(ui, 1);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------
