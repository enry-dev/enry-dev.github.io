const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

canvas.width = width;
canvas.height = height;

const letters = "010101010101010101010101010101010101010101010101";
const fontSize = 16;
let columns = Math.floor(width / fontSize);

// Drops inizializzati a valori casuali per avere cascata mista fin da subito
let drops = Array.from({length: columns}, () => Math.floor(Math.random() * height / fontSize));

function drawMatrix() {
  // Sfondo semi-trasparente per effetto scia
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#00FF00";
  ctx.font = fontSize + "px Share Tech Mono";

  for (let i = 0; i < drops.length; i++) {
    const text = letters[Math.floor(Math.random() * letters.length)];
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);

    if (drops[i] * fontSize > height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}

let interval = setInterval(drawMatrix, 50);

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  columns = Math.floor(width / fontSize);
  // re-inizializza drops casuali
  drops = Array.from({length: columns}, () => Math.floor(Math.random() * height / fontSize));
});