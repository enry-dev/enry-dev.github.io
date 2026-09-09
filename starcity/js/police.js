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

  // spawna lontano dal player, sul bordo città
  const angle = Math.random() * Math.PI * 2;
  const dist = 60 + Math.random() * 30;
  const refPos = mode === 'car' ? car.position : player.position;
  g.position.set(refPos.x + Math.cos(angle) * dist, 0, refPos.z + Math.sin(angle) * dist);
  scene.add(g);
  policeCars.push({mesh: g, speed: PLAYER_BASE_MAX_SPEED, state: 'chasing', exitTimer: 0, officers: [], returnedCount: 0});
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
  for (let i = 0; i < 2; i++) {
    const mesh = createOfficerMesh();
    const side = i === 0 ? -1 : 1;
    mesh.position.set(unit.mesh.position.x + side * 1.6, 0, unit.mesh.position.z);
    scene.add(mesh);
    unit.officers.push({mesh, speed: 2.4 + Math.random() * 0.6, returning: false});
  }
  showToast('La polizia scende dall\'auto!');
}

function removePoliceUnit(unit) {
  scene.remove(unit.mesh);
  unit.officers.forEach(o => scene.remove(o.mesh));
}

function spawnPoliceHelicopter() {
  const helicopter = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 12, 8),
    new THREE.MeshStandardMaterial({color: 0x1a2438, roughness: 0.65})
  );
  body.scale.set(1.25, 0.7, 1.8);
  body.position.y = 0.2;
  helicopter.add(body);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({color: 0x6aa7ba, metalness: 0.15, roughness: 0.2, transparent: true, opacity: 0.85})
  );
  cockpit.scale.set(1.05, 0.72, 1.3);
  cockpit.position.set(0, 0.45, 1.3);
  helicopter.add(cockpit);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 4.4), new THREE.MeshStandardMaterial({color: 0x1a2438}));
  tail.position.z = -2.5;
  helicopter.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.08, 0.22), new THREE.MeshBasicMaterial({color: 0x111111}));
  rotor.position.y = 1.45;
  helicopter.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.12), new THREE.MeshBasicMaterial({color: 0x111111}));
  tailRotor.position.set(0, 0.3, -4.65);
  helicopter.add(tailRotor);
  const light = new THREE.PointLight(0xff3344, 1.5, 12);
  light.position.set(0, -0.4, 0.8);
  helicopter.add(light);

  const target = mode === 'car' ? car.position : player.position;
  const angle = Math.random() * Math.PI * 2;
  helicopter.position.set(target.x + Math.cos(angle) * 42, 26, target.z + Math.sin(angle) * 42);
  helicopter.userData.rotor = rotor;
  helicopter.userData.tailRotor = tailRotor;
  helicopter.userData.blink = 0;
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
    const speed = Math.min(18, distance * 0.45);
    helicopter.position.x += Math.sin(helicopter.rotation.y) * speed * dt;
    helicopter.position.z += Math.cos(helicopter.rotation.y) * speed * dt;
    helicopter.position.y = 25 + Math.sin(clock.elapsedTime * 1.8) * 1.2;
    helicopter.userData.rotor.rotation.y += dt * 24;
    helicopter.userData.tailRotor.rotation.x += dt * 30;
    helicopter.userData.blink += dt * 8;
    const on = Math.sin(helicopter.userData.blink) > 0;
    helicopter.children[5].intensity = on ? 2.2 : 0.2;
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

const POLICE_STOP_DIST = 9;
const POLICE_FLEE_DIST = 22;
const POLICE_RESUME_DIST = 14;
const POLICE_INSTANT_RECALL_DIST = 40;

function updatePolice(dt) {
  const target = mode === 'car' ? car.position : player.position;

  // spawn in base al wanted level: reagisce subito, senza ritardi casuali.
  // le unità già in perlustrazione non contano ai fini dello spawn: se il
  // ricercato risale, ne arrivano comunque di fresche in inseguimento
  const desired = state.wanted;
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
      m.rotation.y += diff * Math.min(1, dt * 2.2);

      const mv = slideMove(m.position.x, m.position.z, Math.sin(m.rotation.y) * p.patrolSpeed * vehicleSpeedMult(m) * dt, Math.cos(m.rotation.y) * p.patrolSpeed * vehicleSpeedMult(m) * dt, 1.6, m);
      m.position.x = mv.x; m.position.z = mv.z;
      if (mv.blocked) registerBuildingImpact(m, p.patrolSpeed * vehicleSpeedMult(m));
      continue;
    }

    // lampeggio sirene (attivo quando l'unità è in servizio attivo)
    m.userData.blink += dt * 10;
    const on = Math.sin(m.userData.blink) > 0;
    m.userData.lightL.material.color.setHex(on ? 0xff0000 : 0x330000);
    m.userData.lightR.material.color.setHex(on ? 0x0033ff : 0x000033);
    updateVehicleDoors(m, dt);

    if (p.state === 'chasing') {
      const dx = target.x - m.position.x;
      const dz = target.z - m.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const targetAngle = Math.atan2(dx, dz);
      let diff = targetAngle - m.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.rotation.y += diff * Math.min(1, dt * 3);

      if (dist > POLICE_STOP_DIST) {
        const mv = slideMove(m.position.x, m.position.z, Math.sin(m.rotation.y) * p.speed * vehicleSpeedMult(m) * dt, Math.cos(m.rotation.y) * p.speed * vehicleSpeedMult(m) * dt, 1.6, m);
        m.position.x = mv.x; m.position.z = mv.z;
        if (mv.blocked) registerBuildingImpact(m, p.speed * vehicleSpeedMult(m));
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
      if (distCarTarget > POLICE_INSTANT_RECALL_DIST && p.officers.length > 0) {
        p.officers.forEach(o => scene.remove(o.mesh));
        p.returnedCount += p.officers.length;
        p.officers = [];
      }

      for (let oi = p.officers.length - 1; oi >= 0; oi--) {
        const off = p.officers[oi];

        // se il giocatore scappa lontano, gli agenti tornano in auto;
        // se si riavvicina, riprendono l'inseguimento a piedi
        if (!off.returning && distCarTarget > POLICE_FLEE_DIST) off.returning = true;
        if (off.returning && distCarTarget < POLICE_RESUME_DIST) off.returning = false;

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
