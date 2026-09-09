// UPDATE LOOP PIECES
// ---------------------------------------------------------------------
function updateCar(dt) {
  const baseAccel = 14, baseMaxSpeed = 34, baseReverseMax = -12, friction = 0.98, baseBrakeForce = 22, turnRate = 1.9;

  if (car.userData.isWrecked) {
    carSpeed = 0;
    document.getElementById('speed-val').textContent = '0';
    return;
  }

  // più la carrozzeria è ammaccata, più il motore rende poco: accelerazione,
  // velocità massima e retromarcia scendono tutte in base al danno accumulato
  const dmgFactor = vehicleSpeedMult(car);
  const accel = baseAccel * dmgFactor;
  const maxSpeed = baseMaxSpeed * dmgFactor;
  const reverseMax = baseReverseMax * dmgFactor;
  const brakeForce = baseBrakeForce;

  if (keys['w']) carSpeed += accel * dt;
  else if (keys['s']) carSpeed -= brakeForce * dt;
  else carSpeed *= Math.pow(friction, dt * 60);

  if (keys[' ']) carSpeed *= Math.pow(0.9, dt * 60);

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
    // sbattere contro un palazzo: rimbalzo immediato, ma solo gli scontri fra
    // veicoli intaccano in modo permanente la velocità massima
    if (Math.abs(carSpeed) > 7) playCrashSound(Math.abs(carSpeed));
    carSpeed *= -0.3;
  }

  // limiti mappa
  const lim = CITY_HALF + 15;
  car.position.x = Math.max(-lim - 180, Math.min(lim, car.position.x));
  car.position.z = Math.max(-lim, Math.min(lim, car.position.z));

  car.userData.wheels.forEach(w => w.rotation.x -= carSpeed * dt * 2);

  // investimento pedoni
  if (Math.abs(carSpeed) > 6) {
    for (let i = pedestrians.length - 1; i >= 0; i--) {
      if (dist2D(car.position, pedestrians[i].mesh.position) < 1.45) {
        scene.remove(pedestrians[i].mesh);
        pedestrians.splice(i, 1);
        addWanted(1);
        playKillSound();
        showToast('Hai investito un pedone! +ricercato');
      }
    }
  }

  document.getElementById('speed-val').textContent = Math.round(Math.abs(carSpeed) * 8);

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

  const mv = slideMove(player.position.x, player.position.z, mvx * moveSpeed * dt, mvz * moveSpeed * dt, 0.6);
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
  for (let i = 0; i < MAX_STARS; i++) {
    starsHTML += `<span class="${i < state.wanted ? 'star-on' : 'star-off'}">★</span>`;
  }
  document.getElementById('stars').innerHTML = starsHTML;
  updateAmmoHUD();

  const speedWrap = document.getElementById('speed-wrap');
  const carStatus = document.getElementById('car-status');
  if (mode === 'car') {
    speedWrap.style.display = 'block';
    carStatus.style.display = 'block';
    const pct = Math.max(0, vehicleSpeedMult(car) * 100);
    const maxSpeed = Math.round(34 * vehicleSpeedMult(car) * 8);
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
  const speed = mode === 'car' ? Math.round(Math.abs(carSpeed) * 8) : 0;
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
    `WANTED ${state.wanted}/${MAX_STARS}  AIM ${aiming ? 'ON' : 'OFF'}\n` +
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
  dayTime += dt * 0.01; // ciclo lento
  if (dayTime > 1) dayTime -= 1;
  const angle = dayTime * Math.PI * 2;
  const radius = 300;
  sun.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius + 40, 60);
  sun.target.position.set(0, 0, 0);
  sunMesh.position.copy(sun.position);

  const daylight = Math.max(0, Math.sin(angle));
  sun.intensity = 0.15 + daylight * 1.1;
  hemi.intensity = 0.25 + daylight * 0.5;

  const dayColor = new THREE.Color(0x8ec9ff);
  const nightColor = new THREE.Color(0x050515);
  const skyColor = nightColor.clone().lerp(dayColor, daylight);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor.getHex(), 60, 320);

  sunMesh.material.color.copy(daylight > 0.15 ? new THREE.Color(0xfff2c0) : new THREE.Color(0xdfe6ff));
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
  car.position.set(0, 0, 0); car.rotation.y = 0; carSpeed = 0;
  player.position.set(4, 0, 4); yaw = 0; pitch = 0.08;
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
  resolveVehicleCollisions(dt);
  updateVehicleDamageEffects(dt);
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

function togglePause(forceState) {
  if (!running) return;
  paused = typeof forceState === 'boolean' ? forceState : !paused;
  const overlay = document.getElementById('pause-overlay');
  overlay.classList.toggle('visible', paused);
  document.body.classList.toggle('paused', paused);

  if (paused) {
    aiming = false;
    mouseHeld = false;
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('crosshair').classList.remove('aiming');
    document.getElementById('scope-vignette').classList.remove('active');
    updatePlayerVisibility();
  } else {
    if (renderer && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
  }
}

function exitToMenu() {
  paused = false;
  running = false;
  if (document.pointerLockElement) document.exitPointerLock();
  window.location.reload();
}

// ---------------------------------------------------------------------
// START
// ---------------------------------------------------------------------
init();

const startButton = document.getElementById('start-btn');
const mobileUnsupported = window.matchMedia('(max-width: 760px)').matches;

if (mobileUnsupported) {
  startButton.disabled = true;
  document.body.classList.add('mobile-unsupported');
}

startButton.addEventListener('click', () => {
  if (mobileUnsupported) return;
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.body.classList.add('playing');
  running = true;
  paused = false;
  initAudio();
  GameAudio.resume();
  updateCrosshairShape(WEAPONS[currentWeapon].crosshair);
  setTimeout(() => {
    document.getElementById('controls-hint').classList.add('is-hidden');
  }, 4000);
});

document.getElementById('resume-btn').addEventListener('click', () => {
  togglePause(false);
});

document.getElementById('exit-btn').addEventListener('click', exitToMenu);


