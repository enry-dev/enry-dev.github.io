const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');

const loadingSteps = [
  '[OK] Kernel loaded...',
  '[OK] Modules mounted...',
  '[OK] Assets compiled...',
  '[READY] System online.',
];

let stepIndex = 0;
let charIndex = 0;

function typeStep() {
  if (stepIndex >= loadingSteps.length) {
    setTimeout(() => loader.classList.add('hidden'), 500);
    return;
  }

  const currentStep = loadingSteps[stepIndex];

  if (charIndex < currentStep.length) {
    loaderText.innerHTML += currentStep[charIndex];
    charIndex++;
    setTimeout(typeStep, 50);
  } else {
    charIndex = 0;
    stepIndex++;
    loaderText.innerHTML += '<br>'; // va a capo
    setTimeout(typeStep, 400);
  }
}

// Inizia con primo step vuoto
loaderText.textContent = '';
typeStep();

// =====================
// NAVBAR: scroll shadow & active link
// =====================
const navbar = document.getElementById('navbar');
const navLinks = document.querySelectorAll('.nav-links a');
const sections = document.querySelectorAll('section');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);

  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) {
      current = sec.getAttribute('id');
    }
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  });
}, { passive: true });

// =====================
// HAMBURGER MENU
// =====================
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
  });
});

// =====================
// INTERSECTION OBSERVER: section fade-in
// =====================
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.1 }
);

sections.forEach(sec => observer.observe(sec));

// =====================
// SMOOTH SCROLL
// =====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// =====================
// TYPEWRITER on subtitle
// =====================
const subtitle = document.querySelector('.subtitle');
let subtitleText = '';
if (subtitle) {
  subtitleText = subtitle.textContent;
  subtitle.textContent = '';
  subtitle.style.visibility = 'visible';
  let i = 0;

  setTimeout(() => {
    const typeInterval = setInterval(() => {
      subtitle.textContent += subtitleText[i];
      i++;
      if (i >= subtitleText.length) clearInterval(typeInterval);
    }, 60);
  }, loadingSteps.length * 400 + 400);
}

// =====================
// LANGUAGE SWITCHER
// =====================
let currentLang = localStorage.getItem('lang') || 'it';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.setAttribute('lang', lang);

  // Translate all elements with data-it / data-en
  document.querySelectorAll('[data-it][data-en]').forEach(el => {
    const text = el.getAttribute('data-' + lang);
    if (text !== null) {
      // Use innerHTML to support <strong> and similar tags inside translations
      el.innerHTML = text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    }
  });

  // Update active button state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
}

// Init language on page load
applyLang(currentLang);

// Bind buttons
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyLang(btn.getAttribute('data-lang'));
  });
});
