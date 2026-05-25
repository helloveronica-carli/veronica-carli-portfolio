// ====================================
//  PLAYGROUND — flip carte + reshuffle
// ====================================
(function () {
  const stage = document.getElementById('cardStage');
  if (!stage) return;
  const cards = stage.querySelectorAll('.card');

  // Click su una carta: flip; se ce n'è un'altra aperta, chiudila prima
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasFlipped = card.classList.contains('flipped');
      cards.forEach(c => c.classList.remove('flipped'));
      if (!wasFlipped) card.classList.add('flipped');
    });
  });

  // Click fuori dalle carte: chiudi tutte
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-stage')) {
      cards.forEach(c => c.classList.remove('flipped'));
    }
  });

  // Tasto Escape: chiudi
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cards.forEach(c => c.classList.remove('flipped'));
  });

  // Reshuffle: rilancia l'animazione di "deal-out"
  const reshuffle = document.getElementById('reshuffleBtn');
  if (reshuffle) {
    reshuffle.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('flipped'));
      cards.forEach(c => {
        c.style.animation = 'none';
        // force reflow
        void c.offsetWidth;
        c.style.animation = '';
      });
    });
  }

  // ============ POPUP PROGETTI ============
  const popup       = document.getElementById('projectPopup');
  const popupClose  = document.getElementById('popupClose');
  const popupBack   = document.getElementById('popupBackdrop');
  if (!popup) return;

  const popupWindow = popup.querySelector('.popup-window');
  const hero        = popup.querySelector('[data-hero]');
  const heroImg     = popup.querySelector('[data-img-el]');
  const tagEl       = popup.querySelector('[data-tag]');
  const titleEl     = popup.querySelector('[data-title]');
  const descEl      = popup.querySelector('[data-desc]');
  const galleryWrap = popup.querySelector('[data-gallery-wrap]');
  const galleryGrid = popup.querySelector('[data-gallery-grid]');
  const ctaWrap     = popup.querySelector('[data-cta-wrap]');
  const ctaEl       = popup.querySelector('[data-cta]');
  const ctaLabel    = popup.querySelector('[data-cta-label]');

  function openPopup(link) {
    // Colore tematico ereditato dalla carta genitore
    const parentCard = link.closest('.card');
    const color = parentCard
      ? (parentCard.style.getPropertyValue('--card-color').trim() || '#555')
      : '#555';
    popupWindow.style.setProperty('--popup-color', color);

    // Tag, titolo, descrizione
    tagEl.textContent   = link.dataset.tag   || '';
    titleEl.textContent = link.dataset.title || link.textContent;
    descEl.textContent  = link.dataset.desc  || '';

    // Hero image (se presente)
    if (link.dataset.img) {
      heroImg.src = link.dataset.img;
      heroImg.alt = link.dataset.title || '';
      hero.classList.add('has-image');
    } else {
      heroImg.removeAttribute('src');
      hero.classList.remove('has-image');
    }

    // Gallery: se data-gallery presente popola con immagini, altrimenti 3 placeholder
    galleryGrid.innerHTML = '';
    const galleryUrls = (link.dataset.gallery || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    if (galleryUrls.length > 0) {
      galleryUrls.forEach(url => {
        const tile = document.createElement('div');
        tile.className = 'popup-gallery-tile';
        tile.style.backgroundImage = `url("${url}")`;
        galleryGrid.appendChild(tile);
      });
    } else {
      for (let i = 0; i < 3; i++) {
        const tile = document.createElement('div');
        tile.className = 'popup-gallery-tile is-placeholder';
        galleryGrid.appendChild(tile);
      }
    }
    galleryWrap.style.display = '';

    // CTA opzionale
    if (link.dataset.ctaUrl) {
      ctaEl.href = link.dataset.ctaUrl;
      ctaLabel.textContent = link.dataset.ctaLabel || 'Vai al progetto';
      ctaWrap.style.display = '';
    } else {
      ctaWrap.style.display = 'none';
    }

    popup.classList.add('open');
    popup.setAttribute('aria-hidden', 'false');
    document.body.classList.add('popup-open');
    // Resetta lo scroll del popup all'apertura
    popupWindow.scrollTop = 0;
  }

  function closePopup() {
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('popup-open');
  }

  document.querySelectorAll('.card-projects a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPopup(link);
    });
  });

  popupClose.addEventListener('click', closePopup);
  popupBack.addEventListener('click', closePopup);

  // Tasto Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup.classList.contains('open')) closePopup();
  });
})();

// ====================================
//  MOBILE NAV — toggle hamburger / panel
// ====================================
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const panel  = document.querySelector('.mobile-nav');
  if (!toggle || !panel) return;

  function setOpen(state) {
    toggle.setAttribute('aria-expanded', state ? 'true' : 'false');
    panel.setAttribute('aria-hidden', state ? 'false' : 'true');
    panel.classList.toggle('open', state);
    document.body.classList.toggle('nav-open', state);
  }

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!open);
  });

  // Chiusura tap link
  panel.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => setOpen(false));
  });

  // Chiusura su Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
    }
  });

  // Re-chiudi se la finestra viene allargata oltre il breakpoint mobile
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
    }
  });
})();

// ====================================
//  HERO TILT 3D — mouse parallax on hero title
// ====================================
(function () {
  const hero = document.querySelector('.hero');
  const title = document.querySelector('.hero-title');
  if (!hero || !title) return;

  // Only on devices that have a real cursor + respect reduced motion
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || reduced) return;

  hero.style.perspective = '1200px';
  title.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
  title.style.transformStyle = 'preserve-3d';
  title.style.willChange = 'transform';

  let rafId = null;

  function onMove(e) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 .. 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      const maxRotate = 5;   // gradi max di tilt
      const maxShift = 10;   // px di parallax

      const rx = (-y * maxRotate).toFixed(2);
      const ry = ( x * maxRotate).toFixed(2);
      const tx = ( x * maxShift).toFixed(1);
      const ty = ( y * maxShift).toFixed(1);

      title.style.transform =
        `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(${tx}px, ${ty}px, 0)`;
      title.style.transition = 'transform 0.15s linear';
    });
  }

  function onLeave() {
    title.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
    title.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0,0,0)';
  }

  hero.addEventListener('mousemove', onMove);
  hero.addEventListener('mouseleave', onLeave);
})();

// ====================================
//  WORK LIST — cover image swap al hover (visibile solo durante hover)
// ====================================
(function () {
  const items = document.querySelectorAll('.work-list-item[data-project]');
  const cards = document.querySelectorAll('.cover-card[data-project]');
  if (!items.length || !cards.length) return;

  // Nessuna cover attiva al caricamento — appaiono solo all'hover
  function activate(project) {
    cards.forEach(c => c.classList.toggle('active', c.dataset.project === project));
  }
  function deactivateAll() {
    cards.forEach(c => c.classList.remove('active'));
  }

  items.forEach(item => {
    item.addEventListener('mouseenter', () => activate(item.dataset.project));
    item.addEventListener('focus',      () => activate(item.dataset.project));
    item.addEventListener('blur',       deactivateAll);
  });

  // Quando il mouse esce dalla lista intera (non tra item adiacenti), fai sparire
  const list = document.querySelector('.work-list');
  if (list) list.addEventListener('mouseleave', deactivateAll);
})();

// ====================================
//  TOOLS MARQUEE — loop infinito veramente seamless
//  Clona gli item finché la track non è abbastanza larga per lo schermo,
//  e setta --set-width così l'animazione trasla di esattamente un set.
// ====================================
(function () {
  const track = document.querySelector('.tools-track');
  if (!track) return;

  const originalItems = Array.from(track.children);
  if (originalItems.length === 0) return;

  function setupMarquee() {
    // Rimuovo eventuali cloni esistenti (es. dopo resize)
    track.querySelectorAll('[data-clone="1"]').forEach(el => el.remove());

    // Misura larghezza di una "set" (gli 8 item originali, padding compreso)
    const setWidth = originalItems.reduce(
      (sum, el) => sum + el.getBoundingClientRect().width, 0
    );
    if (setWidth === 0) return;  // immagini non ancora caricate

    // Setta la variabile CSS per il keyframe
    track.style.setProperty('--set-width', setWidth + 'px');

    // Aggiungi cloni finché il track non copre almeno (viewport × 2 + 1 set)
    const target = window.innerWidth * 2 + setWidth;
    let currentWidth = setWidth;
    while (currentWidth < target) {
      originalItems.forEach(item => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.dataset.clone = '1';
        track.appendChild(clone);
      });
      currentWidth += setWidth;
    }
  }

  // Aspetta che le immagini siano caricate (servono dimensioni reali)
  // Ogni volta che una image carica, ri-eseguiamo il setup per essere safe
  const imgs = track.querySelectorAll('img');
  imgs.forEach(img => {
    if (img.complete && img.naturalWidth > 0) return;
    img.addEventListener('load',  setupMarquee, { once: true });
    img.addEventListener('error', setupMarquee, { once: true });
  });

  // Esegui subito un primo tentativo (potrebbe usare width 0 e fallire silenziosamente)
  setupMarquee();
  // Fallback di sicurezza dopo 800ms (a quel punto le SVG/PNG da pochi KB sono sicuramente caricate)
  setTimeout(setupMarquee, 800);
  // E un altro più tardi per resilienza estrema (es. immagine bloccata da rete lenta)
  setTimeout(setupMarquee, 2500);

  // Re-setup quando si ridimensiona la finestra
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setupMarquee, 200);
  }, { passive: true });
})();

// ====================================
//  ABOUT HERO — la foto si rimpicciolisce su scroll
// ====================================
(function () {
  const aboutHero = document.querySelector('.about-hero');
  if (!aboutHero) return;

  const img = aboutHero.querySelector('.about-hero-bg img');
  const overlay = aboutHero.querySelector('.about-hero-overlay');
  if (!img || !overlay) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  img.style.transformOrigin = 'center center';
  img.style.willChange = 'transform, border-radius';
  overlay.style.transformOrigin = 'center center';
  overlay.style.willChange = 'transform, border-radius';

  let rafId = null;

  function update() {
    const rect = aboutHero.getBoundingClientRect();
    const total = aboutHero.offsetHeight - window.innerHeight;
    const scrolled = Math.max(0, -rect.top);
    const progress = total > 0 ? Math.max(0, Math.min(1, scrolled / total)) : 0;

    const scale = 1 - progress * 0.28;       // 1 → 0.72
    const radius = progress * 32;            // 0 → 32px

    const t = `scale(${scale.toFixed(4)})`;
    img.style.transform = t;
    overlay.style.transform = t;
    img.style.borderRadius = `${radius.toFixed(1)}px`;
    overlay.style.borderRadius = `${radius.toFixed(1)}px`;
  }

  window.addEventListener('scroll', () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener('resize', update, { passive: true });
  update();
})();

// ====================================
//  LANGUAGE SWITCH IT / EN
// ====================================
(function () {
  const buttons = document.querySelectorAll('.lang-switch button');
  if (!buttons.length) return;

  const STORAGE_KEY = 'vc-lang';
  const savedLang = localStorage.getItem(STORAGE_KEY) || 'it';

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-it][data-en]').forEach((el) => {
      const text = el.getAttribute('data-' + lang);
      if (text !== null) el.textContent = text;
    });

    document.querySelectorAll('[data-it-html][data-en-html]').forEach((el) => {
      const html = el.getAttribute('data-' + lang + '-html');
      if (html !== null) el.innerHTML = html;
    });

    document.querySelectorAll('.lang-switch button').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  applyLang(savedLang);

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      localStorage.setItem(STORAGE_KEY, lang);
      applyLang(lang);
    });
  });
})();
