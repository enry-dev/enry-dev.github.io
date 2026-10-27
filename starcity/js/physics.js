// COLLISION HELPERS
// ---------------------------------------------------------------------
function dist2D(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z; return Math.sqrt(dx * dx + dz * dz);
}

function collidesBuilding(x, z, margin) {
  for (const b of buildingsAABB) {
    const closestX = Math.max(b.minX, Math.min(x, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - closestX, dz = z - closestZ;
    if (dx * dx + dz * dz < margin * margin) return true;
  }
  return false;
}

// prova a muoversi da (px,pz) di (dx,dz); se sbatte contro un palazzo, scivola
// lungo la parete invece di fermarsi di scatto (così nessuno attraversa i muri)
function collidesBuildingForVehicle(vehicle, x, z) {
  const axes = getVehicleAxes(vehicle);
  const testAxes = [axes.forward, axes.side, {x: 1, z: 0}, {x: 0, z: 1}];

  for (const building of buildingsAABB) {
    const buildingTop = Number.isFinite(building.maxY) ? building.maxY : 3.2;
    if (vehicle.userData.flyEnabled && vehicle.position.y > buildingTop + 0.5) continue;

    const buildingCenter = {
      x: (building.minX + building.maxX) / 2,
      z: (building.minZ + building.maxZ) / 2
    };
    const buildingHalf = {
      x: (building.maxX - building.minX) / 2,
      z: (building.maxZ - building.minZ) / 2
    };
    const delta = {x: x - buildingCenter.x, z: z - buildingCenter.z};
    let overlaps = true;
    for (const axis of testAxes) {
      const vehicleProjection = projectVehicle(vehicle, axis);
      const buildingProjection = buildingHalf.x * Math.abs(axis.x) + buildingHalf.z * Math.abs(axis.z);
      if (Math.abs(delta.x * axis.x + delta.z * axis.z) > vehicleProjection + buildingProjection) {
        overlaps = false;
        break;
      }
    }
    if (overlaps) return true;
  }
  return false;
}

function vehiclePositionIsOccupied(vehicle, x, z) {
  const originalX = vehicle.position.x;
  const originalZ = vehicle.position.z;
  vehicle.position.set(x, vehicle.position.y, z);
  const bodies = [...worldVehicles, ...policeCars.map(unit => unit.mesh)];
  const occupied = bodies.some(other => other !== vehicle && getVehicleOverlap(vehicle, other));
  vehicle.position.set(originalX, vehicle.position.y, originalZ);
  return occupied;
}

function findSafeVehiclePosition(vehicle, candidateFactory, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidate = candidateFactory(attempt);
    if (candidate.rot !== undefined) vehicle.rotation.y = candidate.rot;
    if (collidesBuildingForVehicle(vehicle, candidate.x, candidate.z)) continue;
    if (vehiclePositionIsOccupied(vehicle, candidate.x, candidate.z)) continue;
    return candidate;
  }
  return null;
}

function recoverVehicleFromBuilding(vehicle) {
  if (!collidesBuildingForVehicle(vehicle, vehicle.position.x, vehicle.position.z)) return;
  const origin = {x: vehicle.position.x, z: vehicle.position.z};
  const safe = findSafeVehiclePosition(vehicle, attempt => {
    const directionCount = 24;
    const angle = (attempt % directionCount) * (Math.PI * 2 / directionCount);
    const distance = 0.15 + Math.floor(attempt / directionCount) * 0.15;
    return {x: origin.x + Math.cos(angle) * distance, z: origin.z + Math.sin(angle) * distance};
  }, 240);
  if (safe) vehicle.position.set(safe.x, vehicle.position.y, safe.z);
  vehicle.userData.vx = 0;
  vehicle.userData.vz = 0;
}

function slideMove(px, pz, dx, dz, margin, vehicle = null) {
  const collides = (x, z) => vehicle ? collidesBuildingForVehicle(vehicle, x, z) : collidesBuilding(x, z, margin);
  const nx = px + dx, nz = pz + dz;
  if (!collides(nx, nz)) return {x: nx, z: nz, blocked: false};
  if (!collides(nx, pz)) return {x: nx, z: pz, blocked: true};
  if (!collides(px, nz)) return {x: px, z: nz, blocked: true};
  return {x: px, z: pz, blocked: true};
}

// ---------------------------------------------------------------------
// RALLENTAMENTO DA SCONTRO — il 20% degli urti danneggia il veicolo e riduce
// del 10% sia la velocità attuale che quella massima, in modo cumulativo.
// ---------------------------------------------------------------------
const MIN_SPEED_MULT = 0.15; // non scende mai sotto il 15% della velocità originale
const VEHICLE_DAMAGE_CHANCE = 0.2;
const VEHICLE_CRASH_SOUND_COOLDOWN = 0.45;
let lastVehicleCrashSound = -Infinity;
const collisionBodies = [];

// Registra un singolo evento d'urto. Il cooldown vale anche se l'urto non
// danneggia il veicolo, evitando più tentativi nello stesso impatto prolungato.
function registerVehicleCollision(v) {
  if (!v || !v.userData) return false;
  if (v.userData.isWrecked) return false;
  if (v.userData.collisionCooldown > 0) return false;
  v.userData.collisionCooldown = 0.8;
  if (Math.random() >= VEHICLE_DAMAGE_CHANCE) return false;
  v.userData.speedMult = Math.max(MIN_SPEED_MULT, v.userData.speedMult * 0.9);
  if (v.userData.speedMult <= 0.25) breakVehicle(v);
  return true;
}

function registerBuildingImpact(vehicle, impactSpeed) {
  if (!vehicle || impactSpeed <= 1.2) return false;
  const hit = registerVehicleCollision(vehicle);
  if (hit && vehicle === car && mode === 'car') {
    carSpeed *= 0.9;
    showToast('Impatto: integrita auto ridotta');
  }
  return hit;
}

// moltiplicatore attuale di velocità massima del veicolo (1 = nessuno scontro subito)
function vehicleSpeedMult(v) {
  if (!v || !v.userData) return 1;
  return v.userData.speedMult === undefined ? 1 : v.userData.speedMult;
}

function getVehicleAxes(vehicle) {
  const angle = vehicle.rotation.y;
  return {
    forward: {x: Math.sin(angle), z: Math.cos(angle)},
    side: {x: Math.cos(angle), z: -Math.sin(angle)}
  };
}

function getVehicleCollisionSize(vehicle) {
  if (!vehicle || !vehicle.userData) return {halfWidth: VEHICLE_HALF_WIDTH, halfLength: VEHICLE_HALF_LENGTH, centerOffset: {x: 0, z: 0}};
  if (vehicle.userData.vehicleType === 'closedTruck') {
    return {halfWidth: 1.7, halfLength: 4.8, centerOffset: {x: 0, z: -2.4}};
  }
  return {halfWidth: VEHICLE_HALF_WIDTH, halfLength: VEHICLE_HALF_LENGTH, centerOffset: {x: 0, z: 0}};
}

function getVehicleCollisionCenter(vehicle) {
  const {centerOffset} = getVehicleCollisionSize(vehicle);
  const axes = getVehicleAxes(vehicle);
  return {
    x: vehicle.position.x + centerOffset.x * axes.side.x + centerOffset.z * axes.forward.x,
    z: vehicle.position.z + centerOffset.x * axes.side.z + centerOffset.z * axes.forward.z
  };
}

function projectVehicle(vehicle, axis) {
  const axes = getVehicleAxes(vehicle);
  const {halfWidth, halfLength} = getVehicleCollisionSize(vehicle);
  return halfWidth * Math.abs(axes.side.x * axis.x + axes.side.z * axis.z) +
    halfLength * Math.abs(axes.forward.x * axis.x + axes.forward.z * axis.z);
}

function getVehicleOverlap(a, b) {
  const axesA = getVehicleAxes(a), axesB = getVehicleAxes(b);
  const axes = [axesA.forward, axesA.side, axesB.forward, axesB.side];
  let smallestOverlap = Infinity;
  let smallestAxis = null;
  const centerA = getVehicleCollisionCenter(a);
  const centerB = getVehicleCollisionCenter(b);
  const centerDelta = {x: centerB.x - centerA.x, z: centerB.z - centerA.z};

  for (const axis of axes) {
    const distance = Math.abs(centerDelta.x * axis.x + centerDelta.z * axis.z);
    const overlap = projectVehicle(a, axis) + projectVehicle(b, axis) - distance;
    if (overlap <= 0) return null;
    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      smallestAxis = axis;
    }
  }

  if (centerDelta.x * smallestAxis.x + centerDelta.z * smallestAxis.z < 0) {
    smallestAxis = {x: -smallestAxis.x, z: -smallestAxis.z};
  }
  return {overlap: smallestOverlap, nx: smallestAxis.x, nz: smallestAxis.z};
}

// ---------------------------------------------------------------------
// COLLISIONE FISICA FRA VEICOLI
// ---------------------------------------------------------------------
// stima la velocità "guidata" attuale di un veicolo (non il knockback residuo)
function getVehicleVelocity(v) {
  if (v === car) {
    if (mode === 'car') return {x: Math.sin(car.rotation.y) * carSpeed, z: Math.cos(car.rotation.y) * carSpeed};
    return {x: 0, z: 0};
  }
  if (v.userData.hasDriver && v.userData.waypoint) {
    const s = v.userData.driveSpeed * vehicleSpeedMult(v);
    return {x: Math.sin(v.rotation.y) * s, z: Math.cos(v.rotation.y) * s};
  }
  const pu = policeCars.find(p => p.mesh === v);
  if (pu && pu.state === 'chasing') {
    const s = pu.speed * vehicleSpeedMult(v);
    return {x: Math.sin(v.rotation.y) * s, z: Math.cos(v.rotation.y) * s};
  }
  if (pu && pu.state === 'patrol') {
    const s = pu.patrolSpeed * vehicleSpeedMult(v);
    return {x: Math.sin(v.rotation.y) * s, z: Math.cos(v.rotation.y) * s};
  }
  return {x: 0, z: 0};
}

// veicoli fermi/abbandonati sono "più pesanti" da spostare di quelli guidati
function getVehicleMass(v) {
  if (v === car && mode === 'car') return 1;
  if (v.userData.hasDriver && v.userData.waypoint) return 1;
  const pu = policeCars.find(p => p.mesh === v);
  if (pu && pu.state === 'chasing') return 1.15;
  if (pu && pu.state === 'patrol') return 1;
  return 2.4;
}

// risolve tutte le collisioni fra coppie di veicoli: separa i corpi che si
// compenetrano e applica un rimbalzo fisico (knockback) in base alla massa
// e alla velocità d'impatto, con danno/suono se coinvolto il giocatore
function resolveVehicleCollisions(dt) {
  collisionBodies.length = 0;
  worldVehicles.forEach(vehicle => collisionBodies.push(vehicle));
  policeCars.forEach(p => collisionBodies.push(p.mesh));
  const bodies = collisionBodies;

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      const isPolicePair = policeCars.some(p => p.mesh === a || p.mesh === b);
      if (!(a === car || b === car || isPolicePair)) continue;
      if ((a === car || b === car) && car.position.y > 2.5) continue;
      const collision = getVehicleOverlap(a, b);
      if (!collision) continue;
      const {nx, nz, overlap} = collision;

      const massA = getVehicleMass(a), massB = getVehicleMass(b);
      const totalMass = massA + massB;

      // separazione posizionale: chi pesa meno viene spinto via di più
      const pushA = overlap * (massB / totalMass);
      const pushB = overlap * (massA / totalMass);
      a.position.x -= nx * pushA; a.position.z -= nz * pushA;
      b.position.x += nx * pushB; b.position.z += nz * pushB;

      // rimbalzo fisico in base alla velocità d'impatto lungo la normale
      const velA = getVehicleVelocity(a), velB = getVehicleVelocity(b);
      const impactSpeed = Math.abs((velA.x - velB.x) * nx + (velA.z - velB.z) * nz);

      if (impactSpeed > 1.2) {
        const kick = Math.min(impactSpeed * 0.55, 11);
        a.userData.vx -= nx * kick * (massB / totalMass);
        a.userData.vz -= nz * kick * (massB / totalMass);
        b.userData.vx += nx * kick * (massA / totalMass);
        b.userData.vz += nz * kick * (massA / totalMass);

        // ogni scontro fra 2 veicoli: -10% alla velocità attuale e -10%
        // (permanente e cumulativo) alla loro velocità massima
        const aHit = registerVehicleCollision(a);
        const bHit = registerVehicleCollision(b);
        if (aHit && a === car && mode === 'car') carSpeed *= 0.9;
        if (bHit && b === car && mode === 'car') carSpeed *= 0.9;

        if ((a === car || b === car) && mode === 'car' && (aHit || bHit)) {
          showToast('Scontro: integrita auto ridotta');
        }

        if (impactSpeed > 3.5 && clock.elapsedTime - lastVehicleCrashSound >= VEHICLE_CRASH_SOUND_COOLDOWN) {
          playCrashSound(Math.min(impactSpeed, 10));
          lastVehicleCrashSound = clock.elapsedTime;
        }
      }
    }
  }

  // applica e smorza gradualmente il knockback residuo di ogni veicolo (senza
  // farli attraversare i palazzi), e fa scorrere il tempo di immunità da scontro
  for (const v of bodies) {
    if (v.userData.collisionCooldown > 0) v.userData.collisionCooldown -= dt;
    const vx = v.userData.vx, vz = v.userData.vz;
    if (Math.abs(vx) > 0.02 || Math.abs(vz) > 0.02) {
      const nx = v.position.x + vx * dt, nz = v.position.z + vz * dt;
      if (!collidesBuildingForVehicle(v, nx, nz)) {
        v.position.x = nx; v.position.z = nz;
      } else {
        v.userData.vx = 0; v.userData.vz = 0;
      }
      v.userData.vx *= 0.85;
      v.userData.vz *= 0.85;
    } else {
      v.userData.vx = 0; v.userData.vz = 0;
    }
    recoverVehicleFromBuilding(v);
  }
}

// ---------------------------------------------------------------------
