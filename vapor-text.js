/* ====================================
   TESTO CHE SI VAPORIZZA al passaggio del mouse (come il titolo in home)
   Si attiva mettendo l'attributo data-vapor sull'elemento che contiene il testo.
   Solo con il mouse: su touch e con "riduci movimento" il testo resta normale.
   ==================================== */
(() => {
  const els = [...document.querySelectorAll('[data-vapor]')];
  if (!els.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const rand = (a, b) => a + Math.random() * (b - a);
  const RADIUS = 95; // how close the cursor has to be for a letter to evaporate

  /* ---------------- grains: one fixed canvas over the page ---------------- */
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1;
  function sizeCanvas() {
    vw = innerWidth; vh = innerHeight;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  // round grains: one small pre-drawn dot per colour
  const dots = new Map();
  function dot(col) {
    let c = dots.get(col);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      g.fillStyle = col;
      g.beginPath();
      g.arc(16, 16, 15, 0, Math.PI * 2);
      g.fill();
      dots.set(col, c);
    }
    return c;
  }

  const MAX = 2500;
  const grains = [];
  function emit(col, x, y, vx, vy, life, size, a, lift) {
    if (grains.length >= MAX) return;
    grains.push({ img: dot(col), x, y, vx, vy, life, max: life, size, a, lift });
  }
  let dirty = false;
  function stepGrains(dt, t) {
    if (!grains.length && !dirty) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    for (let i = grains.length - 1; i >= 0; i--) {
      const q = grains[i];
      q.life -= dt;
      if (q.life <= 0) { grains[i] = grains[grains.length - 1]; grains.pop(); continue; }
      // a lazy, curling drift: vapour, not sparks
      const n = Math.sin(q.y * 0.018 + t * 1.3) + Math.cos(q.x * 0.014 - t * 0.9);
      q.vx += n * 22 * dt;
      q.vy += (n * 10 - q.lift) * dt;
      q.vx *= 1 - 1.6 * dt;
      q.vy *= 1 - 1.6 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = q.life / q.max;
      const s = q.size * (0.5 + 0.5 * k);
      ctx.globalAlpha = q.a * k * k;
      ctx.drawImage(q.img, q.x - s / 2, q.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    dirty = grains.length > 0;
  }

  /* ---------------- the texts: split into letters, sampled into grains ---------------- */
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });
  const rgbOf = (cssColor) => {
    const m = cssColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = '1'] = m[1].split(',').map((v) => v.trim());
    return { r, g, b, a: parseFloat(a) };
  };

  const items = els.map((el) => ({ el, letters: [], boxes: [], sr: null, visible: false, mo: null }));

  function split(it) {
    const { el } = it;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentNode;
      if (parent.classList && parent.classList.contains('vapor-ch')) continue;
      if (!/\S/.test(node.textContent)) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (!/\S/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
        const word = document.createElement('span');
        word.style.cssText = 'display:inline-block;white-space:nowrap';
        for (const ch of part) {
          const c = document.createElement('span');
          c.className = 'vapor-ch';
          c.style.display = 'inline-block';
          c.textContent = ch;
          word.appendChild(c);
        }
        frag.appendChild(word);
      }
      parent.replaceChild(frag, node);
    }
    // screen readers get the plain sentence, not one letter at a time
    if (!it.sr) {
      it.sr = document.createElement('span');
      it.sr.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
      el.before(it.sr);
    }
    const plain = el.cloneNode(true);
    plain.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
    it.sr.textContent = plain.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-hidden', 'true');

    it.letters = [...el.querySelectorAll('.vapor-ch')].map((ch, i) => ({ el: ch, i, s: 0, shown: -1, acc: 0, pts: [], col: '', x: 0, y: 0 }));
    // coloured backgrounds inside the text (like the orange highlight) dissolve with their letters
    it.boxes = [...el.querySelectorAll('*')]
      .filter((n) => !n.classList.contains('vapor-ch') && n.querySelector('.vapor-ch'))
      .map((n) => ({ n, bg: rgbOf(getComputedStyle(n).backgroundColor) }))
      .filter((b) => b.bg && b.bg.a > 0)
      .map((b) => ({ el: b.n, bg: b.bg, letters: [], pts: [], s: 0, acc: 0, shown: -1 }));
    for (const L of it.letters) {
      const b = it.boxes.find((bx) => bx.el.contains(L.el));
      if (b) b.letters.push(L);
    }
    sample(it);
  }

  function sample(it) {
    for (const L of it.letters) {
      L.el.style.transform = ''; L.el.style.opacity = ''; L.el.style.filter = '';
      L.shown = -1; L.s = 0;
    }
    for (const B of it.boxes) { B.el.style.backgroundColor = ''; B.shown = -1; B.s = 0; }
    const base = it.el.getBoundingClientRect();
    for (const L of it.letters) {
      const r = L.el.getBoundingClientRect();
      const cs = getComputedStyle(L.el);
      const w = Math.ceil(r.width) + 4, h = Math.ceil(r.height) + 4;
      off.width = w; off.height = h;
      octx.clearRect(0, 0, w, h);
      octx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      octx.textBaseline = 'middle';
      octx.fillStyle = '#000';
      octx.fillText(L.el.textContent, 2, h / 2);
      const data = octx.getImageData(0, 0, w, h).data;
      const pts = [];
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (data[(y * w + x) * 4 + 3] > 110) pts.push(r.left - base.left + x - 2, r.top - base.top + y - 2);
        }
      }
      const c = rgbOf(cs.color);
      L.col = c ? `rgb(${c.r},${c.g},${c.b})` : 'rgb(10,10,10)';
      L.pts = pts;
      L.x = r.left - base.left + r.width / 2;
      L.y = r.top - base.top + r.height / 2;
    }
    for (const B of it.boxes) {
      const r = B.el.getBoundingClientRect();
      const pts = [];
      for (let y = 0; y < r.height; y += 4) {
        for (let x = 0; x < r.width; x += 4) pts.push(r.left - base.left + x, r.top - base.top + y);
      }
      B.pts = pts;
    }
  }

  /* ---------------- pointer ---------------- */
  let mx = -9999, my = -9999;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  addEventListener('pointerout', (e) => { if (!e.relatedTarget) { mx = my = -9999; } });

  function update(it, dt) {
    const base = it.el.getBoundingClientRect();
    for (const L of it.letters) {
      const d = Math.hypot(mx - (base.left + L.x), my - (base.top + L.y));
      const prox = clamp01(1 - d / RADIUS);
      const target = prox * prox * (3 - 2 * prox) * 0.96;
      const prev = L.s;
      L.s += (target - L.s) * (1 - Math.exp(-dt * (target > L.s ? 16 : 3.2)));
      if (L.pts.length) {
        // what just left the letter turns into grains
        L.acc += Math.max(0, L.s - prev) * (L.pts.length / 2) * 0.85 + L.s * (1 - L.s) * 26 * dt;
        let n = L.acc | 0;
        L.acc -= n;
        n = Math.min(n, 60);
        for (let j = 0; j < n; j++) {
          const q = (Math.random() * (L.pts.length / 2)) | 0;
          emit(L.col, base.left + L.pts[2 * q], base.top + L.pts[2 * q + 1] - 10 * L.s,
            rand(-28, 28), rand(-55, -8), rand(0.6, 1.7), rand(0.9, 2.1), 0.9, rand(14, 46));
        }
      }
      if (Math.abs(L.s - L.shown) > 0.004) {
        L.shown = L.s;
        if (L.s < 0.004) {
          L.el.style.transform = ''; L.el.style.opacity = ''; L.el.style.filter = '';
        } else {
          const drift = Math.sin(L.i * 1.7) * 4 * L.s;
          L.el.style.transform = `translate(${drift.toFixed(2)}px, ${(-12 * L.s).toFixed(2)}px)`;
          L.el.style.opacity = (1 - L.s).toFixed(3);
          L.el.style.filter = `blur(${(L.s * 5).toFixed(2)}px)`;
        }
      }
    }
    for (const B of it.boxes) {
      let s = 0;
      for (const L of B.letters) s += L.s;
      s = B.letters.length ? s / B.letters.length : 0;
      const prev = B.s;
      B.s = s;
      if (B.pts.length) {
        B.acc += Math.max(0, s - prev) * (B.pts.length / 2) * 0.7;
        let n = B.acc | 0;
        B.acc -= n;
        n = Math.min(n, 80);
        const col = `rgb(${B.bg.r},${B.bg.g},${B.bg.b})`;
        for (let j = 0; j < n; j++) {
          const q = (Math.random() * (B.pts.length / 2)) | 0;
          emit(col, base.left + B.pts[2 * q], base.top + B.pts[2 * q + 1],
            rand(-30, 30), rand(-50, -5), rand(0.6, 1.6), rand(1, 2.2), 0.95, rand(12, 40));
        }
      }
      if (Math.abs(s - B.shown) > 0.004) {
        B.shown = s;
        B.el.style.backgroundColor = s < 0.004 ? '' : `rgba(${B.bg.r},${B.bg.g},${B.bg.b},${(B.bg.a * (1 - s)).toFixed(3)})`;
      }
    }
  }

  /* ---------------- setup & loop ---------------- */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const it = items.find((q) => q.el === en.target);
      if (it) it.visible = en.isIntersecting;
    }
  });
  for (const it of items) {
    // the language switch rewrites the text: split it again whenever that happens
    it.mo = new MutationObserver(() => { it.mo.disconnect(); split(it); it.mo.observe(it.el, { childList: true }); });
    split(it);
    it.mo.observe(it.el, { childList: true });
    io.observe(it.el);
  }
  sizeCanvas();
  if (document.fonts) document.fonts.ready.then(() => items.forEach(sample));
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { sizeCanvas(); items.forEach(sample); }, 120);
  });

  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    for (const it of items) if (it.visible) update(it, dt);
    stepGrains(dt, (now - t0) / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
