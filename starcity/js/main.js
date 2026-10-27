// UPDATE LOOP PIECES
// ---------------------------------------------------------------------
const daySkyColor = new THREE.Color(0x8ec9ff);
const nightSkyColor = new THREE.Color(0x050515);
const currentSkyColor = new THREE.Color();
const nearbyHeadlightVehicles = [];
// Numero di veicoli vicini che possono avere il faro "reale" (luce dinamica)
// acceso contemporaneamente. Tenerlo basso (4-6) perché ogni luce attiva ha
// un costo per-pixel; oltre le ~8-10 su hardware modesto si può ricominciare
// a percepire lag. Le ombre restano disattivate apposta (vedi sotto).
const MAX_ACTIVE_HEADLIGHTS = 5;
const LOW_PERF_MOBILE = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
let headlightsWarmed = false;

function getVehicleDisplaySpeedFactor(vehicleType) {
  if (vehicleType === 'supercar') return 280 / 52;
  if (vehicleType === 'closedTruck' || vehicleType === 'truck') return 80 / 15;
  if (vehicleType === 'police') return 120 / 22;
  return 130 / 24;
}

function getDisplayedSpeedKmh(speedValue, vehicleType) {
  const v = Math.abs(speedValue);
  return Math.round(v * getVehicleDisplaySpeedFactor(vehicleType));
}

function getVehicleDisplayMaxKmh(vehicle) {
  if (!vehicle || !vehicle.userData) return 130;
  if (Number.isFinite(vehicle.userData.commandMaxKmh)) return vehicle.userData.commandMaxKmh;
  const vehicleType = vehicle.userData.vehicleType || 'standard';
  if (vehicleType === 'supercar') return 280;
  if (vehicleType === 'closedTruck' || vehicle.userData.isTruck) return 80;
  if (vehicle.userData.isPolice) return 120;
  return 130;
}

// --- FIX LAG FARI NOTTURNI ---
// Prima, il ricalcolo colore fari + distanza + sort veniva fatto per OGNI
// veicolo, OGNI frame (fino a 60 volte al secondo). Ora:
// 1) il colore dei fari (bulb) si aggiorna solo quando cambia giorno/notte
// 2) la selezione dei veicoli vicini + il sort vengono throttlati
let cachedIsNight = null;
let headlightUpdateTimer = 0;
const HEADLIGHT_UPDATE_INTERVAL = 0.15; // ricalcola ~6-7 volte al secondo invece di 60

function updateCar(dt) {
  const defaultAccel = 14, defaultReverseMax = -12, friction = 0.98, baseBrakeForce = 22, turnRate = 1.9;

  if (car.userData.isWrecked) {
    carSpeed = 0;
    document.getElementById('speed-val').textContent = '0';
    return;
  }

  const vehicleType = car.userData.vehicleType || 'standard';
  const isTruck = vehicleType === 'closedTruck' || car.userData.isTruck;
  const isSupercar = vehicleType === 'supercar';

  const accelBase = isTruck ? 18 : isSupercar ? 42 : defaultAccel;
  const reverseBase = isTruck ? -12 : isSupercar ? -28 : defaultReverseMax;
  const maxBaseSpeed = isTruck ? PLAYER_TRUCK_MAX_SPEED : isSupercar ? PLAYER_SUPERCAR_MAX_SPEED : PLAYER_BASE_MAX_SPEED;

  // più la carrozzeria è ammaccata, più il motore rende poco: accelerazione,
  // velocità massima e retromarcia scendono tutte in base al danno accumulato
  const dmgFactor = vehicleSpeedMult(car);
  const accel = accelBase * dmgFactor;
  const maxSpeed = Number.isFinite(car.userData.commandMaxKmh)
    ? car.userData.commandMaxKmh / getVehicleDisplaySpeedFactor(vehicleType) * dmgFactor
    : maxBaseSpeed * dmgFactor;
  const reverseMax = reverseBase * dmgFactor;
  const brakeForce = baseBrakeForce;

  if (keys['w']) carSpeed += accel * touchMoveIntensity * dt;
  else if (keys['s']) carSpeed -= brakeForce * touchMoveIntensity * dt;
  else carSpeed *= Math.pow(friction, dt * 60);

  const isFlying = car.userData.flyEnabled === true;
  if (isFlying) {
    if (keys[' ']) car.position.y = Math.min(100, car.position.y + 12 * dt);
    else if (keys['shift']) car.position.y = Math.max(0, car.position.y - 12 * dt);
  } else if (keys[' ']) {
    carSpeed *= Math.pow(0.9, dt * 60);
  }

  carSpeed = Math.max(reverseMax, Math.min(maxSpeed, carSpeed));

  const speedFactor = Math.min(1, Math.abs(carSpeed) / 8);
  if (keys['a']) car.rotation.y += turnRate * dt * speedFactor;
  if (keys['d']) car.rotation.y -= turnRate * dt * speedFactor;

  const dir = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
  const nx = car.position.x + dir.x * carSpeed * dt;
  const nz = car.position.z + dir.z * carSpeed * dt;

  if (!collidesBuildingForVehicle(car, nx, nz)) {
    car.position.x = nx;
    car.position.z = nz;
  } else {
    // Gli urti contro i palazzi usano lo stesso danno permanente degli scontri
    // fra veicoli: integrita e velocita massima scendono insieme.
    if (Math.abs(carSpeed) > 7) playCrashSound(Math.abs(carSpeed));
    registerBuildingImpact(car, Math.abs(carSpeed));
    carSpeed *= -0.3;
  }

  // limiti mappa
  const lim = CITY_HALF + 15;
  car.position.x = Math.max(-lim - 180, Math.min(lim, car.position.x));
  car.position.z = Math.max(-lim, Math.min(lim, car.position.z));

  car.userData.wheels.forEach(w => w.rotation.x -= carSpeed * dt * 2);

  // investimento pedoni
  if (Math.abs(carSpeed) > 6 && car.position.y <= 2.5) {
    for (let i = pedestrians.length - 1; i >= 0; i--) {
      if (dist2D(car.position, pedestrians[i].mesh.position) < 1.45) {
        spawnDeathAnimation(pedestrians[i].mesh);
        scene.remove(pedestrians[i].mesh);
        pedestrians.splice(i, 1);
        addWanted(1);
        playKillSound();
        showToast('Hai investito un pedone! +ricercato');
      }
    }
  }

  const speedKmh = getDisplayedSpeedKmh(carSpeed, vehicleType);
  const speedGaugeFill = document.getElementById('speed-gauge-fill');
  const capKmh = getVehicleDisplayMaxKmh(car);
  const speedPct = Math.min(100, (speedKmh / Math.max(1, capKmh)) * 100);
  if (speedGaugeFill) speedGaugeFill.style.width = speedPct + '%';
  document.getElementById('speed-val').textContent = speedKmh;

  // missione: raggiungi il marker
  if (missionMarker && dist2D(car.position, missionMarker.position) < 3.5) {
    state.money += 200;
    showToast('Consegna completata! +$200');
    spawnMissionMarker();
  }
}

function updatePlayerFoot(dt) {
  const moveSpeed = keys['shift'] ? 7 : 4;
  player.rotation.y = yaw; // il personaggio guarda sempre dove punta il mirino

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));

  let mvx = 0, mvz = 0;
  if (keys['w']) {mvx += forward.x; mvz += forward.z;}
  if (keys['s']) {mvx -= forward.x; mvz -= forward.z;}
  if (keys['a']) {mvx += right.x; mvz += right.z;}
  if (keys['d']) {mvx -= right.x; mvz -= right.z;}

  const len = Math.sqrt(mvx * mvx + mvz * mvz);
  if (len > 0) {mvx /= len; mvz /= len;}

  const mv = slideMove(player.position.x, player.position.z, mvx * moveSpeed * touchMoveIntensity * dt, mvz * moveSpeed * touchMoveIntensity * dt, 0.6);
  player.position.x = mv.x; player.position.z = mv.z;
  animateHumanoid(player, len * moveSpeed, dt);
  document.getElementById('speed-val').textContent = len > 0 ? Math.round(moveSpeed * 3.6) : 0;
}

function updateCoins(dt) {
  const target = mode === 'car' ? car.position : player.position;
  coins.forEach(c => {
    c.rotation.z += dt * 3;
    if (dist2D(target, c.position) < 2.2) {
      const val = 10 + Math.floor(Math.random() * 40);
      state.money += val;
      playCoinPickupSound();
      respawnCoin(c);
      showToast('+ $' + val);
    }
  });
}

function updatePedestrians(dt) {
  pedestrians.forEach(p => {
    p.timer -= dt;
    if (p.timer <= 0) {
      p.dir = Math.random() * Math.PI * 2;
      p.timer = 2 + Math.random() * 4;
    }
    const mv = slideMove(p.mesh.position.x, p.mesh.position.z, Math.sin(p.dir) * p.speed * dt, Math.cos(p.dir) * p.speed * dt, 0.8);
    if (mv.blocked) {
      const sidewalk = randomSidewalkPoint();
      p.dir = sidewalk.dir + (Math.random() < 0.5 ? 0 : Math.PI);
      p.timer = 1.2;
    }
    if (Math.abs(mv.x) < CITY_HALF + 15 && Math.abs(mv.z) < CITY_HALF + 15) {
      p.mesh.position.x = mv.x; p.mesh.position.z = mv.z;
      p.mesh.rotation.y = p.dir;
    }
    animateHumanoid(p.mesh, p.speed, dt);
  });
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].life -= dt;
    if (bullets[i].life <= 0) {
      scene.remove(bullets[i].mesh);
      bullets.splice(i, 1);
    }
  }
}

function updateWantedDecay() {
  if (state.wanted > 0 && clock.elapsedTime - lastCrimeTime > 9) {
    state.wanted -= 1;
    lastCrimeTime = clock.elapsedTime + 4; // spazia i decadimenti successivi
  }
}

function updateCamera(dt) {
  const target = mode === 'car' ? car : player;
  const dist = mode === 'car' ? 8.5 : 4.6;
  const height = mode === 'car' ? 1.7 : 1.7;

  // direzione di mira calcolata da yaw/pitch (mouse look) — usata anche per sparare
  aimDir.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ).normalize();

  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(aimDir, worldUp).normalize();

  const pivot = target.position.clone();
  pivot.y += height;

  // scarto laterale "da spalla": la camera si sposta di lato così il personaggio
  // non ti blocca più la visuale del mirino, come nelle sparatutto in 3ª persona
  const shoulderOffset = mode === 'car' ? 0.15 : 0.9;
  const basePos = pivot.clone()
    .addScaledVector(right, shoulderOffset)
    .addScaledVector(aimDir, -dist);

  camera.position.lerp(basePos, Math.min(1, dt * 10));

  // guarda avanti parallelamente alla direzione di mira, non torna verso il personaggio
  const lookAt = camera.position.clone().addScaledVector(aimDir, 20);
  camera.lookAt(lookAt);

  // zoom centrale quando si mira: riduce il campo visivo (effetto mirino/binocolo)
  const targetFov = aiming ? 32 : 65;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 9);
  camera.updateProjectionMatrix();
}

function updateHUD() {
  document.getElementById('health-fill').style.width = Math.max(0, state.health) + '%';
  document.getElementById('money').textContent = '$ ' + Math.floor(state.money).toLocaleString('it-IT');
  let starsHTML = '';
  for (let i = 0; i < Math.max(MAX_STARS, state.wanted); i++) {
    starsHTML += `<span class="${i < state.wanted ? 'star-on' : 'star-off'}">★</span>`;
  }
  document.getElementById('stars').innerHTML = starsHTML;
  const gameMinutes = Math.floor(((dayTime * 24 + 6) % 24) * 60);
  const gameHours = Math.floor(gameMinutes / 60);
  const minutePart = gameMinutes % 60;
  document.getElementById('game-time').textContent = `${String(gameHours).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}`;
  updateAmmoHUD();

  const speedWrap = document.getElementById('speed-wrap');
  const carStatus = document.getElementById('car-status');
  if (mode === 'car') {
    speedWrap.style.display = 'block';
    carStatus.style.display = 'block';
    const pct = Math.max(0, vehicleSpeedMult(car) * 100);
    const vehicleType = car.userData.vehicleType || 'standard';
    const maxSpeed = getVehicleDisplayMaxKmh(car);
    document.getElementById('car-health-fill').style.width = pct + '%';
    document.getElementById('car-health-pct').textContent = Math.round(pct) + '%';
    document.getElementById('car-max-speed').textContent = maxSpeed + ' KM/H';
  } else {
    speedWrap.style.display = 'none';
    carStatus.style.display = 'none';
  }

  updateDebugPanel();
}

let debugLastTime = performance.now();
let debugFrameCount = 0;
let debugFps = 0;
let debugFrameMs = 0;

function updateDebugPanel() {
  const now = performance.now();
  debugFrameCount++;
  const elapsed = now - debugLastTime;
  if (elapsed >= 500) {
    debugFps = Math.round(debugFrameCount * 1000 / elapsed);
    debugFrameMs = elapsed / debugFrameCount;
    debugFrameCount = 0;
    debugLastTime = now;
  }

  const target = mode === 'car' ? car : player;
  const x = target ? target.position.x.toFixed(1) : '0.0';
  const z = target ? target.position.z.toFixed(1) : '0.0';
  const speed = mode === 'car' ? getDisplayedSpeedKmh(carSpeed, car.userData.vehicleType || 'standard') : 0;
  const heading = target ? Math.round(THREE.MathUtils.radToDeg(target.rotation.y)) : 0;
  const cameraFov = Math.round(camera.fov);
  const daylight = Math.round(Math.max(0, Math.sin(dayTime * Math.PI * 2)) * 100);
  const vehicleState = car && car.userData.isWrecked ? 'WRECKED' : 'READY';
  document.getElementById('debug-readout').textContent =
    `FPS    ${debugFps || '--'}  ${debugFrameMs ? debugFrameMs.toFixed(1) : '--'} MS\n` +
    `MODE   ${mode.toUpperCase()}  HEAD ${heading}\n` +
    `POS    X ${x} / Z ${z}\n` +
    `SPEED  ${speed} KM/H  CAR ${vehicleState}\n` +
    `HEALTH ${Math.round(state.health)}\n` +
    `WANTED ${state.wanted}/${Math.max(MAX_STARS, state.wanted)}  AIM ${aiming ? 'ON' : 'OFF'}\n` +
    `CAMERA FOV ${cameraFov}  LOCK ${pointerLocked ? 'ON' : 'OFF'}\n` +
    `WORLD  DAY ${daylight}%  BUILD ${buildingsAABB.length}\n` +
    `ACTORS P:${pedestrians.length} C:${policeCars.length} V:${worldVehicles.length}\n` +
    `FX     BULLETS ${bullets.length}  COINS ${coins.length}`;
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {el.style.opacity = 0;}, 1800);
}

function updateDayNight(dt) {
  dayTime += dt * 0.004; // ciclo giorno/notte rallentato
  if (dayTime > 1) dayTime -= 1;
  const angle = dayTime * Math.PI * 2;
  const radius = 300;
  sun.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius + 40, 60);
  sun.target.position.set(0, 0, 0);
  sunMesh.position.copy(sun.position);

  const daylight = Math.max(0, Math.sin(angle));
  sun.intensity = 0.15 + daylight * 1.1;
  hemi.intensity = 0.25 + daylight * 0.5;

  currentSkyColor.copy(nightSkyColor).lerp(daySkyColor, daylight);
  scene.background = currentSkyColor;
  if (!scene.fog) scene.fog = new THREE.Fog(currentSkyColor, 60, 320);
  else scene.fog.color.copy(currentSkyColor);
  updateStarField(daylight, clock.elapsedTime);

  // --- FIX LAG FARI ---
  // headlightIntensity si aggiorna comunque ogni frame (per transizione fluida),
  // ma il resto (colore bulb, distanza, sort) è throttlato/condizionato.
  if (LOW_PERF_MOBILE) {
    worldVehicles.forEach(vehicle => {
      if (vehicle.userData.headlight) {
        vehicle.userData.headlight.visible = false;
        vehicle.userData.headlight.intensity = 0;
      }
    });
    policeCars.forEach(unit => {
      if (unit.mesh.userData.headlight) {
        unit.mesh.userData.headlight.visible = false;
        unit.mesh.userData.headlight.intensity = 0;
      }
    });
    sunMesh.material.color.setHex(daylight > 0.15 ? 0xfff2c0 : 0xdfe6ff);
    return;
  }

  const headlightIntensity = Math.max(0, 1 - daylight * 3.2) * 1.8;
  const lightTarget = mode === 'car' ? car.position : player.position;

  const isNight = daylight < 0.35;
  const bulbColorNeedsUpdate = cachedIsNight !== isNight;
  if (bulbColorNeedsUpdate) cachedIsNight = isNight;

  headlightUpdateTimer += dt;
  const shouldRecomputeHeadlights = headlightUpdateTimer >= HEADLIGHT_UPDATE_INTERVAL || bulbColorNeedsUpdate;
  if (shouldRecomputeHeadlights) headlightUpdateTimer = 0;

  if (shouldRecomputeHeadlights) nearbyHeadlightVehicles.length = 0;

  function processVehicleHeadlight(vehicle) {
    // il colore del vetro/lampadina cambia solo al passaggio giorno<->notte,
    // non 60 volte al secondo
    if (bulbColorNeedsUpdate) {
      vehicle.userData.headlightBulbs?.forEach(bulb => {
        bulb.material.color.setHex(isNight ? 0xfff7cc : 0x77736a);
      });
    }
    if (vehicle.userData.headlight) {
      vehicle.userData.headlight.intensity = headlightIntensity;
      if (shouldRecomputeHeadlights) {
        vehicle.userData.headlight.visible = false;
        if (headlightIntensity > 0.01 && dist2D(vehicle.position, lightTarget) < 85) {
          nearbyHeadlightVehicles.push(vehicle);
        }
      }
    }
  }

  worldVehicles.forEach(processVehicleHeadlight);
  policeCars.forEach(unit => processVehicleHeadlight(unit.mesh));

  if (shouldRecomputeHeadlights) {
    nearbyHeadlightVehicles.sort((a, b) => {
      if (a === car) return -1;
      if (b === car) return 1;
      return a.position.distanceToSquared(lightTarget) - b.position.distanceToSquared(lightTarget);
    });
    if (!headlightsWarmed) {
      let warmed = 0;
      worldVehicles.forEach(vehicle => {
        if (warmed < MAX_ACTIVE_HEADLIGHTS && vehicle.userData.headlight) {
          vehicle.userData.headlight.visible = true;
          vehicle.userData.headlight.castShadow = false; // le ombre sono il costo vero, mai attivarle qui
          warmed++;
        }
      });
      headlightsWarmed = true;
    }
    for (let i = 0; i < Math.min(MAX_ACTIVE_HEADLIGHTS, nearbyHeadlightVehicles.length); i++) {
      const activeLight = nearbyHeadlightVehicles[i].userData.headlight;
      activeLight.visible = true;
      activeLight.castShadow = false; // sicurezza: con più luci attive insieme, le ombre farebbero laggare
    }
  }

  sunMesh.material.color.setHex(daylight > 0.15 ? 0xfff2c0 : 0xdfe6ff);
}

function drawMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#0b3d1a';
  ctx.fillRect(0, 0, W, H);

  const scale = W / (BLOCKS * BLOCK_SIZE * 1.4);
  const target = mode === 'car' ? car.position : player.position;

  function toMap(x, z) {
    return [W / 2 + (x - target.x) * scale, H / 2 + (z - target.z) * scale];
  }

  // strade
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= BLOCKS; i++) {
    const pos = -CITY_HALF + i * BLOCK_SIZE;
    let [x1, y1] = toMap(pos, -CITY_HALF); let [x2, y2] = toMap(pos, CITY_HALF);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    [x1, y1] = toMap(-CITY_HALF, pos);[x2, y2] = toMap(CITY_HALF, pos);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  // mission marker
  if (missionMarker) {
    const [mx, my] = toMap(missionMarker.position.x, missionMarker.position.z);
    ctx.fillStyle = '#ffce33';
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
  }

  // polizia
  ctx.fillStyle = '#3b7bff';
  policeCars.forEach(p => {
    const [x, y] = toMap(p.mesh.position.x, p.mesh.position.z);
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = '#ff3344';
  policeHelicopters.forEach(helicopter => {
    const [x, y] = toMap(helicopter.position.x, helicopter.position.z);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  });

  // player (freccia verde al centro)
  const heading = mode === 'car' ? car.rotation.y : player.rotation.y;
  const directionX = Math.sin(heading);
  const directionY = Math.cos(heading);
  const sideX = directionY;
  const sideY = -directionX;
  const centerX = W / 2;
  const centerY = H / 2;
  ctx.fillStyle = '#33ff77';
  ctx.beginPath();
  ctx.moveTo(centerX + directionX * 8, centerY + directionY * 8);
  ctx.lineTo(centerX - directionX * 5 + sideX * 5, centerY - directionY * 5 + sideY * 5);
  ctx.lineTo(centerX - directionX * 5 - sideX * 5, centerY - directionY * 5 - sideY * 5);
  ctx.closePath(); ctx.fill();

  // bordo cerchio
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.stroke();
}

// ---------------------------------------------------------------------
// BUSTED / DANNO
// ---------------------------------------------------------------------
function doArrest() {
  state.money = Math.floor(state.money / 2);
  state.health = 100;
  state.wanted = 0;
  policeCars.forEach(p => removePoliceUnit(p));
  policeCars = [];
  car.position.copy(CAR_SPAWN); car.rotation.y = 0; carSpeed = 0;
  player.position.copy(PLAYER_HOME); yaw = Math.PI; pitch = 0.08;
  mode = 'foot'; updatePlayerVisibility();
  document.getElementById('mode-badge').textContent = 'A PIEDI';

  const overlay = document.getElementById('busted-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => {overlay.style.display = 'none';}, 1800);
}

function checkBusted() {
  if (state.health <= 0) {
    doArrest();
  }
}

// ---------------------------------------------------------------------
// MAIN LOOP
// ---------------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (!running || paused) {renderer.render(scene, camera); return;}

  updateDayNight(dt);

  if (mode === 'car') updateCar(dt);
  else updatePlayerFoot(dt);

  updateAutoFire(dt);
  worldVehicles.forEach(v => updateVehicleDoors(v, dt));
  updateTraffic(dt);
  updatePedestrians(dt);
  updatePolice(dt);
  updatePoliceHelicopters(dt);
  updateDeathAnimations(dt);
  resolveVehicleCollisions(dt);
  updateVehicleDamageEffects(dt);
  removeDestroyedVehicles();
  updateCoins(dt);
  updateBullets(dt);
  updateWantedDecay();
  updateSiren(dt);
  updateCamera(dt);
  updateHUD();
  drawMinimap();
  checkBusted();

  renderer.render(scene, camera);
}

function syncPauseButton() {
  const pauseButton = document.getElementById('pause-button');
  if (!pauseButton) return;
  pauseButton.textContent = paused ? 'RIPRENDI' : 'PAUSA';
}

function togglePause(forceState) {
  if (!running) return;
  paused = typeof forceState === 'boolean' ? forceState : !paused;
  const overlay = document.getElementById('pause-overlay');
  overlay.classList.toggle('visible', paused);
  document.body.classList.toggle('paused', paused);
  syncPauseButton();

  if (paused) {
    aiming = false;
    mouseHeld = false;
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('crosshair').classList.remove('aiming');
    document.getElementById('scope-vignette').classList.remove('active');
    updatePlayerVisibility();
  } else {
    if (renderer && document.pointerLockElement !== renderer.domElement && renderer.domElement.requestPointerLock) {
      const lockRequest = renderer.domElement.requestPointerLock();
      if (lockRequest && lockRequest.catch) lockRequest.catch(() => {});
    }
  }
}

function exitToMenu() {
  paused = false;
  running = false;
  if (document.pointerLockElement) document.exitPointerLock();
  window.location.reload();
}

function enterMobileFullscreen() {
  const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
  if (!isMobile || document.fullscreenElement) return;
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return;
  Promise.resolve(request.call(root)).then(() => {
    if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
  }).catch(() => {});
}

// ---------------------------------------------------------------------
// START
// ---------------------------------------------------------------------
init();

const startButton = document.getElementById('start-btn');
startButton.addEventListener('click', () => {
  enterMobileFullscreen();
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.body.classList.add('playing');
  updateDayNight(0);
  renderer.render(scene, camera);
  running = true;
  paused = false;
  initAudio();
  GameAudio.resume();
  updateCrosshairShape(WEAPONS[currentWeapon].crosshair);
  setTimeout(() => {
    document.getElementById('controls-hint').classList.add('is-hidden');
  }, 4000);
});

document.getElementById('resume-btn').addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  togglePause(false);
});

document.getElementById('pause-button').addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  togglePause();
});

document.getElementById('exit-btn').addEventListener('click', exitToMenu);