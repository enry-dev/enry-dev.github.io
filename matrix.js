const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

const CHARS = '01010101010101010101010101010101010101010101010101';
const FONT_SIZE = 14;
let width, height, columns, drops;

function getStopHeight() {
  // Canvas alto quanto header + navbar
  const header = document.querySelector('header');
  const navbar = document.getElementById('navbar');
  const h = (header ? header.offsetHeight : 0) + (navbar ? navbar.offsetHeight : 0);
  return h > 0 ? h : window.innerHeight;
}

function init() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = getStopHeight();
  columns = Math.floor(width / FONT_SIZE);
  drops = Array.from({ length: columns }, () =>
    Math.floor(Math.random() * (height / FONT_SIZE))
  );
}

function drawMatrix() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.fillRect(0, 0, width, height);

  ctx.font = `${FONT_SIZE}px 'Share Tech Mono', monospace`;

  for (let i = 0; i < drops.length; i++) {
    const char = CHARS[Math.floor(Math.random() * CHARS.length)];
    const y = drops[i] * FONT_SIZE;

    // Head char: brighter
    if (drops[i] > 0) {
      ctx.fillStyle = '#ccffcc';
      ctx.fillText(char, i * FONT_SIZE, y);
    }

    // Body char: green
    const prevChar = CHARS[Math.floor(Math.random() * CHARS.length)];
    ctx.fillStyle = '#00FF00';
    ctx.fillText(prevChar, i * FONT_SIZE, y - FONT_SIZE);

    if (y > height && Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }
}

// Wait for DOM layout before measuring heights
window.addEventListener('DOMContentLoaded', () => {
  init();
}, { once: true });

// Fallback if already loaded
if (document.readyState !== 'loading') {
  init();
}

let rafId;
let last = 0;

function throttledLoop(ts) {
  if (ts - last > 42) {
    drawMatrix();
    last = ts;
  }
  rafId = requestAnimationFrame(throttledLoop);
}

rafId = requestAnimationFrame(throttledLoop);

// Pause when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
  } else {
    last = 0;
    rafId = requestAnimationFrame(throttledLoop);
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(init, 200);
});
