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
      const isDowntown = (Math.abs(i - BLOCKS / 2) < 2 && Math.abs(j - BLOCKS / 2) < 2);

      const lotSize = BLOCK_SIZE - ROAD_WIDTH - 6;

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
