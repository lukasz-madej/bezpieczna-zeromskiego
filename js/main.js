/* ═══════════════════════════════════════════════════════════
   Bezpieczna Żeromskiego – main.js
   ═══════════════════════════════════════════════════════════ */

// ── Mobile nav toggle ──
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
});

// Close nav when a link is clicked (mobile)
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
  });
});

// ── Navbar scroll shadow ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.style.boxShadow = window.scrollY > 10
    ? '0 4px 24px rgba(0,0,0,.45)'
    : '0 2px 16px rgba(0,0,0,.35)';
}, { passive: true });

// ── Active nav link on scroll ──
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
}, { threshold: 0.35 });

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

document.querySelectorAll('[data-gallery]').forEach(gallery => {
  const thumbs = gallery.querySelectorAll('.gallery-thumb');
  const imgs = Array.from(thumbs).map(t => ({
    src:     t.querySelector('img').src,
    alt:     t.querySelector('img').alt,
    caption: t.querySelector('figcaption')?.textContent || ''
  }));

  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => {
      lbImages = imgs;
      lbShow(i);
    });
  });
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
Promise.all([
  fetch('data/signatures.json').then(r => r.ok ? r.json() : Promise.reject()).catch(() => null),
  fetch('data/signatures-manual.json').then(r => r.ok ? r.json() : Promise.reject()).catch(() => null)
]).then(([online, manual]) => {
  const el = document.getElementById('petycjaCounterNum');
  const breakdownEl = document.getElementById('petycjaCounterBreakdown');
  const onlineCount = online && online.count != null ? online.count : null;
  const manualCount = manual && manual.count != null ? manual.count : null;
  const total = (onlineCount || 0) + (manualCount || 0);

  if (el && (onlineCount != null || manualCount != null)) {
    el.textContent = total.toLocaleString('pl-PL');
  }

  if (breakdownEl && onlineCount != null && manualCount != null) {
    breakdownEl.textContent =
      `${onlineCount.toLocaleString('pl-PL')} podpisów online + ` +
      `${manualCount.toLocaleString('pl-PL')} zebranych osobiście podczas zbiórek.`;
  }
});

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
  function enhanceNewsPhotos(body) {
    const paragraphs = Array.from(body.querySelectorAll('p'));
    let group = [];

    function flushGroup() {
      if (group.length === 0) return;
      const gallery = document.createElement('div');
      gallery.className = 'news-gallery';
      if (group.length === 1) gallery.classList.add('news-gallery--single');
      group[0].parentNode.insertBefore(gallery, group[0]);
      group.forEach(p => {
        gallery.appendChild(p.querySelector('img'));
        p.remove();
      });
      group = [];
    }

    paragraphs.forEach(p => {
      const onlyImg = p.children.length === 1 && p.children[0].tagName === 'IMG' && p.textContent.trim() === '';
      if (onlyImg) {
        group.push(p);
      } else if (group.length) {
        flushGroup();
      }
    });
    if (group.length) flushGroup();

    body.querySelectorAll('.news-gallery img').forEach(img => {
      img.loading = 'lazy';
      img.addEventListener('click', () => window.open(img.src, '_blank', 'noopener'));
    });
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

  const PER_PAGE = 3;
  let currentPage = 1;
  const totalPages = () => Math.ceil(allPosts.length / PER_PAGE);

  function renderPage(page) {
    currentPage = page;
    const start = (page - 1) * PER_PAGE;
    const posts = allPosts.slice(start, start + PER_PAGE);

    list.innerHTML = posts.map((post, i) => `
      <article class="news-card${page === 1 && i === 0 ? ' news-card--latest' : ''}" id="news-${post.slug}" data-category="${(post.tags || [])[0] || ''}">
        <div class="news-card-inner">
          <div class="news-meta">
            <time class="news-date" datetime="${post.date}">${formatDate(post.date)}</time>
            <div class="news-tags">${tagHtml(post.tags)}</div>
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
      const post = posts[i];
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
    { latlng: [52.126949120736995, 21.312078427001115], color: BLACK, label: 'Wypadek' },
    { latlng: [52.13549811647438, 21.331725110821942], color: BLACK, label: 'Wypadek' },
    // Niebezpieczne przejścia (czerwone)
    { latlng: [52.12630515337814, 21.30982402744196], color: RED,    label: 'Niebezpieczne przejście – okolice numeru 111' },
    { latlng: [52.125545374621005, 21.30058028451581], color: RED,    label: 'Niebezpieczne przejście – okolice numeru 73' },
    { latlng: [52.13043316674988, 21.321825156094768], color: RED,    label: 'Niebezpieczne przejście – okolice numeru 106' },
    { latlng: [52.1327238596583, 21.326634153499533], color: RED,    label: 'Niebezpieczne przejście – okolice kościoła' },
    { latlng: [52.13285359213022, 21.326824920763126], color: RED,    label: 'Niebezpieczne przejście – okolice kościoła' },

    // Wyprzedzanie (pomarańczowe)
    { latlng: [52.12527680744669, 21.302425327617737], color: ORANGE, label: 'Niebezpieczne wyprzedzanie' },
    { latlng: [52.12575538333343, 21.2991234679028], color: ORANGE, label: 'Niebezpieczne wyprzedzanie' },
    { latlng: [52.127055432266054, 21.312573915062078], color: ORANGE, label: 'Niebezpieczne wyprzedzanie' },
    { latlng: [52.13074837745995, 21.323004688174663], color: ORANGE, label: 'Niebezpieczne wyprzedzanie' },
    { latlng: [52.13483980805939, 21.33002119315483], color: ORANGE, label: 'Niebezpieczne wyprzedzanie' },
    // Rejon szkoły (zielone)
    { latlng: [52.13653646456338, 21.333757832170935], color: GREEN,  label: 'Rejon SP8 – strefa szczególnej ochrony' },
  ];

  markers.forEach(({ latlng, color, label }) => {
    L.marker(latlng, { icon: circleIcon(color) })
      .addTo(map)
      .bindPopup(`<strong>${label}</strong>`);
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
  L.polyline(routeInvestment, { color: '#0d47ff', weight: 7, opacity: 0.55, smoothFactor: 0 }).addTo(map);

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
  L.polyline(routeMissing, { color: '#f5b400', weight: 6, opacity: 0.55, smoothFactor: 0 }).addTo(map);
})();
