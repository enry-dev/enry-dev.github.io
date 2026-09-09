// INPUT
// ---------------------------------------------------------------------
function handleKeyDown(e) {
  const k = e.key.toLowerCase();
  if (k === 'r') {
    reloadWeapon();
    return;
  }
  if (k === 'e') {
    toggleVehicle();
  }
  if (WEAPON_ORDER.includes(WEAPON_ORDER[Number(k) - 1])) {
    switchWeapon(WEAPON_ORDER[Number(k) - 1]);
  }
}

function toggleVehicle() {
  if (mode === 'foot') {
    // cerca il veicolo guidabile più vicino (senza autista vivo dentro)
    let nearest = null, nearestDist = 7;
    for (const v of worldVehicles) {
      if (v.userData.hasDriver) continue; // c'è ancora un autista: va ucciso prima
      if (v.userData.isWrecked) continue;
      const d = dist2D(player.position, v.position);
      if (d < nearestDist) {nearest = v; nearestDist = d;}
    }
    if (nearest) {
      const side = getNearSide(nearest, player.position);
      openDoors(nearest, side);
      setTimeout(() => closeDoors(nearest), 500);
      car = nearest;
      mode = 'car';
      document.getElementById('mode-badge').textContent = 'IN AUTO';
      showToast('Sei salito in auto');
    } else {
      // controlla se c'è un'auto con autista ancora vivo nelle vicinanze
      const withDriver = worldVehicles.find(v => v.userData.hasDriver && dist2D(player.position, v.position) < 7);
      if (withDriver) showToast('C\'è un autista a bordo: uccidilo per rubare l\'auto!');
    }
  } else {
    const side = getNearSide(car, player.position.clone());
    openDoors(car, 'both');
    setTimeout(() => closeDoors(car), 500);
    mode = 'foot';
    player.position.set(car.position.x + 2.5, 0, car.position.z);
    document.getElementById('mode-badge').textContent = 'A PIEDI';
    showToast('Sei sceso dall\'auto');
  }
  updatePlayerVisibility();
}

function fireWeapon() {
  const weapon = WEAPONS[currentWeapon];
  if (isReloading) return;
  if (ammo[currentWeapon] <= 0) {
    if (clock.elapsedTime - emptyClickTime > 0.25) {
      playEmptyAmmoSound();
      emptyClickTime = clock.elapsedTime;
      showToast('Munizioni esaurite: premi R per ricaricare');
    }
    return;
  }

  ammo[currentWeapon]--;
  updateAmmoHUD();
  // il colpo parte dalla telecamera: è l'unico modo per far coincidere sempre
  // il punto colpito con quello che vedi esattamente sotto il mirino
  const origin = camera.position.clone();

  playGunshot(currentWeapon);

  for (let pellet = 0; pellet < weapon.pellets; pellet++) {
    const dir = spreadDir(aimDir, weapon.spread);

    // linea tracer visiva (parte visivamente dall'arma del personaggio/auto)
    const muzzle = (mode === 'car') ? car.position.clone().setY(1.5) : player.position.clone().setY(1.35);
    const points = [muzzle, origin.clone().add(dir.clone().multiplyScalar(weapon.range))];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xffff66}));
    scene.add(line);
    bullets.push({mesh: line, life: 0.08});

    tryHit(origin, dir, weapon);
  }
}

function reloadWeapon() {
  const weaponKey = currentWeapon;
  const weapon = WEAPONS[weaponKey];
  if (isReloading || ammo[weaponKey] >= weapon.magazine) return;
  isReloading = true;
  const token = ++reloadToken;
  playReloadStartSound();
  showToast('Ricarica in corso...');
  setTimeout(() => {
    if (token !== reloadToken) return;
    ammo[weaponKey] = weapon.magazine;
    isReloading = false;
    playReloadCompleteSound();
    updateAmmoHUD();
    showToast('Arma ricaricata');
  }, weapon.reloadTime * 1000);
  updateAmmoHUD();
}

function tryHit(origin, dir, weapon) {
  const maxRange = weapon.range;

  // check colpiti: pedoni (il bersaglio è al livello del busto, non dei piedi)
  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const ped = pedestrians[i];
    const targetPos = ped.mesh.position.clone(); targetPos.y += 0.95;
    if (hitTest(origin, dir, targetPos, 0.62, maxRange)) {
      scene.remove(ped.mesh);
      pedestrians.splice(i, 1);
      addWanted(weapon.pedWanted);
      playKillSound();
      showToast('Hai sparato a un civile! +ricercato');
      return;
    }
  }
  // check colpiti: autisti delle auto civili (per poterle rubare)
  for (const v of worldVehicles) {
    if (!v.userData.hasDriver) continue;
    const worldPos = new THREE.Vector3();
    v.userData.driverMesh.getWorldPosition(worldPos);
    worldPos.y += 0.45;
    if (hitTest(origin, dir, worldPos, 0.48, maxRange)) {
      v.remove(v.userData.driverMesh);
      v.userData.hasDriver = false;
      v.userData.driverMesh = null;
      addWanted(weapon.pedWanted);
      playKillSound();
      showToast('Autista eliminato: l\'auto è tua!');
      return;
    }
  }
  // check colpiti: agenti a piedi e auto della polizia
  for (let ui = policeCars.length - 1; ui >= 0; ui--) {
    const unit = policeCars[ui];
    let hitSomething = false;
    for (let oi = unit.officers.length - 1; oi >= 0; oi--) {
      const off = unit.officers[oi];
      const offTarget = off.mesh.position.clone(); offTarget.y += 0.95;
      if (hitTest(origin, dir, offTarget, 0.62, maxRange)) {
        scene.remove(off.mesh);
        unit.officers.splice(oi, 1);
        addWanted(weapon.copWanted);
        playKillSound();
        showToast('Agente neutralizzato!');
        hitSomething = true;
        break;
      }
    }
    if (hitSomething) return;
    const carTarget = unit.mesh.position.clone(); carTarget.y += 0.8;
    if (hitTest(origin, dir, carTarget, 2.4, maxRange)) {
      // l'auto della polizia è blindata: il colpo viene assorbito, non si distrugge sparandole.
      // va eliminata uccidendo gli agenti quando scendono per arrestarti.
      const now = clock.elapsedTime;
      if (now - lastArmorToast > 1.2) {
        lastArmorToast = now;
        showToast('L\'auto della polizia è blindata! Aspetta che scendano gli agenti e falli fuori.');
      }
      return;
    }
  }
}

function hitTest(origin, dir, targetPos, radius, maxRange) {
  const toTarget = targetPos.clone().sub(origin);
  const dist = toTarget.length();
  if (dist > (maxRange || 90)) return false;
  const dirN = dir.clone().normalize();
  const projLen = toTarget.dot(dirN);
  if (projLen < 0) return false;
  const closest = origin.clone().add(dirN.clone().multiplyScalar(projLen));
  // un minimo di tolleranza in più a lunga distanza, per compensare le
  // micro-imprecisioni del mirino quando il bersaglio è molto lontano
  const effectiveRadius = radius + dist * 0.012;
  return closest.distanceTo(targetPos) < effectiveRadius;
}

function addWanted(n) {
  state.wanted = Math.min(MAX_STARS, state.wanted + n);
  lastCrimeTime = clock.elapsedTime;
}

// ---------------------------------------------------------------------
