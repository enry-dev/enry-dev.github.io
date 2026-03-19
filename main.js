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

// =====================
// PROJECTS DATA
// =====================
const projectsContainer = document.getElementById('projectsContainer');

async function loadProjects() {
  if (!projectsContainer) return;

  try {
    const response = await fetch('data/projects.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch projects.json (${response.status})`);
    }
    const projects = await response.json();
    if (!Array.isArray(projects)) {
      throw new Error('projects.json did not return an array');
    }
    renderProjectCards(projects);
  } catch (error) {
    console.error('Unable to load projects', error);
    projectsContainer.innerHTML = '<p class="project-error" data-it="Impossibile caricare i progetti." data-en="Unable to load projects.">Unable to load projects.</p>';
    applyLang(currentLang);
  }
}

function renderProjectCards(projects) {
  if (!projectsContainer) return;
  const fragment = document.createDocumentFragment();

  projects.forEach(project => {
    const card = document.createElement('div');
    card.className = 'project-card';

    const header = document.createElement('div');
    header.className = 'project-header';

    const icon = document.createElement('span');
    icon.className = 'project-icon';
    icon.textContent = project.icon || '🧩';

    const status = document.createElement('span');
    status.className = 'project-status';
    status.textContent = project.status || '';
    header.append(icon, status);

    const title = document.createElement('h3');
    title.textContent = project.name || '';

    const descriptionEl = document.createElement('p');
    const descriptionIt = project.description?.it || '';
    const descriptionEn = project.description?.en || descriptionIt;
    descriptionEl.setAttribute('data-it', descriptionIt);
    descriptionEl.setAttribute('data-en', descriptionEn);
    descriptionEl.innerHTML = project.description?.[currentLang] || descriptionIt;

    const tags = Array.isArray(project.tags) ? project.tags : [];
    let tagsWrapper;
    if (tags.length) {
      tagsWrapper = document.createElement('div');
      tagsWrapper.className = 'project-tags';
      tags.forEach(tagValue => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = tagValue;
        tagsWrapper.appendChild(tag);
      });
    }

    const linkEl = document.createElement('a');
    linkEl.className = 'project-link';
    const linkLabelSource = project.linkLabel;
    const defaultLabel = typeof linkLabelSource === 'string'
      ? linkLabelSource
      : (linkLabelSource?.en || linkLabelSource?.it || 'View on GitHub →');
    const labelIt = (typeof linkLabelSource === 'object' && linkLabelSource.it) ? linkLabelSource.it : defaultLabel;
    const labelEn = (typeof linkLabelSource === 'object' && linkLabelSource.en) ? linkLabelSource.en : defaultLabel;
    linkEl.setAttribute('data-it', labelIt);
    linkEl.setAttribute('data-en', labelEn);
    linkEl.innerHTML = currentLang === 'en' ? labelEn : labelIt;

    if (project.link) {
      linkEl.href = project.link;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
    } else {
      linkEl.classList.add('disabled');
      linkEl.setAttribute('aria-disabled', 'true');
    }

    card.append(header, title, descriptionEl);
    if (tagsWrapper) {
      card.append(tagsWrapper);
    }
    card.append(linkEl);
    fragment.appendChild(card);
  });

  projectsContainer.innerHTML = '';
  projectsContainer.appendChild(fragment);
  applyLang(currentLang);
}

loadProjects();
