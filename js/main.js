/* ═══════════════════════════════════════════════════════════
   Bezpieczna Żeromskiego – main.js
   ═══════════════════════════════════════════════════════════ */

// ── Footer year ──
const footerYear = document.getElementById('footerYear');
if (footerYear) footerYear.textContent = new Date().getFullYear();

// ── Mobile nav toggle ──
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

function closeNav() {
  navLinks.classList.remove('open');
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
});

// Close nav when a link is clicked (mobile)
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    closeNav();
  });
});

// Close nav on Escape, returning focus to the toggle button
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && navLinks.classList.contains('open')) {
    closeNav();
    navToggle.focus();
  }
});

// ── Navbar scroll shadow ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.style.boxShadow = window.scrollY > 10
    ? '0 4px 24px rgba(0,0,0,.45)'
    : '0 2px 16px rgba(0,0,0,.35)';
}, { passive: true });

// ── Sticky petition CTA ──
// Always visible; pins 20px above the footer once a fixed position would
// otherwise make it overlap/cover the footer content.
(function () {
  const stickyCta = document.getElementById('stickyCta');
  const footer = document.getElementById('kontakt');
  if (!stickyCta) return;

  const GAP_ABOVE_FOOTER = 20;
  const FIXED_BOTTOM_OFFSET = 24; // matches `bottom` in .sticky-cta CSS

  function update() {
    if (!footer) return;
    const ctaHeight = stickyCta.offsetHeight;
    const footerTopAbs = footer.getBoundingClientRect().top + window.scrollY;
    const pinnedTopAbs = footerTopAbs - GAP_ABOVE_FOOTER - ctaHeight;
    const fixedTopAbs = window.scrollY + window.innerHeight - FIXED_BOTTOM_OFFSET - ctaHeight;

    if (fixedTopAbs >= pinnedTopAbs) {
      stickyCta.classList.add('pinned');
      stickyCta.style.top = `${pinnedTopAbs}px`;
    } else {
      stickyCta.classList.remove('pinned');
      stickyCta.style.top = '';
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// ── Active nav link on scroll ──
// Uses a thin "detection band" near the top of the viewport (just below the
// sticky navbar) rather than requiring a fixed % of a section's total area
// to be visible — the latter never triggers for tall sections like #projekt.
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => a.classList.remove('active'));
      const active = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

sections.forEach(s => observer.observe(s));

// ── Animate elements into view ──
const animateEls = document.querySelectorAll(
  '.card, .problem-card, .stance-col, .analysis-entry, .opinia-card'
);

const fadeIn = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.transitionDelay = `${(i % 3) * 60}ms`;
      entry.target.classList.add('visible');
      fadeIn.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

animateEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(18px)';
  el.style.transition = 'opacity .45s ease, transform .45s ease';
  fadeIn.observe(el);
});

// Inject .visible rule via JS to avoid FOUC with CSS-only approaches
const style = document.createElement('style');
style.textContent = '.visible { opacity: 1 !important; transform: none !important; }';
document.head.appendChild(style);

// ── Lightbox ──
const lightbox  = document.getElementById('lightbox');
const lbImg     = document.getElementById('lbImg');
const lbCaption = document.getElementById('lbCaption');
const lbCounter = document.getElementById('lbCounter');

let lbImages = [];
let lbIndex  = 0;

function lbShow(index) {
  lbIndex = (index + lbImages.length) % lbImages.length;
  const item = lbImages[lbIndex];
  lbImg.src = item.src;
  lbImg.alt = item.alt;
  lbCaption.textContent = item.caption;
  lbCounter.textContent = `${lbIndex + 1} / ${lbImages.length}`;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function lbClose() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

// Shared helper: wires up a clickable/keyboard-operable element to open the
// lightbox at a given index within an image-descriptor array. Used both by
// the static analysis-section galleries and the dynamically-injected news
// galleries, so the click + keyboard-activation logic only lives in one place.
function wireLightboxTrigger(el, images, index) {
  if (el.tabIndex < 0 || !el.hasAttribute('tabindex')) el.tabIndex = 0;
  if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  if (!el.hasAttribute('aria-label')) {
    el.setAttribute('aria-label', images[index].alt || 'Powiększ zdjęcie');
  }
  const open = () => { lbImages = images; lbShow(index); };
  el.addEventListener('click', open);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
}

document.querySelectorAll('[data-gallery]').forEach(gallery => {
  const thumbs = gallery.querySelectorAll('.gallery-thumb');
  const imgs = Array.from(thumbs).map(t => ({
    src:     t.querySelector('img').src,
    alt:     t.querySelector('img').alt,
    caption: t.querySelector('figcaption')?.textContent || ''
  }));

  thumbs.forEach((thumb, i) => wireLightboxTrigger(thumb, imgs, i));
});

document.getElementById('lbClose').addEventListener('click', lbClose);
document.getElementById('lbPrev').addEventListener('click', () => lbShow(lbIndex - 1));
document.getElementById('lbNext').addEventListener('click', () => lbShow(lbIndex + 1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) lbClose(); });

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')      lbClose();
  if (e.key === 'ArrowLeft')   lbShow(lbIndex - 1);
  if (e.key === 'ArrowRight')  lbShow(lbIndex + 1);
});

// ── Petition signature counter ──
// Total = signatures collected online (petycjeonline.com, scraped by cron)
//       + signatures gathered manually on paper (entered by hand in signatures-manual.json)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animates a number from `from` to `to` over `duration`ms (ease-out cubic),
// skipping straight to the final value if the user prefers reduced motion.
function animateNumber(el, from, to, duration, formatFn) {
  if (!el) return;
  if (prefersReducedMotion || from === to) {
    el.textContent = formatFn(to);
    return;
  }
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatFn(Math.round(from + (to - from) * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

let petycjaData = null;
let petycjaAnimated = false;
let petycjaInView = false;

function maybeAnimatePetycja() {
  if (petycjaAnimated || !petycjaData || !petycjaInView) return;
  petycjaAnimated = true;

  const { onlineCount, manualCount, total } = petycjaData;
  const el = document.getElementById('petycjaCounterNum');
  if (el) animateNumber(el, 0, total, 1200, n => n.toLocaleString('pl-PL'));

  if (onlineCount != null || manualCount != null) updatePetycjaProgress(total, { animate: true });
}

const petycjaSection = document.getElementById('petycja');
if (petycjaSection) {
  const petycjaObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        petycjaInView = true;
        maybeAnimatePetycja();
      }
    });
  }, { threshold: 0.3 });
  petycjaObserver.observe(petycjaSection);
}

Promise.all([
  fetch('data/signatures.json').then(r => r.ok ? r.json() : Promise.reject()).catch(() => null),
  fetch('data/signatures-manual.json').then(r => r.ok ? r.json() : Promise.reject()).catch(() => null)
]).then(([online, manual]) => {
  const breakdownEl = document.getElementById('petycjaCounterBreakdown');
  const onlineCount = online && online.count != null ? online.count : null;
  const manualCount = manual && manual.count != null ? manual.count : null;
  const total = (onlineCount || 0) + (manualCount || 0);

  if (breakdownEl && onlineCount != null && manualCount != null) {
    breakdownEl.textContent =
      `${onlineCount.toLocaleString('pl-PL')} podpisów online + ` +
      `${manualCount.toLocaleString('pl-PL')} zebranych osobiście podczas zbiórek.`;
  }

  petycjaData = { onlineCount, manualCount, total };
  maybeAnimatePetycja();
});

// ── Signature milestone progress bar ──
// Three independent goals (250 / 500 / 1000), each with its own bar and
// percentage toward that specific target — avoids any ambiguity between a
// shared bar's fill and evenly-spaced milestone markers.
function celebrateGoal(goalEl, milestone) {
  const flagKey = `petycja-celebrated-${milestone}`;
  if (localStorage.getItem(flagKey)) return;
  localStorage.setItem(flagKey, '1');
  if (prefersReducedMotion || !goalEl) return;

  const colors = ['#ffb300', '#ff8c00', '#2e7d32', '#0d47ff', '#ffffff'];
  const burst = document.createElement('div');
  burst.className = 'petycja-confetti';
  for (let i = 0; i < 16; i++) {
    const piece = document.createElement('span');
    piece.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty('--rot', `${(Math.random() - 0.5) * 360}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 120}ms`);
    piece.style.background = colors[i % colors.length];
    burst.appendChild(piece);
  }
  goalEl.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: false });
  setTimeout(() => burst.remove(), 1600);
}

function updatePetycjaProgress(total, { animate = false } = {}) {
  const goals = [
    { milestone: 250, fill: document.getElementById('goal250Fill'), percent: document.getElementById('goal250Percent'), el: document.getElementById('goal250') },
    { milestone: 500, fill: document.getElementById('goal500Fill'), percent: document.getElementById('goal500Percent'), el: document.getElementById('goal500') },
    { milestone: 1000, fill: document.getElementById('goal1000Fill'), percent: document.getElementById('goal1000Percent'), el: document.getElementById('goal1000') }
  ];

  goals.forEach(({ milestone, fill, percent, el }) => {
    if (!fill) return;
    const pct = Math.min(100, (total / milestone) * 100);
    const fromPct = animate ? 0 : parseFloat(percent?.textContent) || 0;
    fill.style.width = `${pct}%`;
    if (percent) animateNumber(percent, fromPct, pct, 1200, n => `${Math.round(n)}%`);
    const wasCompleted = el?.classList.contains('completed');
    const isCompleted = total >= milestone;
    if (el) el.classList.toggle('completed', isCompleted);
    if (isCompleted && !wasCompleted) celebrateGoal(el, milestone);
  });
}


// ── Share button (Web Share API with clipboard fallback) ──
(function () {
  const btn = document.getElementById('shareBtn');
  if (!btn) return;

  const shareData = {
    title: document.title,
    text: 'Podpisz petycję i wesprzyj bezpieczną ulicę Żeromskiego w Otwocku!',
    url: location.href
  };

  btn.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { /* user cancelled, ignore */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
      const original = btn.innerHTML;
      btn.textContent = 'Link skopiowany!';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    } catch (err) {
      // Clipboard API unavailable (e.g. insecure context) — nothing more we can do silently.
    }
  });
})();

// ── News section ──
(function () {
  const list = document.getElementById('newsList');
  if (!list) return;

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function tagHtml(tags) {
    const colourMap = { petycja: 'petycja', inicjatywa: 'inicjatywa', projekt: 'projekt', przetarg: 'przetarg', analiza: 'analizy', działania: 'petycja', mieszkańcy: 'inicjatywa', powiat: 'przetarg' };
    return (tags || []).map(t =>
      `<span class="news-tag news-tag-${colourMap[t] || ''}">${t}</span>`
    ).join('');
  }

  // Groups consecutive "image-only" paragraphs (produced by markdown like
  // `![alt](data/news/photos/<slug>/foo.jpg)`) into a responsive gallery grid,
  // and adds lazy-loading + a lightbox click-to-enlarge behaviour.
  // Handles both authoring styles: one image per paragraph (blank line
  // between each `![]()`) and several images crammed into one paragraph
  // (no blank lines between them) — both end up in the same gallery markup.
  function enhanceNewsPhotos(body) {
    const paragraphs = Array.from(body.querySelectorAll('p'));
    let group = [];

    function flushGroup() {
      if (group.length === 0) return;
      const images = group.flatMap(p => Array.from(p.querySelectorAll('img')));
      const gallery = document.createElement('div');
      gallery.className = 'news-gallery';
      if (images.length === 1) gallery.classList.add('news-gallery--single');
      group[0].parentNode.insertBefore(gallery, group[0]);
      images.forEach(img => gallery.appendChild(img));
      group.forEach(p => p.remove());
      group = [];
    }

    paragraphs.forEach(p => {
      const onlyImgs = p.textContent.trim() === '' &&
        p.children.length > 0 &&
        Array.from(p.children).every(child => child.tagName === 'IMG');
      if (onlyImgs) {
        group.push(p);
      } else if (group.length) {
        flushGroup();
      }
    });
    if (group.length) flushGroup();

    body.querySelectorAll('.news-gallery img').forEach(img => { img.loading = 'lazy'; });

    // Wire the gallery into the same lightbox used by the analysis section.
    const galleryImgs = Array.from(body.querySelectorAll('.news-gallery img')).map(img => ({
      src: img.src,
      alt: img.alt,
      caption: img.alt || ''
    }));
    body.querySelectorAll('.news-gallery img').forEach((img, i) => wireLightboxTrigger(img, galleryImgs, i));
  }

  function togglePost(post, btn, body) {
    if (body.classList.contains('open')) {
      body.classList.remove('open');
      btn.textContent = 'Czytaj więcej →';
      btn.setAttribute('aria-expanded', 'false');
      return;
    }
    if (body.dataset.loaded) {
      body.classList.add('open');
      btn.textContent = 'Zwiń ↑';
      btn.setAttribute('aria-expanded', 'true');
      return;
    }
    btn.textContent = 'Ładowanie…';
    fetch(`data/news/${post.slug}.md`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(md => {
        body.innerHTML = marked.parse(md);
        enhanceNewsPhotos(body);
        body.dataset.loaded = '1';
        body.classList.add('open');
        btn.textContent = 'Zwiń ↑';
        btn.setAttribute('aria-expanded', 'true');
      })
      .catch(() => {
        body.innerHTML = `<p>${post.excerpt}</p><p class="news-error">Pełna treść dostępna po otwarciu strony przez serwer HTTP.</p>`;
        body.dataset.loaded = '1';
        body.classList.add('open');
        btn.textContent = 'Zwiń ↑';
        btn.setAttribute('aria-expanded', 'true');
      });
  }

  const allPosts = (window.newsIndex || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!allPosts.length) {
    list.innerHTML = '<p class="news-empty">Brak aktualności.</p>';
    return;
  }

  // "Nowe" badge for posts published within the last 2 weeks.
  const NEW_BADGE_DAYS = 1;
  const now = new Date();
  function isRecent(dateStr) {
    const diffDays = (now - new Date(dateStr)) / 86400000;
    return diffDays >= 0 && diffDays <= NEW_BADGE_DAYS;
  }

  // ── Tag filter ──
  const filtersEl = document.getElementById('newsFilters');
  const allTags = Array.from(new Set(allPosts.flatMap(p => p.tags || []))).sort();
  let activeTag = null;

  function renderFilters() {
    if (!filtersEl || !allTags.length) return;
    filtersEl.innerHTML = [
      `<button type="button" class="news-filter-btn${activeTag === null ? ' active' : ''}" data-tag="">Wszystkie</button>`,
      ...allTags.map(t => `<button type="button" class="news-filter-btn${activeTag === t ? ' active' : ''}" data-tag="${t}">${t}</button>`)
    ].join('');

    filtersEl.querySelectorAll('.news-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTag = btn.dataset.tag || null;
        renderFilters();
        renderPage(1);
      });
    });
  }
  renderFilters();

  const PER_PAGE = 3;
  let currentPage = 1;
  const filteredPosts = () => activeTag ? allPosts.filter(p => (p.tags || []).includes(activeTag)) : allPosts;
  const totalPages = () => Math.ceil(filteredPosts().length / PER_PAGE);

  function renderPage(page) {
    currentPage = page;
    const posts = filteredPosts();
    const start = (page - 1) * PER_PAGE;
    const pagePosts = posts.slice(start, start + PER_PAGE);

    if (!pagePosts.length) {
      list.innerHTML = '<p class="news-empty">Brak aktualności dla wybranego tagu.</p>';
      return;
    }

    list.innerHTML = pagePosts.map((post, i) => `
      <article class="news-card${page === 1 && i === 0 && !activeTag ? ' news-card--latest' : ''}" id="news-${post.slug}" data-category="${(post.tags || [])[0] || ''}">
        <div class="news-card-inner">
          <div class="news-meta">
            <time class="news-date" datetime="${post.date}">${formatDate(post.date)}</time>
            <div class="news-tags">${tagHtml(post.tags)}${isRecent(post.date) ? '<span class="news-badge-new">Nowe</span>' : ''}</div>
          </div>
          <h3 class="news-title">${post.title}</h3>
          <p class="news-excerpt">${post.excerpt}</p>
          <div class="news-body"></div>
          <div class="news-footer">
            <button class="news-toggle" aria-expanded="false">Czytaj więcej →</button>
          </div>
        </div>
      </article>
    `).join('') + renderPagination();

    list.querySelectorAll('.news-toggle').forEach((btn, i) => {
      const post = pagePosts[i];
      const card = document.getElementById(`news-${post.slug}`);
      const body = card.querySelector('.news-body');
      btn.addEventListener('click', () => togglePost(post, btn, body));
    });

    list.querySelectorAll('.news-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p !== currentPage) {
          renderPage(p);
          document.getElementById('aktualnosci').scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function renderPagination() {
    const total = totalPages();
    if (total <= 1) return '';
    const pages = Array.from({ length: total }, (_, i) => i + 1);
    return `<nav class="news-pagination" aria-label="Strony aktualności">
      ${pages.map(p => `
        <button class="news-page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}" aria-current="${p === currentPage ? 'page' : 'false'}">${p}</button>
      `).join('')}
    </nav>`;
  }

  renderPage(1);
})();

// ── Leaflet map – ul. Żeromskiego, Otwock ──
(function () {
  const mapEl = document.getElementById('zeromskiego-map');
  if (!mapEl) return;

  const map = L.map('zeromskiego-map', { scrollWheelZoom: false }).setView([52.13055215122221, 21.31194908202746], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  function circleIcon(color) {
    return L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10]
    });
  }

  const RED    = '#d82626';
  const ORANGE = '#ff8c00';
  const GREEN  = '#2e7d32';
  const BLACK = '#1a1a2e';
  const markers = [
    // Wypadki (czarne)
    { latlng: [52.126949120736995, 21.312078427001115], color: BLACK, label: 'Wypadek', category: 'wypadek' },
    { latlng: [52.13549811647438, 21.331725110821942], color: BLACK, label: 'Wypadek', category: 'wypadek' },
    { latlng: [52.12550765733675, 21.296552453628372], color: BLACK, label: 'Wypadek', category: 'wypadek' },

    // Niebezpieczne przejścia (czerwone)
    { latlng: [52.12630515337814, 21.30982402744196], color: RED,    label: 'Niebezpieczne przejście – okolice numeru 111', category: 'przejscie' },
    { latlng: [52.125545374621005, 21.30058028451581], color: RED,    label: 'Niebezpieczne przejście – okolice numeru 73', category: 'przejscie' },
    { latlng: [52.13043316674988, 21.321825156094768], color: RED,    label: 'Niebezpieczne przejście – okolice numeru 106', category: 'przejscie' },
    { latlng: [52.1327238596583, 21.326634153499533], color: RED,    label: 'Niebezpieczne przejście – okolice kościoła', category: 'przejscie' },
    { latlng: [52.13285359213022, 21.326824920763126], color: RED,    label: 'Niebezpieczne przejście – okolice kościoła', category: 'przejscie' },

    // Wyprzedzanie (pomarańczowe)
    { latlng: [52.12527680744669, 21.302425327617737], color: ORANGE, label: 'Niebezpieczne wyprzedzanie', category: 'wyprzedzanie' },
    { latlng: [52.12575538333343, 21.2991234679028], color: ORANGE, label: 'Niebezpieczne wyprzedzanie', category: 'wyprzedzanie' },
    { latlng: [52.127055432266054, 21.312573915062078], color: ORANGE, label: 'Niebezpieczne wyprzedzanie', category: 'wyprzedzanie' },
    { latlng: [52.13074837745995, 21.323004688174663], color: ORANGE, label: 'Niebezpieczne wyprzedzanie', category: 'wyprzedzanie' },
    { latlng: [52.13483980805939, 21.33002119315483], color: ORANGE, label: 'Niebezpieczne wyprzedzanie', category: 'wyprzedzanie' },
    // Rejon szkoły (zielone)
    { latlng: [52.13653646456338, 21.333757832170935], color: GREEN,  label: 'Rejon SP8 – strefa szczególnej ochrony', category: 'szkola' },
  ];

  // Grouped Leaflet layers per legend category, so clicking a legend item
  // can toggle a whole group's visibility on/off.
  const layersByCategory = {};
  function addToCategory(category, layer) {
    (layersByCategory[category] = layersByCategory[category] || []).push(layer);
  }

  markers.forEach(({ latlng, color, label, category }) => {
    const marker = L.marker(latlng, { icon: circleIcon(color) })
      .addTo(map)
      .bindPopup(`<strong>${label}</strong>`);
    addToCategory(category, marker);
  });

  // Street route polyline (approximate)
  const routeInvestment = [
    [52.12468986502938, 21.292481735136036],
    [52.125645056013454, 21.297117943428287],
    [52.12577494573984, 21.298333106115038],
    [52.1257168903873, 21.299355705191818],
    [52.125582200841016, 21.30035026618833],
    [52.125379156481166, 21.301436291826548],
    [52.12526792365071, 21.302324761862035],
    [52.125285882415554, 21.303772725725658],
    [52.12568097322305, 21.307092803636255],
    [52.12588863282582, 21.308308803652032],
    [52.127575564593485, 21.314376499217293],
    [52.12806940217995, 21.315341808213326],
    [52.128742808250344, 21.31636562078488],
    [52.129073490951654, 21.316854453068924],
    [52.12938028999382, 21.31793059164174],
    [52.13089763935421, 21.32357618713124],
    [52.13081683507113, 21.323298295147538],
    [52.13107720390305, 21.32408809341702],
    [52.13282043621915, 21.326756511040124],
    [52.13419189462148, 21.32883177754347],
    [52.1348512704597, 21.330037360048316],
    [52.13574961835744, 21.332500125989718],
    [52.13626212924084, 21.3335180692645],
    [52.13690016926352, 21.33447885775998],
  ];
  const investmentLine = L.polyline(routeInvestment, { color: '#0d47ff', weight: 7, opacity: 0.55, smoothFactor: 0 }).addTo(map);
  addToCategory('inwestycja', investmentLine);

  const routeMissing = [
    [
      [52.12419815322482, 21.290984784167797],
      [52.12441636356078, 21.29179411439967],
      [52.12457936335553, 21.292432157809984],
    ],
    [
      [52.13279115316615, 21.326860007034785],
      [52.13407634778414, 21.32880693941929],
      [52.134575823366866, 21.329663834796353],
      [52.1348712664991, 21.330380432441377],
      [52.13541312796806, 21.33191507378464],
      [52.135966906221114, 21.33323387246335],
      [52.13629678520432, 21.333760528563477],
      [52.136482258267755, 21.334004430774364],
    ],
  ];
  const missingLine = L.polyline(routeMissing, { color: '#f5b400', weight: 6, opacity: 0.55, smoothFactor: 0 }).addTo(map);
  addToCategory('braki', missingLine);

  // ── Legend: click a category to toggle its markers/lines on the map ──
  document.querySelectorAll('#mapLegend .legend-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;
      const layers = layersByCategory[category] || [];
      const willHide = item.classList.toggle('inactive');
      layers.forEach(layer => {
        if (willHide) map.removeLayer(layer);
        else layer.addTo(map);
      });
    });
  });
})();

// ── Supporters: truncated bios with "read more" modal ──
// Only cards inside ".supporters-grid.columns" get truncated/expandable bios,
// so that all cards in those grids share the same height.
(function () {
  const modal = document.getElementById('supporterModal');
  if (!modal) return;

  const modalLogo = document.getElementById('supporterModalLogo');
  const modalName = document.getElementById('supporterModalName');
  const modalDetails = document.getElementById('supporterModalDetails');
  const modalBody = document.getElementById('supporterModalBody');
  const modalClose = document.getElementById('supporterModalClose');

  function openModal(card) {
    const logoHtml = card.querySelector('.supporter-logo').innerHTML;
    const name = card.querySelector('.supporter-info strong')?.textContent || '';
    const details = card.querySelector('.supporter-details')?.textContent || '';
    const bioParagraphs = Array.from(card.querySelectorAll('.supporter-info p:not(.supporter-details)'));

    modalLogo.innerHTML = logoHtml;
    modalName.textContent = name;
    modalDetails.textContent = details;
    modalBody.innerHTML = bioParagraphs.map(p => `<p>${p.textContent}</p>`).join('');

    modal.showModal();
  }

  modalClose.addEventListener('click', () => modal.close());
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.close(); // click on backdrop
  });

  document.querySelectorAll('.supporters-grid.columns .supporter-card').forEach(card => {
    const bioParagraphs = card.querySelectorAll('.supporter-info p:not(.supporter-details)');
    if (!bioParagraphs.length) return;
    const bio = bioParagraphs[bioParagraphs.length - 1];

    // Detect overflow against the default 5-line clamp; if the text is
    // longer than that, drop to a 4-line clamp and use the freed 5th line
    // for the "read more" link, so it reads as a natural continuation.
    if (bio.scrollHeight - bio.clientHeight > 1) {
      bio.classList.add('supporter-bio--clamped');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'supporter-more-btn';
      btn.textContent = 'Czytaj więcej →';
      btn.addEventListener('click', () => openModal(card));
      bio.insertAdjacentElement('afterend', btn);
    }
  });
})();
