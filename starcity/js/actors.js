// PEDESTRIANS
// ---------------------------------------------------------------------
function addHumanoidLimbs(group, material, bodyHeight = 1.1) {
  const legHeight = 0.72;
  const legMaterial = material.clone();
  const shoeMaterial = new THREE.MeshStandardMaterial({color: 0x171717, roughness: 0.8});
  group.userData.limbs = {leftLeg: null, rightLeg: null, leftArm: null, rightArm: null, leftHand: null, rightHand: null};

  [-1, 1].forEach(side => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.16, legHeight, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, legHeight, 0.22), legMaterial);
    leg.position.y = -legHeight / 2;
    leg.castShadow = true;
    legPivot.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.38), shoeMaterial);
    shoe.position.set(0, -legHeight + 0.065, 0.08);
    shoe.castShadow = true;
    legPivot.add(shoe);
    group.add(legPivot);

    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.43, bodyHeight * 1.25, 0);
    armPivot.rotation.z = side * -0.12;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, bodyHeight * 0.62, 0.18), legMaterial);
    arm.position.y = -(bodyHeight * 0.62) / 2;
    arm.castShadow = true;
    armPivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({color: 0xffd9b3}));
    hand.position.set(0, -(bodyHeight * 0.62) - 0.05, 0);
    hand.castShadow = true;
    armPivot.add(hand);
    group.add(armPivot);

    if (side < 0) {
      group.userData.limbs.leftLeg = legPivot;
      group.userData.limbs.leftArm = armPivot;
      group.userData.limbs.leftHand = hand;
    } else {
      group.userData.limbs.rightLeg = legPivot;
      group.userData.limbs.rightArm = armPivot;
      group.userData.limbs.rightHand = hand;
    }
  });
}

function addSimpleFace(group, headY, scale = 1) {
  const face = new THREE.Group();
  face.position.set(0, headY, 0.23 * scale);
  const eyeMaterial = new THREE.MeshBasicMaterial({color: 0x111111});
  const mouthMaterial = new THREE.MeshBasicMaterial({color: 0x331818});
  [-0.1, 0.1].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035 * scale, 6, 6), eyeMaterial);
    eye.position.set(x * scale, 0.045 * scale, 0);
    face.add(eye);
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11 * scale, 0.025 * scale, 0.025 * scale), mouthMaterial);
  mouth.position.set(0, -0.065 * scale, 0);
  face.add(mouth);
  group.add(face);
}

function animateHumanoid(group, movement, dt) {
  const limbs = group.userData.limbs;
  if (!limbs) return;
  group.userData.walkPhase = (group.userData.walkPhase || 0) + movement * dt * 1.7;
  const walking = Math.abs(movement) > 0.05;
  const swing = walking ? Math.sin(group.userData.walkPhase) * 0.55 : 0;
  limbs.leftLeg.rotation.x += (swing - limbs.leftLeg.rotation.x) * Math.min(1, dt * 10);
  limbs.rightLeg.rotation.x += (-swing - limbs.rightLeg.rotation.x) * Math.min(1, dt * 10);
  const aimingPlayer = group === player && typeof aiming !== 'undefined' && aiming;
  const civilianPose = group.userData.isCivilian && !aimingPlayer;
  const leftArmTarget = aimingPlayer ? -0.68 : civilianPose ? -swing * 0.45 : -0.58;
  const rightArmTarget = aimingPlayer ? -0.68 : -swing * 0.45;
  limbs.leftArm.rotation.x += (leftArmTarget - limbs.leftArm.rotation.x) * Math.min(1, dt * 10);
  limbs.rightArm.rotation.x += (rightArmTarget - limbs.rightArm.rotation.x) * Math.min(1, dt * 10);

  if (group === player && aimingPlayer) {
    limbs.rightArm.rotation.z += (-0.42 - limbs.rightArm.rotation.z) * Math.min(1, dt * 10);
  } else if (group === player) {
    limbs.rightArm.rotation.z += (-0.12 - limbs.rightArm.rotation.z) * Math.min(1, dt * 10);
  }

  if (group === player && group.userData.weaponMesh) {
    group.userData.weaponMesh.rotation.x = -limbs.leftArm.rotation.x;
    group.userData.weaponMesh.rotation.z = -limbs.leftArm.rotation.z;
  }
}

function spawnPedestrians(n) {
  const colors = [0xffa500, 0x66cc66, 0xcc6699, 0xffffff, 0x999999, 0x00cccc];
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color: colors[Math.floor(Math.random() * colors.length)]});
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 8), mat);
    body.position.y = 0.9; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshStandardMaterial({color: 0xffd9b3}));
    head.position.y = 1.65;
    g.add(body, head);
    addHumanoidLimbs(g, mat, 1.1);
    g.userData.isCivilian = true;
    addSimpleFace(g, 1.65, 1);
    const pos = randomSidewalkPoint();
    g.position.set(pos.x, 0, pos.z);
    scene.add(g);
    pedestrians.push({mesh: g, dir: pos.dir, speed: 1 + Math.random() * 1.2, timer: Math.random() * 4, alive: true});
  }
}

function randomRoadPoint() {
  // punto casuale allineato a una "strada" della griglia
  const i = Math.floor(Math.random() * (BLOCKS + 1));
  const alongRoad = (Math.random() - 0.5) * BLOCKS * BLOCK_SIZE * 0.9;
  const pos = -CITY_HALF + i * BLOCK_SIZE;
  if (Math.random() < 0.5) {
    return new THREE.Vector3(pos + (Math.random() - 0.5) * ROAD_WIDTH, 0, alongRoad);
  } else {
    return new THREE.Vector3(alongRoad, 0, pos + (Math.random() - 0.5) * ROAD_WIDTH);
  }
}

function randomSidewalkPoint() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const i = Math.floor(Math.random() * (BLOCKS + 1));
    const alongRoad = (Math.random() - 0.5) * BLOCKS * BLOCK_SIZE * 0.86;
    const road = -CITY_HALF + i * BLOCK_SIZE;
    const side = Math.random() < 0.5 ? -1 : 1;
    const offset = ROAD_WIDTH / 2 + 1.8;
    const vertical = Math.random() < 0.5;
    const x = vertical ? road + side * offset : alongRoad;
    const z = vertical ? alongRoad : road + side * offset;
    if (!collidesBuilding(x, z, 0.7)) {
      return {x, z, dir: vertical ? 0 : Math.PI / 2};
    }
  }
  const fallback = randomRoadPoint();
  return {x: fallback.x, z: fallback.z, dir: 0};
}

// ---------------------------------------------------------------------
// COINS (denaro raccoglibile)
// ---------------------------------------------------------------------
function spawnCoins(n) {
  for (let i = 0; i < n; i++) {
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16),
      new THREE.MeshStandardMaterial({color: 0xffd633, metalness: 0.8, roughness: 0.2, emissive: 0x554400})
    );
    const p = randomRoadPoint();
    coin.position.set(p.x, 1.0, p.z);
    coin.rotation.x = Math.PI / 2;
    scene.add(coin);
    coins.push(coin);
  }
}

function respawnCoin(coin) {
  const p = randomRoadPoint();
  coin.position.set(p.x, 1.0, p.z);
}

// ---------------------------------------------------------------------
// MISSION MARKER
// ---------------------------------------------------------------------
function spawnMissionMarker() {
  if (missionMarker) scene.remove(missionMarker);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.25, 8, 24),
    new THREE.MeshBasicMaterial({color: 0xffce33})
  );
  ring.rotation.x = Math.PI / 2;
  const p = randomRoadPoint();
  ring.position.set(p.x, 0.4, p.z);
  scene.add(ring);
  missionMarker = ring;
  document.getElementById('mission-text').textContent = 'Missione: guida l\'auto fino al cerchio giallo sulla minimappa';
}

// ---------------------------------------------------------------------
