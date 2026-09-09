// MOUSE LOOK / MIRA
// ---------------------------------------------------------------------
function setupMouseLook() {
  const canvas = renderer.domElement;
  let hadPointerLock = false;

  // il tasto destro serve per mirare: disabilita il menu contestuale del browser
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = (document.pointerLockElement === canvas);
    document.getElementById('lock-hint').style.display = pointerLocked ? 'none' : 'block';
    if (!pointerLocked) {
      aiming = false;
      mouseHeld = false;
      document.getElementById('crosshair').classList.remove('aiming');
      document.getElementById('scope-vignette').classList.remove('active');
      updatePlayerVisibility();
    }
    if (hadPointerLock && !pointerLocked && running && !paused) togglePause(true);
    hadPointerLock = pointerLocked;
  });

  window.addEventListener('blur', () => {
    if (running && !paused) togglePause(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) togglePause(true);
  });

  document.addEventListener('mousemove', e => {
    if (!pointerLocked) return;
    yaw -= e.movementX * MOUSE_SENS;
    pitch -= e.movementY * MOUSE_SENS;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
  });

  document.addEventListener('mousedown', e => {
    if (!running) return;
    if (e.button !== 0 && e.button !== 2) return;

    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock(); // il primo click (destro o sinistro) attiva solo il mouse look
      return;
    }

    if (e.button === 2) {
      // tasto destro: tenuto premuto per mirare/zoomare
      aiming = true;
      document.getElementById('crosshair').classList.add('aiming');
      document.getElementById('scope-vignette').classList.add('active');
      updatePlayerVisibility();
    } else if (e.button === 0) {
      // tasto sinistro: un click spara subito
      mouseHeld = true;
      const now = clock.elapsedTime;
      if (now - lastShotTime >= WEAPONS[currentWeapon].fireDelay) {
        lastShotTime = now;
        fireWeapon();
      }
    }
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 2) {
      aiming = false;
      document.getElementById('crosshair').classList.remove('aiming');
      document.getElementById('scope-vignette').classList.remove('active');
      updatePlayerVisibility();
    } else if (e.button === 0) {
      mouseHeld = false;
    }
  });
}

function updateAutoFire(dt) {
  // solo le armi automatiche continuano a sparare finché tieni premuto il sinistro
  if (!mouseHeld) return;
  const w = WEAPONS[currentWeapon];
  if (!w.auto) return;
  const now = clock.elapsedTime;
  if (now - lastShotTime >= w.fireDelay) {
    lastShotTime = now;
    fireWeapon();
  }
}

const CROSSHAIRS = {
  pistol: `
    <div class="ch-line" style="width:2px;height:7px;left:15px;top:2px;"></div>
    <div class="ch-line" style="width:2px;height:7px;left:15px;top:23px;"></div>
    <div class="ch-line" style="width:7px;height:2px;left:2px;top:15px;"></div>
    <div class="ch-line" style="width:7px;height:2px;left:23px;top:15px;"></div>
    <div class="ch-dot"></div>`,
  smg: `
    <div class="ch-line" style="width:2px;height:6px;left:15px;top:-1px;"></div>
    <div class="ch-line" style="width:2px;height:6px;left:15px;top:27px;"></div>
    <div class="ch-line" style="width:6px;height:2px;left:-1px;top:15px;"></div>
    <div class="ch-line" style="width:6px;height:2px;left:27px;top:15px;"></div>
    <div class="ch-dot"></div>`,
  rifle: `
    <div class="ch-corner" style="left:1px;top:1px;border-left:2px solid currentColor;border-top:2px solid currentColor;"></div>
    <div class="ch-corner" style="right:1px;top:1px;border-right:2px solid currentColor;border-top:2px solid currentColor;"></div>
    <div class="ch-corner" style="left:1px;bottom:1px;border-left:2px solid currentColor;border-bottom:2px solid currentColor;"></div>
    <div class="ch-corner" style="right:1px;bottom:1px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;"></div>
    <div class="ch-dot"></div>`,
  shotgun: `
    <div class="ch-circle"></div>
    <div class="ch-dot" style="width:5px;height:5px;left:13.5px;top:13.5px;"></div>`
};

function updateCrosshairShape(weaponKey) {
  const el = document.getElementById('crosshair');
  if (el) el.innerHTML = CROSSHAIRS[weaponKey] || CROSSHAIRS.pistol;
}

function switchWeapon(key) {
  if (WEAPONS[key]) {
    currentWeapon = key;
    playWeaponSwitchSound();
    document.getElementById('weapon-label').textContent = WEAPONS[key].name;
    updatePlayerWeaponMesh();
    updateAmmoHUD();
    updateCrosshairShape(WEAPONS[key].crosshair);
    showToast('Arma: ' + WEAPONS[key].name);
  }
}

function updateAmmoHUD() {
  const weapon = WEAPONS[currentWeapon];
  const label = document.getElementById('ammo-label');
  if (!label || !weapon) return;
  label.textContent = isReloading ? 'RICARICA...' : `${ammo[currentWeapon]} / ${weapon.magazine}`;
}

function updatePlayerVisibility() {
  player.visible = (mode === 'foot' && !aiming);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------------------------------------------------------------------
