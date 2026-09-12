// CONFIG
// ---------------------------------------------------------------------
const BLOCKS = 8;              // griglia blocchi NxN
const BLOCK_SIZE = 50;         // dimensione blocco
const ROAD_WIDTH = 10;         // larghezza strada
const CITY_HALF = (BLOCKS * BLOCK_SIZE) / 2;
const MAX_STARS = 5;
const VEHICLE_HALF_WIDTH = 1.1;
const VEHICLE_HALF_LENGTH = 2.2;
const POLICE_BASE_MAX_SPEED = 22;

// ---------------------------------------------------------------------
// FLOTTA CIVILE RUBABILE — modelli, tipo, probabilità di spawn e prestazioni
// (stelle: 1=lenta, 2=normale, 3=sportiva, 4=molto sportiva)
// ---------------------------------------------------------------------
const STAR_PERFORMANCE = {
  1: {topSpeed: 22, accel: 10, reverseMax: -9},
  2: {topSpeed: 28, accel: 13, reverseMax: -11},
  3: {topSpeed: 34, accel: 16, reverseMax: -12},
  4: {topSpeed: 42, accel: 19, reverseMax: -13}
};

const CIVILIAN_FLEET = [
  {key: 'utilitaria', label: 'Utilitaria', type: 'Hatchback', weight: 20, stars: 2},
  {key: 'berlina', label: 'Berlina', type: 'Sedan', weight: 18, stars: 3},
  {key: 'wagon', label: 'Station Wagon', type: 'Wagon', weight: 10, stars: 3},
  {key: 'suv', label: 'SUV/Crossover', type: 'SUV', weight: 12, stars: 3},
  {key: 'coupe', label: 'Coupé', type: 'Sportiva', weight: 6, stars: 4},
  {key: 'cabrio', label: 'Cabrio/Roadster', type: 'Sportiva', weight: 4, stars: 4},
  {key: 'monovolume', label: 'Monovolume', type: 'Family', weight: 6, stars: 2},
  {key: 'pickup', label: 'Pickup', type: 'Pick-up', weight: 5, stars: 3},
  {key: 'furgone', label: 'Furgone', type: 'Van', weight: 9, stars: 2},
  {key: 'camion', label: 'Camion', type: 'Truck', weight: 10, stars: 1}
];

const CIVILIAN_FLEET_TOTAL_WEIGHT = CIVILIAN_FLEET.reduce((sum, m) => sum + m.weight, 0);

// tavolozze colore per categoria (le auto sportive/di lusso pescano da colori più
// vivaci, i mezzi da lavoro restano su tinte più spente)
const CIVILIAN_COLOR_PALETTES = {
  default: [0x2f6fd9, 0xdadada, 0x2fa85a, 0xd9c62f, 0x8a4fd9, 0xd96b2f, 0x2f2f2f],
  sport: [0xd91f2f, 0xf2c200, 0x1f1f1f, 0xffffff, 0x1f4fd9],
  work: [0xd9d9d9, 0x8a8f99, 0x2f4f7a, 0xffffff, 0x5a5a5a]
};

function pickWeighted(list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}

function pickCivilianModel() {
  return pickWeighted(CIVILIAN_FLEET);
}

function pickCivilianColor(model) {
  const palette =
    model.type === 'Sportiva' ? CIVILIAN_COLOR_PALETTES.sport :
    (model.type === 'Van' || model.type === 'Truck' || model.type === 'Pick-up') ? CIVILIAN_COLOR_PALETTES.work :
    CIVILIAN_COLOR_PALETTES.default;
  return palette[Math.floor(Math.random() * palette.length)];
}

// ---------------------------------------------------------------------
// FLOTTA POLIZIA — 5 categorie, selezionate in base al livello di ricercato
// ---------------------------------------------------------------------
const POLICE_FLEET = [
  {key: 'berlina', label: 'Berlina Polizia', usage: 'pattuglia normale'},
  {key: 'suv', label: 'SUV Polizia', usage: 'inseguimenti / unità pesante'},
  {key: 'interceptor', label: 'Interceptor', usage: 'inseguimenti veloci'},
  {key: 'furgone', label: 'Furgone Polizia', usage: 'unità speciale'},
  {key: 'moto', label: 'Moto', usage: 'situazioni leggere'}
];

// pesi di comparsa per ciascuna categoria, in base alle stelle di ricercato (1-5)
const POLICE_SPAWN_TABLE = {
  1: [{key: 'moto', weight: 70}, {key: 'berlina', weight: 30}],
  2: [{key: 'berlina', weight: 50}, {key: 'suv', weight: 30}, {key: 'moto', weight: 20}],
  3: [{key: 'berlina', weight: 40}, {key: 'suv', weight: 30}, {key: 'interceptor', weight: 30}],
  4: [{key: 'suv', weight: 30}, {key: 'interceptor', weight: 40}, {key: 'furgone', weight: 30}],
  5: [{key: 'suv', weight: 20}, {key: 'interceptor', weight: 40}, {key: 'furgone', weight: 40}]
};

function pickPoliceModelKey(starLevel) {
  const table = POLICE_SPAWN_TABLE[Math.max(1, Math.min(5, starLevel))] || POLICE_SPAWN_TABLE[1];
  return pickWeighted(table).key;
}

let scene, camera, renderer, clock;
let sun, sunMesh, hemi;
let starField;
let dayTime = 0.35; // 0..1 ciclo giorno/notte
let running = false;
let paused = false;

// entità
let car, carSpeed = 0, carSteer = 0;
const PLAYER_BASE_MAX_SPEED = 24;
const PLAYER_SUPERCAR_MAX_SPEED = 52;
const PLAYER_TRUCK_MAX_SPEED = 15;
let player;
let mode = 'foot'; // 'foot' | 'car'

// visuale / mira con il mouse
let yaw = Math.PI;     // rotazione orizzontale della visuale (e del personaggio a piedi)
let pitch = 0.08;       // rotazione verticale della visuale
let pointerLocked = false;
let aiming = false;
let touchMoveIntensity = 1;
let touchMoveSensitivity = 1;
const MOUSE_SENS = 0.0022;
const aimDir = new THREE.Vector3(0, 0, 1); // direzione di mira aggiornata ogni frame, usata per sparare
let pedestrians = [];
let policeCars = [];
let policeHelicopters = [];
let worldVehicles = []; // auto guidabili nel mondo (quella iniziale + quelle civili rubabili)
let coins = [];
let missionMarker = null;
let bullets = []; // effetti visivi proiettile (linee brevi)
let deathAnimations = [];
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

const PLAYER_HOME = new THREE.Vector3(-175, 0, -153);
const CAR_SPAWN = new THREE.Vector3(-168, 0, -166);

function initAudio() { GameAudio.initAudio(); }
function playGunshot(weaponKey) { GameAudio.playGunshot(weaponKey); }
function playKillSound() { GameAudio.playKillSound(); }
function playCrashSound(strength) { GameAudio.playCrashSound(strength); }
function playReloadStartSound() { GameAudio.playReloadStartSound(); }
function playReloadCompleteSound() { GameAudio.playReloadCompleteSound(); }
function playEmptyAmmoSound() { GameAudio.playEmptyAmmoSound(); }
function playWeaponSwitchSound() { GameAudio.playWeaponSwitchSound(); }
function playCoinPickupSound() { GameAudio.playCoinPickupSound(); }
function updateSiren(dt) {
  GameAudio.updateSiren(dt, {policeCars, policeHelicopters, mode, car, player, dist2D});
}

// ---------------------------------------------------------------------