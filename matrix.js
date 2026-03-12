const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

const CHARS = '01010101010101010101010101010101010101010101010101';
const FONT_SIZE = 14;
let width, height, columns, drops;
let rafId = null;
let last = 0;
let initialized = false;

function getStopHeight() {
  const header = document.querySelector('header');
  const navbar = document.getElementById('navbar');
  const h = (header ? header.offsetHeight : 0) + (navbar ? navbar.offsetHeight : 0);
  return h > 20 ? h : window.innerHeight;
}

function init() {
  // Usa window.innerWidth per evitare problemi con la viewport mobile
  width = window.innerWidth;
  height = getStopHeight();

  // Imposta le dimensioni pixel-perfect (devicePixelRatio per retina/mobile)
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  columns = Math.floor(width / FONT_SIZE);
  drops = Array.from({ length: columns }, () =>
    Math.floor(Math.random() * (height / FONT_SIZE))
  );

  initialized = true;
}

function drawMatrix() {
  if (!initialized) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(0, 0, width, height);

  ctx.font = FONT_SIZE + 'px monospace';

  for (let i = 0; i < drops.length; i++) {
    const char = CHARS[Math.floor(Math.random() * CHARS.length)];
    const y = drops[i] * FONT_SIZE;

    if (drops[i] > 0) {
      ctx.fillStyle = '#ccffcc';
      ctx.fillText(char, i * FONT_SIZE, y);
    }

    const prevChar = CHARS[Math.floor(Math.random() * CHARS.length)];
    ctx.fillStyle = '#00FF00';
    ctx.fillText(prevChar, i * FONT_SIZE, y - FONT_SIZE);

    if (y >= height && Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}

function throttledLoop(ts) {
  if (ts - last > 42) {
    drawMatrix();
    last = ts;
  }
  rafId = requestAnimationFrame(throttledLoop);
}

function startLoop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  last = 0;
  rafId = requestAnimationFrame(throttledLoop);
}

// Inizializzazione robusta: aspetta che header e navbar abbiano dimensioni reali
function tryInit() {
  const header = document.querySelector('header');
  const navbar = document.getElementById('navbar');
  if (header && header.offsetHeight > 0 && navbar && navbar.offsetHeight > 0) {
    init();
    startLoop();
  } else {
    // Riprova al prossimo frame finché il layout non è pronto
    requestAnimationFrame(tryInit);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInit, { once: true });
} else {
  // DOM già pronto (script in fondo al body)
  tryInit();
}

// Pausa tab nascosto
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  } else {
    startLoop();
  }
});

// Resize con debounce
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    init();
  }, 250);
});
