// ====================================
//  PLAYGROUND — flip carte + reshuffle
// ====================================
(function () {
  const stage = document.getElementById('cardStage');
  if (!stage) return;
  const cards = stage.querySelectorAll('.card');

  // ============ MOBILE: mazzo impilato + swipe ============
  const MOBILE_BREAKPOINT = 768;
  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;
  const SWIPE_THRESHOLD = 90;
  const cardsArr = Array.from(cards);
  let suppressNextClick = false;

  function applyStackOrder() {
    cardsArr.forEach((c, i) => c.dataset.stack = i);
  }
  function recycleTop() {
    // Trova la carta con stack=0, mettila in fondo, riassegna gli stack
    const top = cardsArr.find(c => c.dataset.stack === '0');
    if (!top) return;
    const others = cardsArr.filter(c => c !== top)
      .sort((a, b) => parseInt(a.dataset.stack) - parseInt(b.dataset.stack));
    others.forEach((c, i) => c.dataset.stack = i);
    top.dataset.stack = cardsArr.length - 1;
  }

  // Setup iniziale stack su mobile
  if (isMobile()) applyStackOrder();
  window.addEventListener('resize', () => {
    if (isMobile()) {
      applyStackOrder();
    } else {
      cardsArr.forEach(c => c.removeAttribute('data-stack'));
    }
  });

  // Swipe handler — applicato a tutte le carte ma agisce solo sulla top
  cardsArr.forEach(card => {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, isFlying = false;

    card.addEventListener('pointerdown', (e) => {
      if (!isMobile() || card.dataset.stack !== '0' || isFlying) return;
      // Non attivare drag se l'utente preme su un link
      if (e.target.closest('a')) return;
      startX = e.clientX;
      startY = e.clientY;
      dx = dy = 0;
      dragging = true;
      card.classList.add('is-dragging');
      try { card.setPointerCapture(e.pointerId); } catch(_) {}
    });

    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      // Solo drag laterale: rotazione progressiva proporzionale a dx
      const rot = dx / 16;
      card.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy * 0.3}px)) rotate(${rot}deg)`;
    });

    card.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('is-dragging');
      try { card.releasePointerCapture(e.pointerId); } catch(_) {}

      const dist = Math.abs(dx);
      const isHorizontal = Math.abs(dx) > Math.abs(dy);

      if (dist > SWIPE_THRESHOLD && isHorizontal) {
        // Carosello: fly out, teleport sull'altro lato, rientra in fondo al mazzo
        suppressNextClick = true;
        isFlying = true;
        card.classList.remove('flipped');
        card.classList.add('is-flying-out');

        const direction = dx > 0 ? 1 : -1;
        const w = window.innerWidth;
        const exitX = direction * (w + 200);
        const enterX = -direction * (w + 200);
        const exitRot = direction * 28;
        const enterRot = -direction * 12;

        // Step 1: animazione di uscita verso il lato del drag
        card.style.transform = `translate(calc(-50% + ${exitX}px), -50%) rotate(${exitRot}deg)`;

        setTimeout(() => {
          // Step 2: teleport instantaneo sull'altro lato (fuori vista)
          card.style.transition = 'none';
          card.style.transform = `translate(calc(-50% + ${enterX}px), -50%) rotate(${enterRot}deg)`;
          // Step 3: aggiorna ordine stack (la carta volata diventa l'ultima)
          recycleTop();
          // Forza reflow per applicare il teleport prima di riabilitare la transizione
          void card.offsetWidth;
          // Step 4: prossimo frame, rimuovi tutto: CSS data-stack=4 prende il controllo
          requestAnimationFrame(() => {
            card.style.transition = '';
            card.style.transform = '';
            card.classList.remove('is-flying-out');
            isFlying = false;
          });
        }, 450);
      } else if (dist > 5) {
        // Drag corto / verticale → snap back + blocca click
        suppressNextClick = true;
        card.style.transform = '';
      } else {
        // Movimento minimo → resta tap, lascia il click handler in pace
        card.style.transform = '';
      }
    });

    card.addEventListener('pointercancel', () => {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('is-dragging');
      card.style.transform = '';
    });
  });

  // Click su una carta: flip (se è la top su mobile, sempre su desktop).
  // Se è appena avvenuto uno swipe/drag, salta.
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (suppressNextClick) { suppressNextClick = false; return; }
      if (isMobile() && card.dataset.stack !== '0') {
        // Tap su carta non-top: portala in cima ciclando finché non ci arriva
        // Più semplice: ignoriamo il tap se non è top (forza lo swipe per cambiare)
        return;
      }
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

  let activeSnakeStop = null;

  // ---- SNAKE (omaggio Nokia 3310) ----
  function initSnakeGame(root) {
    const canvas = root.querySelector('.snake-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = root.querySelector('[data-snake-score]');
    const overlay = root.querySelector('[data-snake-overlay]');
    const overlayTitle = overlay.querySelector('.snake-overlay-title');
    const overlaySub = overlay.querySelector('.snake-overlay-sub');

    const GRID = 14;
    const CELL = canvas.width / GRID;
    const LCD_BG = '#aaca5a';
    const LCD_FG = '#2f3b1e';
    let snake, dir, nextDir, food, score, running = false, dead = false, timer = null;

    function placeFood() {
      do {
        food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      } while (snake.some(s => s.x === food.x && s.y === food.y));
    }
    function reset() {
      snake = [{x:7,y:7},{x:6,y:7},{x:5,y:7}];
      dir = {x:1,y:0}; nextDir = {x:1,y:0};
      score = 0; dead = false;
      scoreEl.textContent = '0';
      placeFood(); draw();
    }
    function draw() {
      ctx.fillStyle = LCD_BG; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = LCD_FG;
      ctx.fillRect(food.x*CELL+3, food.y*CELL+3, CELL-6, CELL-6);
      snake.forEach(s => ctx.fillRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2));
    }
    function tick() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x<0 || head.x>=GRID || head.y<0 || head.y>=GRID ||
          snake.some(s => s.x===head.x && s.y===head.y)) { gameOver(); return; }
      snake.unshift(head);
      if (head.x===food.x && head.y===food.y) { score++; scoreEl.textContent = score; placeFood(); }
      else snake.pop();
      draw();
    }
    function start() {
      if (running) return;
      if (dead) reset();
      running = true;
      overlay.style.display = 'none';
      timer = setInterval(tick, 130);
    }
    function gameOver() {
      clearInterval(timer); timer = null; running = false; dead = true;
      overlayTitle.textContent = 'Game Over';
      overlaySub.textContent = 'Score ' + score + ' · tocca per rigiocare';
      overlay.style.display = '';
    }
    function setDir(nx, ny) {
      if (nx === -dir.x && ny === -dir.y) return; // no inversione a U
      nextDir = { x:nx, y:ny };
    }
    function onKey(e) {
      let ok = true;
      switch (e.key) {
        case 'ArrowUp': case 'w': setDir(0,-1); break;
        case 'ArrowDown': case 's': setDir(0,1); break;
        case 'ArrowLeft': case 'a': setDir(-1,0); break;
        case 'ArrowRight': case 'd': setDir(1,0); break;
        default: ok = false;
      }
      if (ok) { e.preventDefault(); start(); }
    }
    document.addEventListener('keydown', onKey);

    root.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = btn.dataset.dir;
        if (d==='up') setDir(0,-1);
        else if (d==='down') setDir(0,1);
        else if (d==='left') setDir(-1,0);
        else if (d==='right') setDir(1,0);
        start();
      });
    });
    overlay.addEventListener('click', (e) => { e.stopPropagation(); start(); });
    canvas.addEventListener('click', (e) => e.stopPropagation());

    let sx = 0, sy = 0;
    canvas.addEventListener('pointerdown', (e) => { e.stopPropagation(); sx = e.clientX; sy = e.clientY; });
    canvas.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { start(); return; }
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx>0?1:-1, 0); else setDir(0, dy>0?1:-1);
      start();
    });

    reset();

    return function stop() {
      clearInterval(timer); timer = null; running = false;
      document.removeEventListener('keydown', onKey);
    };
  }

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

    // Gallery: priorità a snake → articoli → IG embeds → immagini → placeholder
    if (activeSnakeStop) { activeSnakeStop(); activeSnakeStop = null; }
    galleryGrid.innerHTML = '';
    galleryGrid.classList.remove('is-ig-embeds', 'is-articles', 'is-snake');

    if (link.dataset.snake === 'true') {
      galleryGrid.classList.add('is-snake');
      const wrap = document.createElement('div');
      wrap.className = 'snake-game';
      wrap.innerHTML =
        '<div class="snake-screen">' +
          '<canvas class="snake-canvas" width="280" height="280"></canvas>' +
          '<div class="snake-overlay" data-snake-overlay>' +
            '<span class="snake-overlay-title">Snake</span>' +
            '<span class="snake-overlay-sub">Premi una freccia o tocca per iniziare</span>' +
          '</div>' +
        '</div>' +
        '<div class="snake-hud"><span>Score</span><span data-snake-score>0</span></div>' +
        '<div class="snake-dpad">' +
          '<button type="button" data-dir="up" aria-label="Su">▲</button>' +
          '<div class="snake-dpad-mid">' +
            '<button type="button" data-dir="left" aria-label="Sinistra">◀</button>' +
            '<button type="button" data-dir="down" aria-label="Giù">▼</button>' +
            '<button type="button" data-dir="right" aria-label="Destra">▶</button>' +
          '</div>' +
        '</div>';
      galleryGrid.appendChild(wrap);
      activeSnakeStop = initSnakeGame(wrap);
      galleryWrap.style.display = '';
      // CTA off per snake
      ctaWrap.style.display = 'none';
      popup.classList.add('open');
      popup.setAttribute('aria-hidden', 'false');
      document.body.classList.add('popup-open');
      popupWindow.scrollTop = 0;
      return;
    }

    // data-articles = "img|url|title|excerpt|minutes ;; img|url|title|excerpt|minutes ;; ..."
    const articles = (link.dataset.articles || '')
      .split(';;').map(s => s.trim()).filter(Boolean)
      .map(item => {
        const [img, url, title, excerpt, minutes] = item.split('|').map(p => (p || '').trim());
        return { img, url, title, excerpt, minutes };
      });
    const igPosts = (link.dataset.igPosts || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const galleryUrls = (link.dataset.gallery || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    if (articles.length > 0) {
      galleryGrid.classList.add('is-articles');
      articles.forEach((a, i) => {
        const tile = document.createElement('a');
        tile.className = 'popup-article-tile' + (i === 0 ? ' is-hero' : '');
        tile.href = a.url || '#';
        tile.target = '_blank';
        tile.rel = 'noopener';

        const cover = document.createElement('div');
        cover.className = 'popup-article-cover';
        if (a.img) cover.style.backgroundImage = `url("${a.img}")`;
        tile.appendChild(cover);

        const info = document.createElement('div');
        info.className = 'popup-article-info';
        let html = '';
        if (a.title)   html += `<h4 class="popup-article-title">${a.title}</h4>`;
        if (a.excerpt) html += `<p class="popup-article-excerpt">${a.excerpt}</p>`;
        if (a.minutes) html += `<span class="popup-article-meta">${a.minutes}</span>`;
        info.innerHTML = html;
        tile.appendChild(info);

        galleryGrid.appendChild(tile);
      });
    } else if (igPosts.length > 0) {
      galleryGrid.classList.add('is-ig-embeds');
      igPosts.forEach(url => {
        const tile = document.createElement('div');
        tile.className = 'popup-gallery-tile';
        const bq = document.createElement('blockquote');
        bq.className = 'instagram-media';
        bq.setAttribute('data-instgrm-permalink', url);
        bq.setAttribute('data-instgrm-version', '14');
        bq.style.cssText = 'background:#FFF;border:0;border-radius:6px;margin:0;max-width:100%;min-width:260px;padding:0;width:100%;';
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Apri su Instagram';
        bq.appendChild(a);
        tile.appendChild(bq);
        galleryGrid.appendChild(tile);
      });
      // Forza il re-processing degli embed Instagram appena inseriti
      if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
      }
    } else if (galleryUrls.length > 0) {
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
    if (activeSnakeStop) { activeSnakeStop(); activeSnakeStop = null; }
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

  // Bottone X di chiusura dentro al pannello (iniettato, vale per tutte le pagine)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mobile-nav-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Chiudi menu');
  closeBtn.innerHTML = '<span></span><span></span>';
  closeBtn.addEventListener('click', () => setOpen(false));
  (panel.querySelector('.mobile-nav-inner') || panel).appendChild(closeBtn);

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

    document.querySelectorAll('.lang-switch').forEach((sw) => {
      sw.classList.toggle('lang-en', lang === 'en');
      sw.classList.toggle('lang-it', lang === 'it');
    });
  }

  let currentLang = savedLang;
  applyLang(currentLang);

  function toggleLang() {
    currentLang = currentLang === 'it' ? 'en' : 'it';
    localStorage.setItem(STORAGE_KEY, currentLang);
    applyLang(currentLang);
  }

  // Un click qualsiasi sullo switch alterna IT <-> EN
  document.querySelectorAll('.lang-switch').forEach((sw) => {
    sw.style.cursor = 'pointer';
    sw.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLang();
    });
  });
})();

// ====================================
//  CASE STUDY — bottone audio sui video
// ====================================
(function () {
  const ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

  document.querySelectorAll('.asset-tile video').forEach(video => {
    const tile = video.closest('.asset-tile');
    if (!tile || tile.querySelector('.video-sound-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'video-sound-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Attiva audio');
    btn.innerHTML = ICON_MUTED;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Se sto attivando l'audio, silenzia gli altri video aperti
      if (video.muted) {
        document.querySelectorAll('.asset-tile video').forEach(v => {
          if (v !== video && !v.muted) {
            v.muted = true;
            const otherBtn = v.closest('.asset-tile')?.querySelector('.video-sound-btn');
            if (otherBtn) {
              otherBtn.innerHTML = ICON_MUTED;
              otherBtn.classList.remove('is-on');
              otherBtn.setAttribute('aria-label', 'Attiva audio');
            }
          }
        });
      }

      video.muted = !video.muted;
      btn.classList.toggle('is-on', !video.muted);
      btn.innerHTML = video.muted ? ICON_MUTED : ICON_SOUND;
      btn.setAttribute('aria-label', video.muted ? 'Attiva audio' : 'Disattiva audio');

      // Force play se l'autoplay si era inceppato
      if (!video.muted && video.paused) {
        video.play().catch(() => {});
      }
    });

    tile.appendChild(btn);
  });
})();

// ====================================
//  ABOUT — effetto magnete sulle capability card
// ====================================
(function () {
  // Solo dispositivi con hover reale (no touch)
  if (window.matchMedia('(hover: none)').matches) return;

  const cards = document.querySelectorAll('.capabilities-grid .capability');
  if (!cards.length) return;

  const STRENGTH_X = 14;   // px di spostamento orizzontale massimo
  const STRENGTH_Y = 10;   // px verticale massimo

  cards.forEach(card => {
    let rafId = null;

    card.addEventListener('pointermove', (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        card.style.transition = 'transform 0.12s ease-out';
        card.style.transform = `translate3d(${dx * STRENGTH_X}px, ${dy * STRENGTH_Y}px, 0)`;
      });
    });

    card.addEventListener('pointerleave', () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
      card.style.transform = '';
    });
  });
})();
