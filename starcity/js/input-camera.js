// MOUSE LOOK / MIRA
// ---------------------------------------------------------------------
function setupMouseLook() {
  const canvas = renderer.domElement;
  let hadPointerLock = false;

  // FIX #1: il contextmenu va bloccato su document, non solo sul canvas.
  // Overlay come #crosshair e #scope-vignette stanno sopra il canvas al
  // centro schermo (proprio dove miri col tasto destro): se il target del
  // click e' l'overlay invece del canvas, il vecchio listener non scattava
  // e il menu del browser si apriva nel bel mezzo dell'azione di mira.
  document.addEventListener('contextmenu', e => e.preventDefault());

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
    // FIX #2: rimossa la riga morta "hadPointerLock = false" (veniva
    // comunque sovrascritta due righe sotto con lo stesso valore).
    if (hadPointerLock && !pointerLocked && running && !paused) {
      togglePause(true);
    }
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
    if (e.target.closest('#pause-overlay')) return;
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

function updateTouchSensitivityUI() {
  const range = document.getElementById('touch-sensitivity-range');
  const value = document.getElementById('touch-sensitivity-value');
  if (!range || !value) return;
  touchMoveSensitivity = Number(range.value);
  value.textContent = `${touchMoveSensitivity.toFixed(1)}x`;
}

// FIX #3: costante di deadzone unica, condivisa tra il calcolo
// dell'intensita' e la soglia di attivazione dei tasti direzionali.
// Prima erano due valori "magici" (0.22 e 0.2) scollegati tra loro.
const STICK_DEAD_ZONE = 0.22;

// FIX #4: lo smoothing di touchMoveIntensity gira su un tick indipendente
// basato su performance.now() (quindi su dt reale), invece che una volta
// per ogni evento 'touchmove'. Prima la stessa manovra sul joystick
// produceva accelerazioni diverse a seconda di quanti eventi touch
// generava il browser/dispositivo. touchMoveTarget e' il valore "grezzo"
// verso cui si tende; touchMoveIntensity converge ad esso ad una velocita'
// costante nel tempo, sia in salita che in discesa.
//
// FIX #9 (regressione corretta): il tick NON deve partire automaticamente
// a livello di file. Se parte subito e touchMoveTarget resta a 0 (nessun
// evento touch su desktop), il loop trascina touchMoveIntensity verso 0
// in circa un secondo, azzerando il movimento anche su desktop/tastiera.
// Ora il tick si avvia solo dentro setupTouchControls (quando i controlli
// touch esistono davvero) e il target parte dal valore GIA' presente in
// touchMoveIntensity (tipicamente 1 su desktop), cosi' non lo altera
// finche' non arriva un vero input touch.
let touchMoveTarget = null;
let lastStickTickTime = null;
let stickSmoothingStarted = false;

function tickStickSmoothing(now) {
  if (lastStickTickTime === null) lastStickTickTime = now;
  const dt = Math.min(0.05, (now - lastStickTickTime) / 1000);
  lastStickTickTime = now;
  const smoothingRate = 10; // convergenza al target in ~1/10 di secondo
  touchMoveIntensity += (touchMoveTarget - touchMoveIntensity) * Math.min(1, dt * smoothingRate);
  requestAnimationFrame(tickStickSmoothing);
}

function setupTouchControls() {
  const controls = document.getElementById('mobile-controls');
  const stick = document.getElementById('mobile-stick');
  const canvas = renderer.domElement;
  if (!controls || !stick) return;

  // Il target parte allineato al valore corrente (di solito 1): niente
  // decadimento finche' l'utente non tocca davvero lo stick o il d-pad.
  if (touchMoveTarget === null) touchMoveTarget = touchMoveIntensity;
  if (!stickSmoothingStarted) {
    stickSmoothingStarted = true;
    requestAnimationFrame(tickStickSmoothing);
  }

  const sensitivityRange = document.getElementById('touch-sensitivity-range');
  if (sensitivityRange) {
    sensitivityRange.addEventListener('input', () => updateTouchSensitivityUI());
    updateTouchSensitivityUI();
  }

  let stickTouchId = null;
  let cameraTouchId = null;
  let lastCameraX = 0;
  let lastCameraY = 0;

  // FIX #5: i bottoni a croce (data-touch-key) impostavano solo keys[...]
  // senza mai toccare touchMoveIntensity. Se lo stick analogico non era
  // mai stato usato in quella sessione, touchMoveIntensity restava a 0 e
  // i bottoni direzionali muovevano i tasti ma NON producevano movimento
  // reale (in updateCar/updatePlayerFoot ogni spostamento e' moltiplicato
  // per touchMoveIntensity). Ora teniamo un conteggio dei bottoni
  // direzionali premuti e, se lo stick non e' attivo, forziamo il target
  // a piena intensita'.
  const movementKeys = new Set(['w', 'a', 's', 'd']);
  let dpadMovementCount = 0;

  const setKey = (key, value) => {keys[key] = value;};

  const isPointInsideStick = (touch, rect) => {
    // FIX #6: hit-test circolare invece che rettangolare, coerente con la
    // base visivamente rotonda dello stick (radius = rect.width * 0.38).
    // Prima un tocco vicino agli angoli del quadrato ma fuori dal cerchio
    // reale creava una piccola zona morta "invisibile".
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    return (dx * dx + dy * dy) <= radius * radius;
  };

  const releaseStick = () => {
    stickTouchId = null;
    // FIX (era #: reset istantaneo) -> ora si imposta solo il target,
    // la discesa e' gestita dolcemente da tickStickSmoothing.
    if (dpadMovementCount === 0) touchMoveTarget = 0;
    setKey('w', false); setKey('s', false); setKey('a', false); setKey('d', false);
    stick.querySelector('.mobile-stick-knob').style.transform = 'translate(-50%, -50%)';
  };

  const updateStick = touch => {
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const radius = rect.width * 0.38;
    const length = Math.min(Math.hypot(dx, dy), radius);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * length;
    const y = Math.sin(angle) * length;
    const normalizedLen = Math.max(0, length / radius);
    const nx = normalizedLen > STICK_DEAD_ZONE ? x / radius : 0;
    const ny = normalizedLen > STICK_DEAD_ZONE ? y / radius : 0;

    // FIX #7: rimosso il fattore "* 0.65" che tagliava la velocita'
    // massima raggiungibile da touch al 65% rispetto a tastiera, anche
    // con lo stick spinto completamente a fondo corsa. Ora a fondo corsa
    // si arriva a intensita' 1 (moltiplicata solo dalla sensibilita'
    // scelta dall'utente).
    touchMoveTarget = Math.min(
      1,
      Math.max(0, (normalizedLen - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE)) * touchMoveSensitivity
    );

    setKey('a', nx < -0.2); setKey('d', nx > 0.2);
    setKey('w', ny < -0.2); setKey('s', ny > 0.2);
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
    const rect = stick.getBoundingClientRect();
    if (isPointInsideStick(touch, rect)) return;
    cameraTouchId = touch.identifier;
    lastCameraX = touch.clientX;
    lastCameraY = touch.clientY;
  }, {passive: false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = [...e.changedTouches].find(t => t.identifier === cameraTouchId);
    if (!touch) return;
    const rect = stick.getBoundingClientRect();
    if (isPointInsideStick(touch, rect)) {
      // FIX #8: il dito per la camera puo' attraversare la zona dello
      // stick durante uno swipe veloce. Prima si usciva con un "return"
      // senza aggiornare lastCameraX/Y: quando il dito riemergeva fuori
      // dallo stick, il delta veniva calcolato rispetto a una posizione
      // "congelata" da prima dell'attraversamento, causando uno scatto
      // improvviso della visuale (camera snap). Ora la posizione di
      // riferimento resta sincronizzata anche mentre si e' sopra lo stick.
      lastCameraX = touch.clientX;
      lastCameraY = touch.clientY;
      return;
    }
    const dx = touch.clientX - lastCameraX;
    const dy = touch.clientY - lastCameraY;
    const lookSensitivity = mode === 'car' ? 0.0018 : 0.0014;
    const smoothing = mode === 'car' ? 0.55 : 0.7;
    yaw -= dx * lookSensitivity;
    pitch -= dy * lookSensitivity;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
    lastCameraX += dx * smoothing;
    lastCameraY += dy * smoothing;
  }, {passive: false});
  const endCamera = e => {
    if ([...e.changedTouches].some(t => t.identifier === cameraTouchId)) cameraTouchId = null;
  };
  canvas.addEventListener('touchend', endCamera);
  canvas.addEventListener('touchcancel', endCamera);

  controls.querySelectorAll('[data-touch-key]').forEach(button => {
    const key = button.dataset.touchKey;
    const press = e => {
      e.preventDefault();
      setKey(key, true);
      // FIX #5 (continua): un tasto direzionale a croce deve poter
      // muovere il player/veicolo anche se lo stick analogico non e'
      // mai stato toccato in questa sessione.
      if (movementKeys.has(key)) {
        dpadMovementCount++;
        touchMoveTarget = Math.max(touchMoveTarget, touchMoveSensitivity > 0 ? Math.min(1, touchMoveSensitivity) : 1);
      }
    };
    const release = e => {
      e.preventDefault();
      setKey(key, false);
      if (movementKeys.has(key)) {
        dpadMovementCount = Math.max(0, dpadMovementCount - 1);
        if (dpadMovementCount === 0 && stickTouchId === null) touchMoveTarget = 0;
      }
    };
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