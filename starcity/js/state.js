// CONFIG
// ---------------------------------------------------------------------
const BLOCKS = 8;              // griglia blocchi NxN
const BLOCK_SIZE = 50;         // dimensione blocco
const ROAD_WIDTH = 10;         // larghezza strada
const CITY_HALF = (BLOCKS * BLOCK_SIZE) / 2;
const MAX_STARS = 5;
const VEHICLE_HALF_WIDTH = 1.1;
const VEHICLE_HALF_LENGTH = 2.2;

let scene, camera, renderer, clock;
let sun, sunMesh, hemi;
let dayTime = 0.35; // 0..1 ciclo giorno/notte
let running = false;
let paused = false;

// entità
let car, carSpeed = 0, carSteer = 0;
let player;
let mode = 'foot'; // 'foot' | 'car'

// visuale / mira con il mouse
let yaw = 0;           // rotazione orizzontale della visuale (e del personaggio a piedi)
let pitch = 0.08;       // rotazione verticale della visuale
let pointerLocked = false;
let aiming = false;
const MOUSE_SENS = 0.0022;
const aimDir = new THREE.Vector3(0, 0, 1); // direzione di mira aggiornata ogni frame, usata per sparare
let pedestrians = [];
let policeCars = [];
let worldVehicles = []; // auto guidabili nel mondo (quella iniziale + quelle civili rubabili)
let coins = [];
let missionMarker = null;
let bullets = []; // effetti visivi proiettile (linee brevi)
let buildingsAABB = [];

const keys = {};
let lastShotTime = -10;
let lastCrimeTime = -999;
let lastArmorToast = -10;
let mouseHeld = false;

// ---------------------------------------------------------------------
// ARMI
// ---------------------------------------------------------------------
const WEAPONS = {
  pistol: {name: 'Pistola', auto: false, magazine: 12, reloadTime: 0.9, fireDelay: 0.28, spread: 0.004, pellets: 1, range: 90, pedWanted: 2, copWanted: 1, crosshair: 'pistol'},
  smg: {name: 'Mitraglietta', auto: true, magazine: 30, reloadTime: 1.25, fireDelay: 0.09, spread: 0.028, pellets: 1, range: 70, pedWanted: 2, copWanted: 1, crosshair: 'smg'},
  rifle: {name: 'Fucile d\'Assalto', auto: true, magazine: 24, reloadTime: 1.35, fireDelay: 0.13, spread: 0.015, pellets: 1, range: 140, pedWanted: 2, copWanted: 1, crosshair: 'rifle'},
  shotgun: {name: 'Fucile a Pompa', auto: false, magazine: 6, reloadTime: 1.1, fireDelay: 0.75, spread: 0.11, pellets: 7, range: 30, pedWanted: 3, copWanted: 2, crosshair: 'shotgun'}
};
const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'shotgun'];
let currentWeapon = 'pistol';
const ammo = Object.fromEntries(WEAPON_ORDER.map(key => [key, WEAPONS[key].magazine]));
let isReloading = false;
let reloadToken = 0;
let emptyClickTime = -Infinity;

function spreadDir(baseDir, spread) {
  if (spread <= 0) return baseDir.clone();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(baseDir, up).normalize();
  const trueUp = new THREE.Vector3().crossVectors(right, baseDir).normalize();
  return baseDir.clone()
    .addScaledVector(right, (Math.random() - 0.5) * spread)
    .addScaledVector(trueUp, (Math.random() - 0.5) * spread)
    .normalize();
}

const state = {
  health: 100,
  armor: 0,
  money: 500,
  wanted: 0,
};

const CAR_SPAWN = new THREE.Vector3(0, 0, 0);

function initAudio() { GameAudio.initAudio(); }
function playGunshot(weaponKey) { GameAudio.playGunshot(weaponKey); }
function playKillSound() { GameAudio.playKillSound(); }
function playCrashSound(strength) { GameAudio.playCrashSound(strength); }
function playReloadStartSound() { GameAudio.playReloadStartSound(); }
function playReloadCompleteSound() { GameAudio.playReloadCompleteSound(); }
function playEmptyAmmoSound() { GameAudio.playEmptyAmmoSound(); }
function playWeaponSwitchSound() { GameAudio.playWeaponSwitchSound(); }
function updateSiren(dt) {
  GameAudio.updateSiren(dt, {policeCars, mode, car, player, dist2D});
}

// ---------------------------------------------------------------------
