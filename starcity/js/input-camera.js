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

function setupTouchControls() {
  const controls = document.getElementById('mobile-controls');
  const stick = document.getElementById('mobile-stick');
  const canvas = renderer.domElement;
  if (!controls || !stick) return;

  let stickTouchId = null;
  let cameraTouchId = null;
  let lastCameraX = 0;
  let lastCameraY = 0;
  const setKey = (key, value) => {keys[key] = value;};
  const releaseStick = () => {
    stickTouchId = null;
    touchMoveIntensity = 0;
    setKey('w', false); setKey('s', false); setKey('a', false); setKey('d', false);
    stick.querySelector('.mobile-stick-knob').style.transform = 'translate(-50%, -50%)';
  };
  const updateStick = touch => {
    const rect = stick.getBoundingClientRect();
    const max = rect.width * 0.34;
    const dx = touch.clientX - (rect.left + rect.width / 2);
    const dy = touch.clientY - (rect.top + rect.height / 2);
    const length = Math.min(max, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * length;
    const y = Math.sin(angle) * length;
    const deadZone = 0.28;
    const nx = length > max * deadZone ? x / max : 0;
    const ny = length > max * deadZone ? y / max : 0;
    touchMoveIntensity = Math.min(1, Math.max(0, (length / max - deadZone) / (1 - deadZone)) * 0.65);
    setKey('a', nx < -0.25); setKey('d', nx > 0.25);
    setKey('w', ny < -0.25); setKey('s', ny > 0.25);
    stick.querySelector('.mobile-stick-knob').style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };

  stick.addEventListener('touchstart', e => {
    e.preventDefault();
    if (stickTouchId !== null) return;
    stickTouchId = e.changedTouches[0].identifier;
    updateStick(e.changedTouches[0]);
  }, {passive: false});
  stick.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = [...e.changedTouches].find(t => t.identifier === stickTouchId);
    if (touch) updateStick(touch);
  }, {passive: false});
  const endStick = e => {
    if ([...e.changedTouches].some(t => t.identifier === stickTouchId)) releaseStick();
  };
  stick.addEventListener('touchend', endStick);
  stick.addEventListener('touchcancel', endStick);

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (cameraTouchId !== null) return;
    const touch = e.changedTouches[0];
    cameraTouchId = touch.identifier;
    lastCameraX = touch.clientX;
    lastCameraY = touch.clientY;
  }, {passive: false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = [...e.changedTouches].find(t => t.identifier === cameraTouchId);
    if (!touch) return;
    yaw -= (touch.clientX - lastCameraX) * MOUSE_SENS * 1.8;
    pitch -= (touch.clientY - lastCameraY) * MOUSE_SENS * 1.8;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
    lastCameraX = touch.clientX;
    lastCameraY = touch.clientY;
  }, {passive: false});
  const endCamera = e => {
    if ([...e.changedTouches].some(t => t.identifier === cameraTouchId)) cameraTouchId = null;
  };
  canvas.addEventListener('touchend', endCamera);
  canvas.addEventListener('touchcancel', endCamera);

  controls.querySelectorAll('[data-touch-key]').forEach(button => {
    const key = button.dataset.touchKey;
    const press = e => {e.preventDefault(); setKey(key, true);};
    const release = e => {e.preventDefault(); setKey(key, false);};
    button.addEventListener('touchstart', press, {passive: false});
    button.addEventListener('touchend', release, {passive: false});
    button.addEventListener('touchcancel', release, {passive: false});
  });

  controls.querySelector('[data-touch-action="interact"]').addEventListener('touchstart', e => {e.preventDefault(); toggleVehicle();}, {passive: false});
  controls.querySelector('[data-touch-action="reload"]').addEventListener('touchstart', e => {e.preventDefault(); reloadWeapon();}, {passive: false});
  controls.querySelector('[data-touch-action="weapon-prev"]').addEventListener('touchstart', e => {
    e.preventDefault();
    switchWeapon(WEAPON_ORDER[(WEAPON_ORDER.indexOf(currentWeapon) + WEAPON_ORDER.length - 1) % WEAPON_ORDER.length]);
  }, {passive: false});
  controls.querySelector('[data-touch-action="weapon-next"]').addEventListener('touchstart', e => {
    e.preventDefault();
    switchWeapon(WEAPON_ORDER[(WEAPON_ORDER.indexOf(currentWeapon) + 1) % WEAPON_ORDER.length]);
  }, {passive: false});

  const aimButton = controls.querySelector('[data-touch-action="aim"]');
  const setAim = value => {
    aiming = value;
    document.getElementById('crosshair').classList.toggle('aiming', value);
    document.getElementById('scope-vignette').classList.toggle('active', value);
    updatePlayerVisibility();
  };
  aimButton.addEventListener('touchstart', e => {e.preventDefault(); setAim(true);}, {passive: false});
  aimButton.addEventListener('touchend', e => {e.preventDefault(); setAim(false);}, {passive: false});
  aimButton.addEventListener('touchcancel', e => {e.preventDefault(); setAim(false);}, {passive: false});

  const fireButton = controls.querySelector('[data-touch-action="fire"]');
  fireButton.addEventListener('touchstart', e => {
    e.preventDefault();
    mouseHeld = true;
    const now = clock.elapsedTime;
    if (now - lastShotTime >= WEAPONS[currentWeapon].fireDelay) {
      lastShotTime = now;
      fireWeapon();
    }
  }, {passive: false});
  const releaseFire = e => {e.preventDefault(); mouseHeld = false;};
  fireButton.addEventListener('touchend', releaseFire, {passive: false});
  fireButton.addEventListener('touchcancel', releaseFire, {passive: false});
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
