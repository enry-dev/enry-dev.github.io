// INIT
// ---------------------------------------------------------------------
function spawnPoliceCarsInFront(count) {
  const target = mode === 'car' ? car : player;
  const heading = mode === 'car' ? car.rotation.y : yaw;
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const sideX = Math.cos(heading);
  const sideZ = -Math.sin(heading);
  let spawned = 0;

  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / 3);
    const column = index % 3 - 1;
    const frontDistance = 12 + row * 6;
    const sideOffset = column * 5.5;
    const beforeCount = policeCars.length;

    spawnPoliceCar(attempt => {
      const retry = Math.max(0, attempt - 1);
      const retryRow = attempt === 0 ? 0 : Math.floor(retry / 3) + 1;
      const retryColumn = attempt === 0 ? 0 : retry % 3 - 1;
      const distance = frontDistance + retryRow * 5;
      const lateralOffset = sideOffset + retryColumn * 2.8;
      return {
        x: target.position.x + forwardX * distance + sideX * lateralOffset,
        z: target.position.z + forwardZ * distance + sideZ * lateralOffset,
        rot: heading + Math.PI
      };
    });

    if (policeCars.length > beforeCount) spawned++;
  }

  return spawned;
}

function spawnCivilCarsInFront(count) {
  const target = mode === 'car' ? car : player;
  const heading = mode === 'car' ? car.rotation.y : yaw;
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const sideX = Math.cos(heading);
  const sideZ = -Math.sin(heading);
  const beforeCount = worldVehicles.length;

  spawnCivilianCars(count, (attempt, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3 - 1;
    const retry = Math.max(0, attempt - 1);
    const retryRow = attempt === 0 ? 0 : Math.floor(retry / 3) + 1;
    const retryColumn = attempt === 0 ? 0 : retry % 3 - 1;
    const distance = 12 + row * 6 + retryRow * 5;
    const sideOffset = column * 5.5 + retryColumn * 2.8;
    return {
      x: target.position.x + forwardX * distance + sideX * sideOffset,
      z: target.position.z + forwardZ * distance + sideZ * sideOffset,
      rot: heading
    };
  });

  return worldVehicles.length - beforeCount;
}

function executeConsoleCommand(command) {
  const parts = command.trim().split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const objectName = parts[1] && parts[1].toLowerCase();

  if (commandName === '/spawn' && (objectName === 'policecar' || objectName === 'civilcar')) {
    const count = Number(parts[2]);
    if (parts.length !== 3 || !/^\d+$/.test(parts[2]) || !Number.isInteger(count) || count < 1 || count > 20) {
      showToast(`Uso: /spawn ${objectName} <numero> (1-20)`);
      return;
    }

    const spawned = objectName === 'policecar' ? spawnPoliceCarsInFront(count) : spawnCivilCarsInFront(count);
    if (spawned === count) {
      showToast(`Spawnati ${spawned} ${objectName === 'policecar' ? 'volanti' : 'veicoli civili'} davanti a te`);
    } else if (spawned > 0) {
      showToast(`Spawnati ${spawned} su ${count}: spazio insufficiente`);
    } else {
      showToast('Impossibile spawnare veicoli: spazio insufficiente');
    }
    return;
  }

  if (commandName === '/option' && objectName === 'stars') {
    const stars = Number(parts[2]);
    if (parts.length !== 3 || !/^\d+$/.test(parts[2]) || !Number.isInteger(stars) || stars > MAX_COMMAND_STARS) {
      showToast(`Uso: /option stars <numero> (0-${MAX_COMMAND_STARS})`);
      return;
    }

    state.wanted = stars;
    lastCrimeTime = clock.elapsedTime;
    showToast(`Livello ricercato impostato a ${stars} stelle`);
    return;
  }

  if (commandName === '/option' && objectName === 'time') {
    const timeOfDay = parts[2] && parts[2].toLowerCase();
    if (parts.length !== 3 || (timeOfDay !== 'night' && timeOfDay !== 'day')) {
      showToast('Uso: /option time <night o day>');
      return;
    }

    dayTime = timeOfDay === 'night' ? 0.75 : 0.25;
    showToast(`Ora impostata: ${timeOfDay === 'night' ? 'notte' : 'giorno'}`);
    return;
  }

  if (commandName === '/vehicle' && objectName === 'velocity') {
    const maxVelocity = Number(parts[2]);
    if (parts.length !== 3 || !/^\d+$/.test(parts[2]) || !Number.isInteger(maxVelocity) || maxVelocity < 1 || maxVelocity > 1000) {
      showToast('Uso: /vehicle velocity <velocita max 1000>');
      return;
    }

    car.userData.commandMaxKmh = maxVelocity;
    showToast(`Velocita massima impostata a ${maxVelocity} KM/H`);
    return;
  }

  if (commandName === '/vehicle' && objectName === 'fly') {
    const setting = parts[2] && parts[2].toLowerCase();
    if (parts.length !== 3 || (setting !== 'enable' && setting !== 'disable')) {
      showToast('Uso: /vehicle fly <enable o disable>');
      return;
    }

    car.userData.flyEnabled = setting === 'enable';
    if (!car.userData.flyEnabled) car.position.y = 0;
    showToast(setting === 'enable' ? 'Volo attivo: SPAZIO sale, SHIFT scende' : 'Volo disattivato');
    return;
  }

  showToast('Comando non riconosciuto');
}

function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.shadowMap.enabled = !isMobile;
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
  const commandInput = document.getElementById('command-input');

  if (commandInput) {
    commandInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const value = commandInput.value.trim();
        if (value) {
          executeConsoleCommand(value);
          commandInput.value = '';
        }
        commandInput.blur();
      }
      if (e.key === 'Escape') {
        commandInput.blur();
      }
    });
  }

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (document.activeElement === commandInput) {
      if (key === 'escape') {
        commandInput.blur();
      }
      return;
    }
    if (key === 'tab') {
      e.preventDefault();
      if (commandInput) {
        commandInput.focus();
        commandInput.select();
      }
      return;
    }
    if (key === 'escape' && running) {
      togglePause();
      return;
    }
    keys[key] = true;
    handleKeyDown(e);
  });
  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (document.activeElement === commandInput) return;
    keys[key] = false;
  });
  setupMouseLook();
  setupTouchControls();

  animate();

  window.editorScene = scene;
  window.editorCamera = camera;
  window.editorRenderer = renderer;
}

// ---------------------------------------------------------------------
