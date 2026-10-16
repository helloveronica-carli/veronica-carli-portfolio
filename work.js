/* ====================================
   PAGINA PROGETTI: file di card per categoria
   - con tanti progetti la fila scorre da sola in loop, rallenta sotto il mouse
   - con pochi progetti la fila sta ferma (e si trascina se non ci sta nello schermo)
   - su touch si trascina col dito, con inerzia
   - le card che escono a sinistra si sfaldano in particelle dei loro colori
   ==================================== */
(() => {
  const rowEls = [...document.querySelectorAll('.wk-row')];
  if (!rowEls.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AUTO = reduce ? 0 : 40; // px per second
  const LOOP_MIN = 4;           // fewer projects than this: no loop, the same cards would just repeat

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const rand = (a, b) => a + Math.random() * (b - a);

  // cubic-bezier solver; the arrows move the row with a strong ease-in-out (on-screen movement)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x, d = dx(t);
        if (Math.abs(e) < 1e-5 || !d) break;
        t -= e / d;
      }
      return sy(clamp01(t));
    };
  }
  const easeInOut = bezier(0.77, 0, 0.175, 1);
  const STEP_MS = 380;   // one card per click
  const RESUME_MS = 2600; // after the last click the auto-flow waits this long, then comes back

  /* ---------------- rows ---------------- */
  const rows = rowEls.map((row) => {
    const track = row.querySelector('.wk-track');
    return {
      row, track, originals: [...track.children], cards: [],
      loop: false, setW: 1, maxX: 0, unit: 1,
      x: 0, v: 0, autoK: 1, idleUntil: 0, hover: false,
      drag: null, justDragged: false, visible: false,
      tween: null, nav: null,
    };
  });

  /* ---------------- arrows: move one card at a time, by hand ---------------- */
  const isEn = () => document.documentElement.getAttribute('lang') === 'en';
  function makeNav(r) {
    const nav = document.createElement('div');
    nav.className = 'wk-nav';
    const arrow = (dir, glyph, it, en) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wk-arrow';
      b.innerHTML = `<span aria-hidden="true">${glyph}</span><span class="wk-sr" data-it="${it}" data-en="${en}">${isEn() ? en : it}</span>`;
      b.addEventListener('click', () => nudge(r, dir));
      return b;
    };
    nav.append(
      arrow(-1, '←', 'Progetti precedenti', 'Previous projects'),
      arrow(1, '→', 'Progetti successivi', 'Next projects'),
    );
    r.row.after(nav);
    return nav;
  }

  function nudge(r, dir) {
    const now = performance.now();
    r.v = 0;
    r.idleUntil = now + STEP_MS + RESUME_MS;
    if (reduce) { r.x += dir * r.unit; return; }
    // rapid clicks add up: start from where the row is now, aim one card past the current target
    let from = r.x, to = r.x + dir * r.unit;
    if (r.tween) {
      const k = easeInOut(clamp01((now - r.tween.t0) / STEP_MS));
      from = r.tween.from + (r.tween.to - r.tween.from) * k;
      to = r.tween.to + dir * r.unit;
    }
    r.tween = { from, to, t0: now };
  }

  function build(r) {
    r.track.replaceChildren(...r.originals);
    const n = r.originals.length;
    const unit = r.originals[0].offsetWidth + 20; // card + its margin
    const rowW = r.row.clientWidth;
    r.unit = unit;
    r.loop = n >= LOOP_MIN && n * unit > rowW;
    r.row.classList.toggle('is-loop', r.loop);
    if (!r.nav) r.nav = makeNav(r);
    r.nav.hidden = !r.loop; // arrows only where the row flows
    if (r.loop) {
      // enough copies that one set is wider than the row, then the set twice for a seamless loop
      const reps = Math.max(1, Math.ceil((rowW + unit) / (n * unit)));
      const nodes = [];
      for (let k = 0; k < reps * 2; k++) {
        for (const o of r.originals) {
          if (k === 0) { nodes.push(o); continue; }
          const c = o.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          c.tabIndex = -1;
          c.querySelectorAll('img').forEach((i) => { i.alt = ''; });
          nodes.push(c);
        }
      }
      r.track.replaceChildren(...nodes);
      r.cards = nodes;
      r.setW = reps * n * unit;
    } else {
      r.cards = [...r.originals];
      r.maxX = Math.max(0, r.track.offsetWidth - rowW);
      r.x = Math.min(r.x, r.maxX);
    }
  }

  for (const r of rows) {
    r.row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') r.hover = true; });
    r.row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') r.hover = false; });
    r.row.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      // a finger on the row holds it still, so the card under it can be tapped
      r.idleUntil = performance.now() + 1200;
      r.tween = null;
      r.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: performance.now(), on: false, moved: 0 };
    });
    r.row.addEventListener('pointermove', (e) => {
      const d = r.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.on) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return; // vertical intent: let the page scroll
        d.on = true;
        try { r.row.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
      }
      const now = performance.now();
      const step = e.clientX - d.lastX;
      r.x -= step;
      r.v = (-step / Math.max(1, now - d.lastT)) * 1000;
      d.lastX = e.clientX;
      d.lastT = now;
      d.moved += Math.abs(step);
    });
    const release = (e) => {
      const d = r.drag;
      if (!d || e.pointerId !== d.id) return;
      if (d.on) {
        r.justDragged = d.moved > 6;
        r.idleUntil = performance.now() + 1200; // let the fling settle before the auto-flow returns
      }
      r.drag = null;
    };
    r.row.addEventListener('pointerup', release);
    r.row.addEventListener('pointercancel', release);
    // a swipe must not open the project under the finger
    r.row.addEventListener('click', (e) => {
      if (!r.justDragged) return;
      e.preventDefault();
      e.stopPropagation();
      r.justDragged = false;
    }, true);
  }

  function stepRow(r, dt, now) {
    if (r.tween) {
      const k = clamp01((now - r.tween.t0) / STEP_MS);
      r.x = r.tween.from + (r.tween.to - r.tween.from) * easeInOut(k);
      if (k >= 1) r.tween = null;
      r.autoK = 0;
    } else if (!r.drag || !r.drag.on) {
      r.v *= Math.exp(-dt * 3.5); // the fling carries on, then slows down
      if (r.loop) {
        const want = r.hover || now < r.idleUntil ? 0 : 1;
        r.autoK += (want - r.autoK) * (1 - Math.exp(-dt * 4));
        r.x += (r.v + AUTO * r.autoK) * dt;
      } else {
        r.x += r.v * dt;
      }
    }
    if (r.loop) {
      r.x = ((r.x % r.setW) + r.setW) % r.setW;
    } else if (r.x < 0 || r.x > r.maxX) {
      r.x = Math.min(r.maxX, Math.max(0, r.x));
      r.v = 0;
    }
    r.track.style.transform = `translate3d(${(-r.x).toFixed(2)}px, 0, 0)`;
  }

  // only rows on screen move
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const r = rows.find((q) => q.row === en.target);
      if (r) r.visible = en.isIntersecting;
    }
  });
  rows.forEach((r) => io.observe(r.row));

  /* ---------------- dust: cards leaving on the left crumble into grains ---------------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'wk-dust';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1;
  function sizeCanvas() {
    vw = innerWidth; vh = innerHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  const MAX = 3000;
  const grains = [];
  function emit(col, x, y, vx, vy, life, size, a, lift) {
    if (grains.length >= MAX) return;
    grains.push({ col, x, y, vx, vy, life, max: life, size, a, lift });
  }
  // a lazy, curling drift: vapour, not sparks
  function stepGrains(dt, t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    let lastCol = '';
    for (let i = grains.length - 1; i >= 0; i--) {
      const q = grains[i];
      q.life -= dt;
      if (q.life <= 0) { grains[i] = grains[grains.length - 1]; grains.pop(); continue; }
      const n = Math.sin(q.y * 0.018 + t * 1.3) + Math.cos(q.x * 0.014 - t * 0.9);
      q.vx += n * 22 * dt;
      q.vy += (n * 10 - q.lift) * dt;
      q.vx *= 1 - 1.6 * dt;
      q.vy *= 1 - 1.6 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = q.life / q.max;
      const s = q.size * (0.5 + 0.5 * k);
      if (q.col !== lastCol) { ctx.fillStyle = q.col; lastCol = q.col; }
      ctx.globalAlpha = q.a * k * k;
      ctx.beginPath(); // round grains
      ctx.arc(q.x, q.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });
  const palettes = new Map();
  const FALLBACK = ['rgb(255,90,31)', 'rgb(239,238,233)', 'rgb(140,140,136)'];
  function palette(img) {
    if (palettes.has(img.src)) return palettes.get(img.src);
    if (!img.complete || !img.naturalWidth) return null;
    let grid = false;
    try {
      off.width = 24; off.height = 15;
      octx.drawImage(img, 0, 0, 24, 15);
      const d = octx.getImageData(0, 0, 24, 15).data;
      grid = [];
      for (let i = 0; i < d.length; i += 4) grid.push(`rgb(${d[i]},${d[i + 1]},${d[i + 2]})`);
    } catch (e) {
      grid = false; // image from another site (or a local file): the browser hides its pixels
    }
    palettes.set(img.src, grid);
    return grid;
  }

  const ZONE = 140; // matches the fade of the row's mask
  function crumble(r, dt) {
    const rr = r.row.getBoundingClientRect();
    if (rr.bottom < 0 || rr.top > vh) return;
    for (const card of r.cards) {
      const box = card.firstElementChild;
      const b = box.getBoundingClientRect();
      const left = b.left - rr.left, right = b.right - rr.left;
      if (right <= 0 || left >= ZONE) continue;
      const x0 = rr.left + Math.max(0, left), x1 = rr.left + Math.min(ZONE, right);
      card._acc = (card._acc || 0) + (x1 - x0) * 2.4 * dt;
      let n = card._acc | 0;
      card._acc -= n;
      n = Math.min(n, 40);
      const grid = palette(box.querySelector('img'));
      for (let i = 0; i < n; i++) {
        const x = rand(x0, x1), y = rand(b.top, b.bottom);
        let col;
        if (grid) {
          const u = clamp01((x - b.left) / b.width), v = clamp01((y - b.top) / b.height);
          col = grid[Math.min(14, (v * 15) | 0) * 24 + Math.min(23, (u * 24) | 0)];
        } else {
          col = FALLBACK[(Math.random() * FALLBACK.length) | 0];
        }
        emit(col, x, y, rand(-70, -20), rand(-30, 12), rand(0.6, 1.6), rand(1, 2.4), rand(0.6, 0.95), rand(10, 30));
      }
    }
  }

  /* ---------------- loop ---------------- */
  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    for (const r of rows) {
      if (!r.visible) continue;
      stepRow(r, dt, now);
      if (r.loop && !reduce) crumble(r, dt);
    }
    if (grains.length || canvas._dirty) {
      stepGrains(dt, (now - t0) / 1000);
      canvas._dirty = grains.length > 0;
    }
    requestAnimationFrame(frame);
  }

  function layout() {
    sizeCanvas();
    rows.forEach(build);
  }
  layout();
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(layout, 120);
  });
  requestAnimationFrame(frame);
})();
