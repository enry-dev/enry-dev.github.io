// CITY GENERATION
// ---------------------------------------------------------------------
function createBuildingTexture(colorHex) {
  // genera una texture procedurale con finestre per rendere i palazzi più realistici
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const base = new THREE.Color(colorHex);
  const darker = base.clone().multiplyScalar(0.75);
  ctx.fillStyle = '#' + darker.getHexString();
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = 6, rows = 16;
  const cw = canvas.width / cols, rh = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.32;
      ctx.fillStyle = lit ? 'rgba(255,232,168,0.95)' : 'rgba(15,18,26,0.6)';
      ctx.fillRect(c * cw + cw * 0.18, r * rh + rh * 0.22, cw * 0.64, rh * 0.58);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildCity() {
  // terreno base (asfalto/strade)
  const groundGeo = new THREE.PlaneGeometry(BLOCKS * BLOCK_SIZE + 40, BLOCKS * BLOCK_SIZE + 40);
  const groundMat = new THREE.MeshStandardMaterial({color: 0x3a3a3f, roughness: 1});
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const lineMat = new THREE.MeshBasicMaterial({color: 0xffe066});
  const sidewalkMat = new THREE.MeshStandardMaterial({color: 0x8a8a8a, roughness: 1});
  const grassMat = new THREE.MeshStandardMaterial({color: 0x386b34, roughness: 1});

  const buildingPalette = [0xd94f4f, 0xd9a04f, 0x4f8ed9, 0x8a4fd9, 0x4fd97e, 0xd94fbc, 0xc7c7c7, 0x556270];

  for (let i = 0; i < BLOCKS; i++) {
    for (let j = 0; j < BLOCKS; j++) {
      const cx = -CITY_HALF + i * BLOCK_SIZE + BLOCK_SIZE / 2;
      const cz = -CITY_HALF + j * BLOCK_SIZE + BLOCK_SIZE / 2;
      const isPark = (i === Math.floor(BLOCKS / 2) && j === Math.floor(BLOCKS / 2));
      const isPlayerHome = i === 0 && j === 0;
      const isDowntown = (Math.abs(i - BLOCKS / 2) < 2 && Math.abs(j - BLOCKS / 2) < 2);

      const lotSize = BLOCK_SIZE - ROAD_WIDTH - 6;

      if (isPlayerHome) {
        buildPlayerHouse(cx, cz, lotSize);
        continue;
      }

      if (isPark) {
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(lotSize, lotSize), grassMat);
        grass.rotation.x = -Math.PI / 2; grass.position.set(cx, 0.02, cz); grass.receiveShadow = true;
        scene.add(grass);
        for (let t = 0; t < 6; t++) {
          addTree(cx + (Math.random() - 0.5) * lotSize * 0.7, cz + (Math.random() - 0.5) * lotSize * 0.7);
        }
        continue;
      }

      // marciapiede
      const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(lotSize, lotSize), sidewalkMat);
      sidewalk.rotation.x = -Math.PI / 2; sidewalk.position.set(cx, 0.015, cz); sidewalk.receiveShadow = true;
      scene.add(sidewalk);

      const footprint = lotSize - 6;
      const height = isDowntown ? (18 + Math.random() * 55) : (5 + Math.random() * 14);
      const color = buildingPalette[Math.floor(Math.random() * buildingPalette.length)];
      const bw = footprint * (0.55 + Math.random() * 0.4);
      const bd = footprint * (0.55 + Math.random() * 0.4);

      const bGeo = new THREE.BoxGeometry(bw, height, bd);
      const bTexture = createBuildingTexture(color);
      const bMat = new THREE.MeshStandardMaterial({map: bTexture, roughness: 0.8, metalness: 0.15});
      const building = new THREE.Mesh(bGeo, bMat);
      building.position.set(cx, height / 2, cz);
      building.castShadow = true; building.receiveShadow = true;
      scene.add(building);

      // cornice sottile agli spigoli per staccare meglio i volumi
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bGeo), new THREE.LineBasicMaterial({color: 0x0a0a0a, transparent: true, opacity: 0.35}));
      edges.position.copy(building.position);
      scene.add(edges);

      // dettaglio sul tetto per i grattacieli del centro
      if (isDowntown && Math.random() < 0.6) {
        const roofUnit = new THREE.Mesh(
          new THREE.BoxGeometry(bw * 0.4, height * 0.08, bd * 0.4),
          new THREE.MeshStandardMaterial({color: 0x2a2a2e, roughness: 0.6})
        );
        roofUnit.position.set(cx, height + (height * 0.08) / 2, cz);
        roofUnit.castShadow = true;
        scene.add(roofUnit);
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, height * 0.15, 6),
          new THREE.MeshStandardMaterial({color: 0x111111})
        );
        antenna.position.set(cx, height + height * 0.08 + (height * 0.15) / 2, cz);
        scene.add(antenna);
      }

      buildingsAABB.push({
        minX: cx - bw / 2, maxX: cx + bw / 2,
        minZ: cz - bd / 2, maxZ: cz + bd / 2
      });
    }
  }

  // linee stradali (semplici strisce gialle al centro delle strade orizzontali/verticali)
  for (let i = 0; i <= BLOCKS; i++) {
    const pos = -CITY_HALF + i * BLOCK_SIZE;
    const stripeV = new THREE.Mesh(new THREE.PlaneGeometry(0.4, BLOCKS * BLOCK_SIZE), lineMat);
    stripeV.rotation.x = -Math.PI / 2; stripeV.position.set(pos, 0.03, 0);
    scene.add(stripeV);
    const stripeH = new THREE.Mesh(new THREE.PlaneGeometry(BLOCKS * BLOCK_SIZE, 0.4), lineMat);
    stripeH.rotation.x = -Math.PI / 2; stripeH.position.set(0, 0.03, pos);
    scene.add(stripeH);
  }
}

function buildStarField() {
  const starCount = 140;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 700;
    positions[i * 3 + 1] = 90 + Math.random() * 190;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 700;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starField = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.35,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    })
  );
  starField.renderOrder = 1;
  scene.add(starField);
}

function updateStarField(daylight, time) {
  if (!starField) return;
  const night = 1 - Math.min(1, daylight * 2.2);
  const twinkle = 0.78 + Math.sin(time * 1.4) * 0.12;
  starField.material.opacity = Math.max(0, night) * twinkle;
}

// ---------------------------------------------------------------------
// HELPER: crea rapidamente una mesh box con ombre attive
// ---------------------------------------------------------------------
function makeBox(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.8,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.05,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity || 0
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  return mesh;
}

// ---------------------------------------------------------------------
// HELPER: texture procedurale per il poster "STAR CITY" con 5 stelle
// ---------------------------------------------------------------------
function createStarCityPosterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#1a1a3d');
  grad.addColorStop(1, '#3d1a5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#f0d3a0';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('STAR', canvas.width / 2, 150);
  ctx.fillText('CITY', canvas.width / 2, 200);

  ctx.font = '42px sans-serif';
  ctx.fillText('\u2605 \u2605 \u2605 \u2605 \u2605', canvas.width / 2, 270);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildPlayerHouse(cx, cz, lotSize) {
  const grassMat = new THREE.MeshStandardMaterial({color: 0x386b34, roughness: 1});
  const houseMat = new THREE.MeshStandardMaterial({color: 0xb64f3f, roughness: 0.82, side: THREE.DoubleSide});
  const trimMat = new THREE.MeshStandardMaterial({color: 0xf0d3a0, roughness: 0.7});
  const roofMat = new THREE.MeshStandardMaterial({color: 0x30343d, roughness: 0.9});
  const glassMat = new THREE.MeshStandardMaterial({color: 0x78b8c9, metalness: 0.2, roughness: 0.25});
  const interiorMat = new THREE.MeshStandardMaterial({color: 0x8d765e, roughness: 1});
  const ceilingMat = new THREE.MeshStandardMaterial({color: 0xe8ddc8, roughness: 0.95, side: THREE.DoubleSide});

  const lot = new THREE.Mesh(new THREE.PlaneGeometry(lotSize, lotSize), grassMat);
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(cx, 0.02, cz);
  lot.receiveShadow = true;
  scene.add(lot);

  const houseX = cx + 1;
  const houseZ = cz - 6.5;
  const houseWidth = 15;
  const houseDepth = 12;
  const wallHeight = 3.2;
  const wallThickness = 0.45;
  const frontZ = houseZ + houseDepth / 2;
  const backZ = houseZ - houseDepth / 2;
  const leftX = houseX - houseWidth / 2;
  const rightX = houseX + houseWidth / 2;
  const doorWidth = 2.8;

  const addWall = (x, z, width, depth, material = houseMat) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), material);
    wall.position.set(x, wallHeight / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    buildingsAABB.push({
      minX: x - width / 2, maxX: x + width / 2,
      minZ: z - depth / 2, maxZ: z + depth / 2
    });
  };

  // Pareti con apertura centrale: il player puo entrare senza porte speciali.
  addWall(houseX, backZ, houseWidth, wallThickness);
  addWall(leftX, houseZ, wallThickness, houseDepth);
  addWall(rightX, houseZ, wallThickness, houseDepth);
  addWall(leftX + (houseWidth - doorWidth) / 4, frontZ, (houseWidth - doorWidth) / 2, wallThickness);
  addWall(rightX - (houseWidth - doorWidth) / 4, frontZ, (houseWidth - doorWidth) / 2, wallThickness);

  const doorLintelHeight = wallHeight - 2.35;
  const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorLintelHeight, wallThickness), houseMat);
  doorLintel.position.set(houseX, 2.35 + doorLintelHeight / 2, frontZ);
  doorLintel.castShadow = true;
  doorLintel.receiveShadow = true;
  scene.add(doorLintel);

  const frontGableShape = new THREE.Shape();
  frontGableShape.moveTo(-houseWidth / 2, 0);
  frontGableShape.lineTo(houseWidth / 2, 0);
  frontGableShape.lineTo(0, 2.1);
  frontGableShape.closePath();
  const frontGable = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frontGableShape, {depth: wallThickness, bevelEnabled: false}),
    houseMat
  );
  frontGable.position.set(houseX, wallHeight, frontZ - wallThickness / 2);
  frontGable.castShadow = true;
  frontGable.receiveShadow = true;
  scene.add(frontGable);

  const rearGable = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frontGableShape, {depth: wallThickness, bevelEnabled: false}),
    houseMat
  );
  rearGable.position.set(houseX, wallHeight, backZ - wallThickness / 2);
  rearGable.rotation.y = Math.PI;
  rearGable.castShadow = true;
  rearGable.receiveShadow = true;
  scene.add(rearGable);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(houseWidth - 0.8, 0.08, houseDepth - 0.8), interiorMat);
  floor.position.set(houseX, 0.06, houseZ);
  floor.receiveShadow = true;
  scene.add(floor);

  // Soffitto: chiude visivamente l'ambiente e regge la plafoniera
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(houseWidth - 0.8, 0.1, houseDepth - 0.8), ceilingMat);
  ceiling.position.set(houseX, wallHeight - 0.05, houseZ);
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  const roofPanelWidth = houseWidth / 2 + 0.7;
  const roofDepth = houseDepth + 0.8;
  const roofAngle = Math.atan2(2.1, roofPanelWidth);
  const roofRise = Math.sin(roofAngle) * roofPanelWidth / 2;
  [[-1, roofAngle], [1, -roofAngle]].forEach(([side, rotation]) => {
    const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(roofPanelWidth, 0.28, roofDepth), roofMat);
    roofPanel.position.set(houseX + side * Math.cos(roofAngle) * roofPanelWidth / 2, wallHeight + roofRise + 0.05, houseZ);
    roofPanel.rotation.z = rotation;
    roofPanel.castShadow = true;
    scene.add(roofPanel);
  });
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, roofDepth), trimMat);
  ridge.position.set(houseX, wallHeight + roofRise + 0.08, houseZ);
  ridge.castShadow = true;
  scene.add(ridge);

  const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, 2.35, 0.12), new THREE.MeshStandardMaterial({color: 0x442b22, roughness: 0.8}));
  door.position.set(houseX, 1.18, frontZ + 0.02);
  door.castShadow = true;
  scene.add(door);
  const doorHandle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshStandardMaterial({color: 0xd4af37, metalness: 0.8, roughness: 0.3}));
  doorHandle.position.set(houseX + doorWidth / 2 - 0.3, 1.1, frontZ + 0.1);
  scene.add(doorHandle);

  // Finestre con telaio e croce centrale, piu curate della semplice lastra di vetro.
  // Le due finestre frontali vanno centrate su ciascuna delle due porzioni di
  // muro ai lati della porta: prima erano piazzate troppo vicine agli angoli
  // e, larghe com'erano, finivano per sporgere oltre lo spigolo della casa.
  const frontWallHalfSpan = (houseWidth - doorWidth) / 4; // centro di ogni tratto di muro frontale
  const windowSpots = [
    [leftX + frontWallHalfSpan, 1.7, frontZ - 0.06, 0],
    [rightX - frontWallHalfSpan, 1.7, frontZ - 0.06, 0],
    [leftX + 0.06, 1.7, houseZ + 1.5, Math.PI / 2],
    [rightX - 0.06, 1.7, houseZ - 1.5, Math.PI / 2]
  ];
  windowSpots.forEach(([x, y, z, rotY]) => {
    const group = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 0.08), glassMat);
    group.add(pane);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.25, 0.1), trimMat);
    frame.position.z = -0.02;
    group.add(frame);
    const pane2 = pane.clone();
    pane2.position.z = 0.02;
    group.add(pane2);
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.1), trimMat);
    group.add(mullionV);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.1), trimMat);
    group.add(mullionH);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.25), trimMat);
    sill.position.set(0, -0.62, 0.05);
    group.add(sill);
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(group);
  });

  // ---------------------------------------------------------------
  // INTERNO — layout a due zone nette, con margini di sicurezza dai muri:
  //   ZONA A (z < houseZ-1.4): camera da letto (tutta la larghezza)
  //   ZONA B (z > houseZ-1.0): soggiorno (destra) + cucina/pranzo (sinistra)
  // separate da una libreria bassa che funge da divisorio aperto, senza
  // bloccare il passaggio su nessuno dei due lati.
  // ---------------------------------------------------------------

  const dividerZ = houseZ - 1.2;
  const bookshelf = new THREE.Group();
  const shelfCarcass = makeBox(3.4, 1.5, 0.4, 0x5a3d28, {roughness: 0.7});
  bookshelf.add(shelfCarcass);
  for (let s = 1; s <= 2; s++) {
    const shelf = makeBox(3.2, 0.05, 0.38, 0x3f2a1c);
    shelf.position.set(0, -0.75 + s * 0.5, 0);
    bookshelf.add(shelf);
  }
  const bookColors = [0xb5443c, 0x3c6fb5, 0x3fae5c, 0xd9a536, 0x8a4fd9];
  for (let b = 0; b < 10; b++) {
    const book = makeBox(0.12, 0.5 + Math.random() * 0.2, 0.3, bookColors[b % bookColors.length]);
    book.position.set(-1.5 + b * 0.32, 0.5, 0.02);
    bookshelf.add(book);
  }
  bookshelf.position.set(houseX - 3.6, 0.75, dividerZ);
  scene.add(bookshelf);
  buildingsAABB.push({
    minX: houseX - 3.6 - 1.7, maxX: houseX - 3.6 + 1.7,
    minZ: dividerZ - 0.2, maxZ: dividerZ + 0.2
  });

  // --- Soggiorno (davanti, lato destro) ---
  const sofaGroup = new THREE.Group();
  const sofaBase = makeBox(2.6, 0.5, 1.0, 0x31556b, {roughness: 0.6});
  sofaBase.position.y = 0.25;
  sofaGroup.add(sofaBase);
  const sofaBack = makeBox(2.6, 0.7, 0.25, 0x2a4a5e, {roughness: 0.6});
  sofaBack.position.set(0, 0.6, -0.42);
  sofaGroup.add(sofaBack);
  [-1.15, 1.15].forEach(ax => {
    const arm = makeBox(0.3, 0.55, 1.0, 0x2a4a5e, {roughness: 0.6});
    arm.position.set(ax, 0.4, 0);
    sofaGroup.add(arm);
  });
  [-0.6, 0.6].forEach(cxOff => {
    const cushion = makeBox(0.9, 0.22, 0.85, 0x4d7d95, {roughness: 0.9});
    cushion.position.set(cxOff, 0.62, 0.02);
    sofaGroup.add(cushion);
  });
  sofaGroup.position.set(houseX + 3.5, 0, houseZ + 3.5);
  sofaGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(sofaGroup);

  const coffeeTable = new THREE.Group();
  const ctTop = makeBox(1.3, 0.08, 0.7, 0x4a3826, {roughness: 0.4});
  ctTop.position.y = 0.42;
  coffeeTable.add(ctTop);
  [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([lx, lz]) => {
    const leg = makeBox(0.08, 0.42, 0.08, 0x2e2213);
    leg.position.set(lx, 0.21, lz);
    coffeeTable.add(leg);
  });
  coffeeTable.position.set(houseX + 3.5, 0, houseZ + 1.8);
  coffeeTable.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(coffeeTable);

  const tvStand = makeBox(2.0, 0.5, 0.5, 0x3c2c1e, {roughness: 0.6});
  tvStand.position.set(houseX + 3.5, 0.25, houseZ + 5.0);
  scene.add(tvStand);
  const tv = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.08), new THREE.MeshStandardMaterial({color: 0x101820, emissive: 0x1c4b5c, emissiveIntensity: 0.9}));
  tv.position.set(houseX + 3.5, 1.05, houseZ + 4.95);
  scene.add(tv);

  const livingRug = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.025, 2.4), new THREE.MeshStandardMaterial({color: 0x9a5141, roughness: 1}));
  livingRug.position.set(houseX + 3.5, 0.12, houseZ + 2.6);
  scene.add(livingRug);

  // --- Cucina + tavolo da pranzo (davanti, lato sinistro) ---
  const kitchenGroup = new THREE.Group();
  const counter = makeBox(4.2, 1.0, 0.65, 0x45515a, {roughness: 0.5});
  counter.position.y = 0.5;
  kitchenGroup.add(counter);
  const countertop = makeBox(4.3, 0.08, 0.75, 0xe8e6df, {roughness: 0.3});
  countertop.position.y = 1.04;
  kitchenGroup.add(countertop);
  const backsplash = makeBox(4.2, 0.7, 0.06, 0xcfd6da, {roughness: 0.4});
  backsplash.position.set(0, 1.4, -0.34);
  kitchenGroup.add(backsplash);
  const upperCabinet = makeBox(4.2, 0.7, 0.35, 0x3c4a52, {roughness: 0.5});
  upperCabinet.position.set(0, 2.0, -0.15);
  kitchenGroup.add(upperCabinet);
  const sink = makeBox(0.7, 0.12, 0.45, 0xb9bec2, {metalness: 0.6, roughness: 0.3});
  sink.position.set(-1.2, 1.1, 0);
  kitchenGroup.add(sink);
  const faucet = makeBox(0.08, 0.4, 0.08, 0x888888, {metalness: 0.7, roughness: 0.3});
  faucet.position.set(-1.2, 1.3, -0.28);
  kitchenGroup.add(faucet);
  for (let stv = 0; stv < 4; stv++) {
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), new THREE.MeshStandardMaterial({color: 0x1a1a1a}));
    burner.position.set(1.0 + (stv % 2) * 0.35, 1.09, -0.15 + Math.floor(stv / 2) * 0.35);
    kitchenGroup.add(burner);
  }
  // Ruotata di 90°: la cucina prima "galleggiava" a metà stanza rivolta
  // verso il muro sbagliato; cosi lo schienale/pensili aderiscono davvero
  // al muro sinistro e il piano lavoro si sviluppa lungo la parete.
  const kitchenWallX = leftX + 0.6;
  const kitchenCenterZ = houseZ + 1.5;
  kitchenGroup.position.set(kitchenWallX, 0, kitchenCenterZ);
  kitchenGroup.rotation.y = Math.PI / 2;
  kitchenGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(kitchenGroup);
  buildingsAABB.push({
    minX: kitchenWallX - 0.4, maxX: kitchenWallX + 0.4,
    minZ: kitchenCenterZ - 2.2, maxZ: kitchenCenterZ + 2.2
  });

  const diningTable = new THREE.Group();
  const dtTop = makeBox(1.6, 0.08, 1.0, 0x5a4230, {roughness: 0.4});
  dtTop.position.y = 0.75;
  diningTable.add(dtTop);
  [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]].forEach(([lx, lz]) => {
    const leg = makeBox(0.09, 0.75, 0.09, 0x3a2b1e);
    leg.position.set(lx, 0.375, lz);
    diningTable.add(leg);
  });
  diningTable.position.set(houseX - 2.0, 0, houseZ + 2.5);
  diningTable.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(diningTable);

  [[-0.9, 0], [0.9, 0], [0, -0.75], [0, 0.75]].forEach(([ox, oz]) => {
    const chair = new THREE.Group();
    const seat = makeBox(0.42, 0.08, 0.42, 0x6d4a34);
    seat.position.y = 0.45;
    chair.add(seat);
    const back = makeBox(0.42, 0.5, 0.06, 0x6d4a34);
    back.position.set(0, 0.7, -0.18);
    chair.add(back);
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([lx, lz]) => {
      const leg = makeBox(0.05, 0.45, 0.05, 0x4a3324);
      leg.position.set(lx, 0.225, lz);
      chair.add(leg);
    });
    chair.position.set(houseX - 2.0 + ox, 0, houseZ + 2.5 + oz);
    chair.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(chair);
  });

  // --- Camera da letto (retro, tutta la zona z < houseZ-1.4) ---
  const bedGroup = new THREE.Group();
  const bedFrame = makeBox(2.3, 0.35, 3.1, 0x4a3324, {roughness: 0.7});
  bedFrame.position.y = 0.175;
  bedGroup.add(bedFrame);
  const mattress = makeBox(2.15, 0.28, 2.95, 0xf2ece1, {roughness: 0.9});
  mattress.position.y = 0.49;
  bedGroup.add(mattress);
  const blanket = makeBox(2.2, 0.12, 1.9, 0x6d3e56, {roughness: 0.85});
  blanket.position.set(0, 0.68, 0.45);
  bedGroup.add(blanket);
  [-0.55, 0.55].forEach(px => {
    const pillow = makeBox(0.6, 0.16, 0.4, 0xffffff, {roughness: 0.9});
    pillow.position.set(px, 0.7, -1.25);
    bedGroup.add(pillow);
  });
  const headboard = makeBox(2.3, 0.9, 0.12, 0x5a3d28, {roughness: 0.6});
  headboard.position.set(0, 0.8, -1.55);
  bedGroup.add(headboard);
  // Niente rotazione: testiera verso il muro posteriore, resta comodamente
  // dentro la zona notte senza invadere il soggiorno davanti al divisorio.
  bedGroup.position.set(houseX - 2.0, 0, houseZ - 3.6);
  bedGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(bedGroup);
  buildingsAABB.push({
    minX: houseX - 2.0 - 1.15, maxX: houseX - 2.0 + 1.15,
    minZ: houseZ - 3.6 - 1.55, maxZ: houseZ - 3.6 + 1.55
  });

  const nightstand = new THREE.Group();
  const nsBody = makeBox(0.6, 0.55, 0.5, 0x5a3d28, {roughness: 0.6});
  nsBody.position.y = 0.275;
  nightstand.add(nsBody);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.15, 10), new THREE.MeshStandardMaterial({color: 0x333333}));
  lampBase.position.y = 0.63;
  nightstand.add(lampBase);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 12, 1, true), new THREE.MeshStandardMaterial({color: 0xf0d3a0, emissive: 0xf0d3a0, emissiveIntensity: 0.5, side: THREE.DoubleSide}));
  lampShade.position.y = 0.9;
  nightstand.add(lampShade);
  nightstand.position.set(houseX - 0.4, 0, houseZ - 4.9);
  nightstand.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(nightstand);
  const nightLamp = new THREE.PointLight(0xffcf8a, 0.6, 5);
  nightLamp.position.set(houseX - 0.4, 1.0, houseZ - 4.9);
  scene.add(nightLamp);

  const wardrobe = new THREE.Group();
  const wardrobeBody = makeBox(1.6, 2.2, 0.6, 0x4a3324, {roughness: 0.6});
  wardrobeBody.position.y = 1.1;
  wardrobe.add(wardrobeBody);
  const wardrobeSeam = makeBox(0.04, 2.2, 0.62, 0x2e2213);
  wardrobeSeam.position.y = 1.1;
  wardrobe.add(wardrobeSeam);
  [-0.6, 0.6].forEach(hx => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), new THREE.MeshStandardMaterial({color: 0xd4af37, metalness: 0.7}));
    handle.rotation.z = Math.PI / 2;
    handle.position.set(hx, 1.1, 0.32);
    wardrobe.add(handle);
  });
  // Ruotato di 90°: prima "fluttuava" in mezzo alla stanza e clippava
  // comunque leggermente nel muro. Ora la schiena dell'armadio aderisce
  // al muro destro e lo sviluppo in larghezza corre lungo la parete,
  // spostato indietro per non incrociare la finestra laterale destra.
  const wardrobeWallX = rightX - 0.55;
  const wardrobeCenterZ = houseZ - 4.2;
  wardrobe.position.set(wardrobeWallX, 0, wardrobeCenterZ);
  wardrobe.rotation.y = -Math.PI / 2;
  wardrobe.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(wardrobe);
  buildingsAABB.push({
    minX: wardrobeWallX - 0.35, maxX: wardrobeWallX + 0.35,
    minZ: wardrobeCenterZ - 0.85, maxZ: wardrobeCenterZ + 0.85
  });

  const bedroomRug = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.025, 2.2), new THREE.MeshStandardMaterial({color: 0x5b4a7a, roughness: 1}));
  bedroomRug.position.set(houseX - 2.0, 0.12, houseZ - 3.4);
  scene.add(bedroomRug);

  // --- Dettagli decorativi ---
  const potGroup = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.35, 10), new THREE.MeshStandardMaterial({color: 0xa85c3a, roughness: 0.8}));
  pot.position.y = 0.175;
  potGroup.add(pot);
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({color: 0x2f7a2f, roughness: 0.9}));
  leaves.position.y = 0.55;
  leaves.scale.set(0.8, 1.4, 0.8);
  potGroup.add(leaves);
  potGroup.position.set(rightX - 0.9, 0, frontZ - 0.9);
  potGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(potGroup);

  // Quadri: ognuno è un piccolo gruppo, così cornice+tela ruotano insieme
  // e restano incollati alla parete giusta invece di "sporgere" fuori casa.
  const wallArtSpecs = [
    {x: houseX + 1.6, z: backZ + 0.03, w: 0.9, h: 1.2, rotY: 0},          // muro posteriore
    {x: leftX + 0.03, z: houseZ + 3.5, w: 1.0, h: 0.7, rotY: Math.PI / 2} // muro sinistro, sopra la zona pranzo
  ];
  wallArtSpecs.forEach(spec => {
    const group = new THREE.Group();
    const frame = makeBox(spec.w + 0.08, spec.h + 0.08, 0.05, 0x3c2c1e, {roughness: 0.6});
    group.add(frame);
    const art = makeBox(spec.w, spec.h, 0.03, 0x7a9bb5, {roughness: 0.9});
    art.position.z = 0.03;
    group.add(art);
    group.position.set(spec.x, 1.7, spec.z);
    group.rotation.y = spec.rotY;
    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(group);
  });

  const ceilingFixtureCord = makeBox(0.04, 0.4, 0.04, 0x222222, {emissive: 0x000000});
  ceilingFixtureCord.position.set(houseX, wallHeight - 0.25, houseZ);
  scene.add(ceilingFixtureCord);
  const ceilingFixture = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 16, 1, true), new THREE.MeshStandardMaterial({color: 0xf0d3a0, emissive: 0xffdca0, emissiveIntensity: 0.7, side: THREE.DoubleSide}));
  ceilingFixture.position.set(houseX, wallHeight - 0.55, houseZ);
  scene.add(ceilingFixture);

  const interiorLight = new THREE.PointLight(0xffd9a0, 1.5, 20);
  interiorLight.position.set(houseX, wallHeight - 0.6, houseZ);
  scene.add(interiorLight);
  const kitchenLight = new THREE.PointLight(0xfff2d8, 0.7, 8);
  kitchenLight.position.set(kitchenWallX + 0.5, wallHeight - 0.3, kitchenCenterZ);
  scene.add(kitchenLight);

  // --- Poster "STAR CITY" in alto sul muro destro del soggiorno ---
  const posterGroup = new THREE.Group();
  const posterFrame = makeBox(1.3, 1.75, 0.05, 0x2a2a2e, {roughness: 0.6});
  posterGroup.add(posterFrame);
  const posterFace = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.6, 0.03),
    new THREE.MeshStandardMaterial({map: createStarCityPosterTexture(), roughness: 0.75})
  );
  posterFace.position.z = 0.04;
  posterGroup.add(posterFace);
  posterGroup.position.set(rightX - 0.03, 2.15, houseZ + 3.0);
  posterGroup.rotation.y = -Math.PI / 2;
  posterGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(posterGroup);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 10), new THREE.MeshStandardMaterial({color: 0xb39a73, roughness: 1}));
  path.rotation.x = -Math.PI / 2;
  path.position.set(houseX, 0.04, frontZ + 5);
  scene.add(path);

  addTree(cx - 11, cz + 10);
  addTree(cx + 13, cz + 10);
  addTree(cx + 13, cz - 10);
}

function addTree(x, z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 8), new THREE.MeshStandardMaterial({color: 0x6b4423}));
  trunk.position.set(x, 1.5, z); trunk.castShadow = true;
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 10), new THREE.MeshStandardMaterial({color: 0x2f7a2f}));
  leaves.position.set(x, 4.2, z); leaves.castShadow = true;
  scene.add(trunk); scene.add(leaves);
}

function buildWater() {
  const waterMat = new THREE.MeshStandardMaterial({color: 0x1560a8, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.9});
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(-CITY_HALF - 220, -0.3, 0);
  scene.add(water);
}

// ---------------------------------------------------------------------
// CAR
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
