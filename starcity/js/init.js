// INIT
// ---------------------------------------------------------------------
function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.getElementById('game-container').appendChild(renderer.domElement);

  hemi = new THREE.HemisphereLight(0x99bbff, 0x223311, 0.65);
  scene.add(hemi);

  sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);

  sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(8, 16, 16),
    new THREE.MeshBasicMaterial({color: 0xfff2c0})
  );
  scene.add(sunMesh);

  buildCity();
  buildStarField();
  buildWater();
  spawnPedestrians(28);
  spawnCoins(22);
  spawnMissionMarker();

  buildCar();
  buildPlayer();
  spawnCivilianCars(22);

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key === 'escape' && running) {
      togglePause();
      return;
    }
    keys[key] = true;
    handleKeyDown(e);
  });
  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    keys[key] = false;
  });
  setupMouseLook();
  setupTouchControls();

  animate();
}

// ---------------------------------------------------------------------
