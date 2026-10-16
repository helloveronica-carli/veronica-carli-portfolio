/* ====================================
   HOME HERO: cerchio di particelle
   ==================================== */
(() => {
  const hero = document.getElementById('vhHero');
  if (!hero) return;
  const stage = document.getElementById('vhStage');
  const inner = document.getElementById('vhWorldInner');
  const veil = document.getElementById('vhVeil');
  const dust = document.getElementById('vhDust');
  const title = document.getElementById('vhTitle');
  const titleText = document.getElementById('vhTitleText');
  const bar = document.getElementById('vhBar');
  const enterBtn = document.getElementById('vhEnter');
  const vctx = veil.getContext('2d');
  const dctx = dust.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  hero.classList.add('vh-on');

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // cubic-bezier solver (Emil Kowalski: strong ease-out for UI)
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
  const easeOut = bezier(0.23, 1, 0.32, 1);
  const easeInQuad = bezier(0.11, 0, 0.5, 0);     // easings.net: the balls accelerate into the impact
  const easeOutBack = bezier(0.34, 1.56, 0.64, 1); // easings.net: the hole is born with a small pop

  /* ---------------- intro: two balls collide and give birth to the hole ---------------- */
  const INTRO = { impact: 0.8, birth: 0.65, title: 1.15, bar: 1.5, end: 2.2 };
  const DONE = 99;
  let introStart = null;
  let introSkip = reduce || scrollY > 4; // reduced motion or a page reopened mid-scroll: no intro
  let burstDone = introSkip;
  // time into the intro: -1 while waiting for the fonts, DONE once over or skipped
  function introTime(now) {
    if (introSkip) return DONE;
    if (introStart === null) return -1;
    const it = (now - introStart) / 1000;
    return it >= INTRO.end ? DONE : it;
  }
  // any intent to move on skips straight to the final state
  const skip = () => { introSkip = true; };
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll']) {
    addEventListener(ev, skip, { once: true, passive: true });
  }

  // Critically damped spring: interruptible and velocity-aware
  function spring(x, vel, target, response, dt) {
    const w = (2 * Math.PI) / response;
    vel += (-2 * w * vel - w * w * (x - target)) * dt;
    return [x + vel * dt, vel];
  }

  // ink, orange, cream, blue
  const RGB = ['10,10,10', '255,90,31', '239,238,233', '0,0,238'];
  const INK = 0, ORANGE = 1, CREAM = 2, BLUE = 3;
  const TAU = Math.PI * 2;
  // Round grains: one small pre-drawn dot per colour, scaled down when drawn (cheap and antialiased)
  const DOT = RGB.map((rgb) => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = `rgb(${rgb})`;
    g.beginPath();
    g.arc(16, 16, 15, 0, TAU);
    g.fill();
    return c;
  });
  const FEATHER = 0.035;

  // The edge wobbles the same way for the hole and for the particles that sit on it.
  const edge = (a, t) =>
    0.014 * Math.sin(3 * a + 0.6 * t) +
    0.009 * Math.sin(5 * a - 0.9 * t + 1.3) +
    0.006 * Math.sin(9 * a + 1.4 * t + 0.4);

  /* ---------------- the rim is a soft membrane: it swells towards the mouse ---------------- */
  const NB = 96;                        // points around the rim
  const bulge = new Float32Array(NB);   // outward swelling, in px
  const bulgeV = new Float32Array(NB);
  const bulgeT = new Float32Array(NB);
  let deformK = 1;                      // fades the swelling away as the circle opens
  function updateBulge(dt, cx, cy, r, mag) {
    bulgeT.fill(0);
    if (pointerIn && fine && !reduce && mag > 0.01 && r > 1) {
      const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy);
      const prox = clamp01(1 - Math.abs(d - r) / 150); // strongest right on the rim, inside or outside
      if (prox > 0) {
        const ac = Math.atan2(dy, dx);
        const amp = Math.min(48, r * 0.22) * prox * prox * (3 - 2 * prox) * mag;
        const sig = 0.32; // width of the bulge, in radians
        for (let i = 0; i < NB; i++) {
          let da = Math.abs((i / NB) * TAU - ac) % TAU;
          if (da > Math.PI) da = TAU - da;
          bulgeT[i] = amp * Math.exp(-(da * da) / (2 * sig * sig));
        }
      }
    }
    // jelly: every point springs to its target and pulls on its neighbours, so it relaxes with a soft wobble
    for (let i = 0; i < NB; i++) {
      const l = bulge[(i + NB - 1) % NB], rt = bulge[(i + 1) % NB];
      bulgeV[i] += ((bulgeT[i] - bulge[i]) * 70 + (l + rt - 2 * bulge[i]) * 40 - bulgeV[i] * 7) * dt;
    }
    for (let i = 0; i < NB; i++) bulge[i] += bulgeV[i] * dt;
  }
  function bulgeAt(a) {
    const f = ((((a % TAU) + TAU) % TAU) / TAU) * NB;
    const i = f | 0, k = f - i;
    return bulge[i % NB] * (1 - k) + bulge[(i + 1) % NB] * k;
  }
  // radius of the rim at angle a: wobbling edge plus the swelling under the mouse
  const radiusAt = (a, r, et) => r * (1 + edge(a, et)) + bulgeAt(a) * deformK;

  /* ---------------- geometry ---------------- */
  let vw = 0, vh = 0, cx0 = 0, cy0 = 0, R0 = 0, Rmax = 0, far = 0, dpr = 1;

  function measure() {
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    const nav = document.querySelector('nav');
    const navH = nav ? nav.getBoundingClientRect().height : 0;
    R0 = Math.max(70, Math.min(vw * 0.3, (vh - navH) * 0.17, 170));
    cx0 = vw / 2;
    cy0 = navH + (vh - navH) * 0.4;
    far = Math.max(
      Math.hypot(cx0, cy0), Math.hypot(vw - cx0, cy0),
      Math.hypot(cx0, vh - cy0), Math.hypot(vw - cx0, vh - cy0)
    ) + 20;
    Rmax = far / (1 - FEATHER - 0.03) + 10;
    dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [veil, dust]) {
      c.width = Math.round(vw * dpr);
      c.height = Math.round(vh * dpr);
    }
    title.style.top = Math.round(cy0 + R0 + Math.max(48, vh * 0.075)) + 'px';
    buildRim();
    buildTrack();
    // seen from outside, the row of cards sits in the middle of the circle: zoom around the row's centre
    rowY = row.offsetTop + row.offsetHeight / 2;
    inner.style.transformOrigin = `${cx0}px ${rowY}px`;
  }

  const row = document.getElementById('vhRow');
  const head = inner.querySelector('.section-header');
  const cta = inner.querySelector('.vh-cta');
  let rowY = 0;
  let revealShown = -1;
  /* ---------------- row motion: gentle auto-flow, slows under the mouse, swipeable by touch ---------------- */
  const AUTO = reduce ? 0 : 40; // px per second
  let flowX = 0, flowV = 0, autoK = 1, idleUntil = 0, rowHover = false;
  let drag = null, justDragged = false;

  row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') rowHover = true; });
  row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') rowHover = false; });
  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    // a finger on the row holds it still, so the card under it can be tapped
    idleUntil = performance.now() + 1200;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: performance.now(), on: false, moved: 0 };
  });
  row.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return; // vertical intent: let the page scroll
      drag.on = true;
      try { row.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    }
    const now = performance.now();
    const step = e.clientX - drag.lastX;
    flowX -= step;
    flowV = (-step / Math.max(1, now - drag.lastT)) * 1000;
    drag.lastX = e.clientX;
    drag.lastT = now;
    drag.moved += Math.abs(step);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.on) {
      justDragged = drag.moved > 6;
      idleUntil = performance.now() + 1200; // let the fling settle before the auto-flow returns
    }
    drag = null;
  };
  row.addEventListener('pointerup', release);
  row.addEventListener('pointercancel', release);
  // a swipe must not open the project under the finger
  row.addEventListener('click', (e) => {
    if (!justDragged) return;
    e.preventDefault();
    e.stopPropagation();
    justDragged = false;
  }, true);

  function stepRow(dt, now) {
    if (!drag || !drag.on) {
      flowV *= Math.exp(-dt * 3.5); // the fling carries on, then slows down
      const want = rowHover || now < idleUntil ? 0 : 1;
      autoK += (want - autoK) * (1 - Math.exp(-dt * 4));
      flowX += (flowV + AUTO * autoK) * dt;
    }
    flowX = ((flowX % setW) + setW) % setW;
    track.style.transform = `translate3d(${(-flowX).toFixed(2)}px, 0, 0)`;
  }

  // the title and the link only exist once you are inside
  function reveal(grow) {
    const k = reduce ? (grow > 0.9 ? 1 : 0) : easeOut(clamp01((grow - 0.82) / 0.18));
    if (Math.abs(k - revealShown) < 0.003) return;
    revealShown = k;
    for (const el of [head, cta]) {
      el.style.opacity = k.toFixed(3);
      el.style.transform = k >= 1 ? '' : `translateY(${((1 - k) * 14).toFixed(2)}px)`;
      el.style.visibility = k <= 0 ? 'hidden' : '';
    }
  }

  /* ---------------- the row of project cards, looping horizontally ---------------- */
  const track = document.getElementById('vhTrack');
  const originals = [...track.children];
  let cards = [...originals];
  let setW = 1;

  function buildTrack() {
    track.replaceChildren(...originals);
    const unit = originals[0].offsetWidth + 20; // card + its margin (layout size, unaffected by the zoom)
    // enough copies that one set is wider than the screen, then the set twice for a seamless -50% loop
    const reps = Math.max(1, Math.ceil((vw + unit) / (originals.length * unit)));
    const nodes = [];
    for (let r = 0; r < reps * 2; r++) {
      for (const o of originals) {
        if (r === 0) { nodes.push(o); continue; }
        const c = o.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.tabIndex = -1;
        c.querySelectorAll('img').forEach((i) => { i.alt = ''; });
        nodes.push(c);
      }
    }
    track.replaceChildren(...nodes);
    setW = reps * originals.length * unit; // one set: the loop wraps at this width
    cards = nodes;
  }

  /* ---------------- the rim: thousands of grains holding the circle together ---------------- */
  const RIM = [[], [], [], []];
  function buildRim() {
    for (const arr of RIM) arr.length = 0;
    const N = Math.round(Math.min(3200, Math.max(1400, vw * 1.9)));
    for (let i = 0; i < N; i++) {
      const u = Math.random();
      const c = u < 0.62 ? INK : u < 0.86 ? ORANGE : u < 0.97 ? CREAM : BLUE;
      let off = gauss() * 7;
      if (c === CREAM) off = -Math.abs(off) - 2;                       // cream grains bite into the dark
      else if (Math.random() < 0.35) off = Math.abs(off) * 2.2 + 3;    // a loose halo of dust outside
      RIM[c].push({
        a: Math.random() * Math.PI * 2,
        drift: rand(-0.03, 0.03),
        off,
        size: rand(0.8, 2.1),
        alpha: rand(0.45, 1),
        ph: Math.random() * Math.PI * 2,
        sp: rand(0.4, 1.4),
        intro: rand(0, 0.45),
        dx: 0, dy: 0, vx: 0, vy: 0,
      });
    }
  }

  /* ---------------- dust: grains that leave and evaporate ---------------- */
  const MAX = 5000;
  const DUST = [[], [], [], []];
  let dustCount = 0;
  function emit(c, x, y, vx, vy, life, size, a, lift) {
    if (dustCount >= MAX) return;
    DUST[c].push({ x, y, vx, vy, life, max: life, size, a, lift });
    dustCount++;
  }
  // grains that carry their own colour (taken from the project images)
  const DUSTC = [];
  function emitC(col, x, y, vx, vy, life, size, a, lift) {
    if (dustCount >= MAX) return;
    DUSTC.push({ col, x, y, vx, vy, life, max: life, size, a, lift });
    dustCount++;
  }

  /* ---------------- the title: split into letters, sampled into grains ---------------- */
  let letters = [], boxes = [];
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });

  function splitTitle() {
    const walker = document.createTreeWalker(titleText, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const parent = node.parentNode;
      if (parent.classList && parent.classList.contains('vh-ch')) continue;
      if (!/\S/.test(node.textContent)) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (!/\S/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
        const word = document.createElement('span');
        word.className = 'vh-w';
        for (const ch of part) {
          const c = document.createElement('span');
          c.className = 'vh-ch';
          c.textContent = ch;
          word.appendChild(c);
        }
        frag.appendChild(word);
      }
      parent.replaceChild(frag, node);
    }
    const plain = titleText.cloneNode(true);
    plain.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
    title.setAttribute('aria-label', plain.textContent.replace(/\s+/g, ' ').trim());
    titleText.setAttribute('aria-hidden', 'true');
    // during the intro the line starts as vapour and condenses later
    const s0 = introTime(performance.now()) === DONE ? 0 : 1;
    letters = [...titleText.querySelectorAll('.vh-ch')].map((el, i) => ({
      el, i, s: s0, shown: -1, acc: 0, pts: [], color: INK, x: 0, y: 0,
    }));
    boxes = [...titleText.querySelectorAll('.highlight')].map((el) => ({
      el, letters: [], pts: [], s: s0, acc: 0, shown: -1,
    }));
    for (const L of letters) {
      const b = boxes.find((bx) => bx.el.contains(L.el));
      if (b) b.letters.push(L);
    }
    sampleTitle();
  }

  function sampleTitle() {
    for (const L of letters) {
      L.el.style.transform = ''; L.el.style.opacity = ''; L.el.style.filter = '';
      L.shown = -1;
    }
    for (const B of boxes) { B.el.style.backgroundColor = ''; B.shown = -1; }
    const base = title.getBoundingClientRect();
    for (const L of letters) {
      const r = L.el.getBoundingClientRect();
      const cs = getComputedStyle(L.el);
      const w = Math.ceil(r.width) + 4, h = Math.ceil(r.height) + 4;
      off.width = w; off.height = h;
      octx.clearRect(0, 0, w, h);
      octx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      octx.textBaseline = 'middle';
      const outline = !!L.el.closest('.outline');
      if (outline) {
        octx.strokeStyle = '#0000ee'; octx.lineWidth = 1.2;
        octx.strokeText(L.el.textContent, 2, h / 2);
      } else {
        octx.fillStyle = '#0a0a0a';
        octx.fillText(L.el.textContent, 2, h / 2);
      }
      const data = octx.getImageData(0, 0, w, h).data;
      const pts = [];
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (data[(y * w + x) * 4 + 3] > 110) pts.push(r.left - base.left + x - 2, r.top - base.top + y - 2);
        }
      }
      L.pts = pts;
      L.color = outline ? BLUE : INK;
      L.x = r.left - base.left + r.width / 2;
      L.y = r.top - base.top + r.height / 2;
    }
    for (const B of boxes) {
      const r = B.el.getBoundingClientRect();
      const pts = [];
      for (let y = 0; y < r.height; y += 4) {
        for (let x = 0; x < r.width; x += 4) pts.push(r.left - base.left + x, r.top - base.top + y);
      }
      B.pts = pts;
    }
  }

  // The language switch rewrites the title: split it again whenever that happens.
  const mo = new MutationObserver(() => resplit());
  function resplit() {
    mo.disconnect();
    splitTitle();
    mo.observe(titleText, { childList: true });
  }

  /* ---------------- pointer ---------------- */
  let mx = -9999, my = -9999, pointerIn = false, hoverTarget = 0, nx = 0, ny = 0;
  if (fine && !reduce) {
    addEventListener('pointermove', (e) => {
      const sr = stage.getBoundingClientRect();
      mx = e.clientX - sr.left;
      my = e.clientY - sr.top;
      pointerIn = true;
      const dx = mx - cx0, dy = my - cy0, d = Math.hypot(dx, dy);
      const pull = Math.max(0, 1 - d / (R0 * 3));
      nx = (dx / (d || 1)) * 16 * pull;
      ny = (dy / (d || 1)) * 16 * pull;
      hoverTarget = d < R0 * 1.08 ? 1 : 0;
    }, { passive: true });
    addEventListener('pointerout', (e) => {
      if (e.relatedTarget) return;
      pointerIn = false; hoverTarget = 0; nx = ny = 0;
    });
  }

  // The circle is fully open at OPEN of the runway; the rest is a pause inside, with the cards.
  const OPEN = 0.8;
  const DEPTH = 0.3; // scale of the world seen from outside
  function enter() {
    const run = hero.offsetHeight - stage.clientHeight;
    window.scrollTo({ top: hero.offsetTop + run * OPEN + 2, behavior: reduce ? 'auto' : 'smooth' });
  }
  enterBtn.addEventListener('click', enter);

  /* ---------------- drawing ---------------- */
  function drawVeil(cx, cy, r, et) {
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.globalCompositeOperation = 'source-over';
    vctx.clearRect(0, 0, vw, vh);
    if (r * (1 - FEATHER - 0.03) >= far) return; // fully open: nothing left of the cream
    vctx.fillStyle = '#EFEEE9';
    vctx.fillRect(0, 0, vw, vh);
    if (r < 0.5) return; // before the impact there is no hole yet
    // The hole follows the deformed rim; its soft edge is built from a few stacked cuts
    vctx.globalCompositeOperation = 'destination-out';
    vctx.fillStyle = '#000';
    const f = r * FEATHER;
    const cuts = [[0.4, 0.3], [0, 0.3], [-0.4, 0.3], [-0.8, 0.3], [-1, 1]]; // [outset in feathers, strength]
    const STEPS = 160;
    for (const [out, strength] of cuts) {
      vctx.globalAlpha = strength;
      vctx.beginPath();
      for (let k = 0; k <= STEPS; k++) {
        const a = (k / STEPS) * TAU;
        const rr = radiusAt(a, r, et) + out * f;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (k) vctx.lineTo(x, y); else vctx.moveTo(x, y);
      }
      vctx.closePath();
      vctx.fill();
    }
    vctx.globalAlpha = 1;
    vctx.globalCompositeOperation = 'source-over';
  }

  // born: seconds since the hole was born (DONE once the intro is over)
  function stepRim(dt, t, et, cx, cy, r, grow, born) {
    const lively = reduce ? 0 : 1;
    const R = 120, R2 = R * R;
    const near = pointerIn && fine && !reduce;
    const spread = 1 + grow * 4;
    for (let c = 0; c < 4; c++) {
      dctx.fillStyle = `rgb(${RGB[c]})`;
      for (const q of RIM[c]) {
        // flung out by the impact, the grains settle onto the rim
        const ik = reduce ? 1 : easeOut(clamp01((born - q.intro * 0.6) / 0.7));
        if (ik <= 0) continue;
        const a = q.a + t * q.drift * lively;
        const ca = Math.cos(a), sa = Math.sin(a);
        const rr = radiusAt(a, r, et) + q.off * spread * (1 + (1 - ik) * 6) + Math.sin(t * q.sp + q.ph) * 2.2 * lively;
        let x = cx + ca * rr, y = cy + sa * rr;
        if (near) {
          const ddx = x + q.dx - mx, ddy = y + q.dy - my;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1, f = 1 - d / R, F = f * f * 1500;
            q.vx += (ddx / d) * F * dt;
            q.vy += ((ddy / d) * F - f * 500) * dt;
            if (Math.random() < f * 0.05) {
              emit(c === CREAM ? INK : c, x + q.dx, y + q.dy,
                (ddx / d) * rand(20, 70), (ddy / d) * rand(20, 70) - rand(10, 40),
                rand(0.6, 1.8), rand(0.8, 2), 0.9, rand(15, 45));
            }
          }
        }
        if (q.dx || q.dy || q.vx || q.vy) {
          q.vx += (-q.dx * 40 - q.vx * 7) * dt;
          q.vy += (-q.dy * 40 - q.vy * 7) * dt;
          q.dx += q.vx * dt;
          q.dy += q.vy * dt;
          if (Math.abs(q.dx) + Math.abs(q.dy) + Math.abs(q.vx) + Math.abs(q.vy) < 0.05) q.dx = q.dy = q.vx = q.vy = 0;
        }
        x += q.dx; y += q.dy;
        if (x < -4 || y < -4 || x > vw + 4 || y > vh + 4) continue;
        dctx.globalAlpha = q.alpha * ik;
        dctx.drawImage(DOT[c], x - q.size / 2, y - q.size / 2, q.size, q.size);
      }
    }
    dctx.globalAlpha = 1;
  }

  let emitAcc = 0;
  function evaporate(dt, et, cx, cy, r, hover, speed) {
    const rate = 80 + hover * 380 + Math.min(1600, speed * 1400);
    emitAcc += rate * dt;
    let n = emitAcc | 0;
    emitAcc -= n;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rr = radiusAt(a, r, et);
      const x = cx + ca * rr, y = cy + sa * rr;
      if (x < -10 || y < -10 || x > vw + 10 || y > vh + 10) continue;
      const u = Math.random();
      if (u < 0.55) {
        emit(INK, x + ca * rand(0, 6), y + sa * rand(0, 6), ca * rand(6, 40), sa * rand(6, 40) - rand(0, 20),
          rand(0.6, 2), rand(0.7, 1.9), rand(0.5, 0.95), rand(12, 40));
      } else if (u < 0.85) {
        emit(ORANGE, x + ca * rand(0, 8), y + sa * rand(0, 8), ca * rand(8, 46), sa * rand(8, 46) - rand(0, 20),
          rand(0.6, 2.2), rand(0.7, 2.1), rand(0.55, 1), rand(8, 30));
      } else {
        emit(CREAM, x - ca * rand(1, 8), y - sa * rand(1, 8), -ca * rand(2, 14), -sa * rand(2, 14),
          rand(0.3, 0.9), rand(0.8, 2.2), 0.95, 4);
      }
    }
  }

  // A lazy, curling drift: vapour, not sparks. Returns false once the grain is gone.
  // dot: the pre-drawn round grain for palette colours; without it a circle is drawn in the current fill colour.
  function drift(q, dt, t, dot) {
    q.life -= dt;
    if (q.life <= 0) return false;
    const n = Math.sin(q.y * 0.018 + t * 1.3) + Math.cos(q.x * 0.014 - t * 0.9);
    q.vx += n * 22 * dt;
    q.vy += (n * 10 - q.lift) * dt;
    q.vx *= 1 - 1.6 * dt;
    q.vy *= 1 - 1.6 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    const k = q.life / q.max;
    const s = q.size * (0.5 + 0.5 * k);
    dctx.globalAlpha = q.a * k * k;
    if (dot) {
      dctx.drawImage(dot, q.x - s / 2, q.y - s / 2, s, s);
    } else {
      dctx.beginPath();
      dctx.arc(q.x, q.y, s / 2, 0, TAU);
      dctx.fill();
    }
    return true;
  }

  function stepDust(dt, t) {
    for (let c = 0; c < 4; c++) {
      const arr = DUST[c];
      if (!arr.length) continue;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (!drift(arr[i], dt, t, DOT[c])) { arr[i] = arr[arr.length - 1]; arr.pop(); dustCount--; }
      }
    }
    let lastCol = '';
    for (let i = DUSTC.length - 1; i >= 0; i--) {
      const q = DUSTC[i];
      if (q.col !== lastCol) { dctx.fillStyle = q.col; lastCol = q.col; }
      if (!drift(q, dt, t)) { DUSTC[i] = DUSTC[DUSTC.length - 1]; DUSTC.pop(); dustCount--; }
    }
    dctx.globalAlpha = 1;
  }

  /* ---------------- cards leaving on the left crumble into grains of their own colours ---------------- */
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
      grid = false; // opened as a local file the browser hides image pixels: use the site palette
    }
    palettes.set(img.src, grid);
    return grid;
  }

  const ZONE = 140; // matches the fade of the row's mask
  function crumbleCards(dt, sr) {
    for (const card of cards) {
      const box = card.firstElementChild;
      const r = box.getBoundingClientRect();
      const left = r.left - sr.left, right = r.right - sr.left;
      if (right <= 0 || left >= ZONE) continue;
      const top = r.top - sr.top;
      const x0 = Math.max(0, left), x1 = Math.min(ZONE, right);
      card._acc = (card._acc || 0) + (x1 - x0) * 2.4 * dt;
      let n = card._acc | 0;
      card._acc -= n;
      n = Math.min(n, 40);
      const grid = palette(box.querySelector('img'));
      for (let i = 0; i < n; i++) {
        const x = rand(x0, x1), y = rand(top, top + r.height);
        let col;
        if (grid) {
          const u = clamp01((x - left) / (right - left)), v = clamp01((y - top) / r.height);
          col = grid[Math.min(14, (v * 15) | 0) * 24 + Math.min(23, (u * 24) | 0)];
        } else {
          col = FALLBACK[(Math.random() * FALLBACK.length) | 0];
        }
        emitC(col, x, y, rand(-70, -20), rand(-30, 12), rand(0.6, 1.6), rand(1, 2.4), rand(0.6, 0.95), rand(10, 30));
      }
    }
  }

  function updateTitle(dt, pc, hover, base, it) {
    for (const L of letters) {
      // touching the circle makes the whole line breathe off a little
      let target = hover * 0.22;
      // hovering the line itself vaporises the letters under the cursor
      if (pointerIn && fine && !reduce) {
        const d = Math.hypot(mx - (base.left + L.x), my - (base.top + L.y));
        const prox = clamp01(1 - d / 95);
        target = Math.max(target, prox * prox * (3 - 2 * prox) * 0.96);
      }
      // scrolling: the line evaporates from the centre outwards before the circle reaches it
      const order = Math.abs(L.x - base.width / 2) / (base.width / 2 || 1);
      target = Math.max(target, clamp01((pc - 0.015 - order * 0.05) / 0.11));
      // intro: the line condenses out of the vapour, centre first
      if (it !== DONE) {
        target = Math.max(target, it < 0 ? 1 : clamp01(1 - (it - INTRO.title - order * 0.22) / 0.5));
      }

      const prev = L.s;
      if (reduce) L.s = target;
      else L.s += (target - L.s) * (1 - Math.exp(-dt * (target > L.s ? 16 : 3.2)));

      if (!reduce && L.pts.length) {
        // what just left the letter turns into grains
        L.acc += Math.max(0, L.s - prev) * (L.pts.length / 2) * 0.85 + L.s * (1 - L.s) * 26 * dt;
        let n = L.acc | 0;
        L.acc -= n;
        n = Math.min(n, 60);
        for (let j = 0; j < n; j++) {
          const q = (Math.random() * (L.pts.length / 2)) | 0;
          emit(L.color, base.left + L.pts[2 * q], base.top + L.pts[2 * q + 1] - 10 * L.s,
            rand(-28, 28), rand(-55, -8), rand(0.6, 1.7), rand(0.8, 1.9), 0.9, rand(14, 46));
        }
      }

      if (Math.abs(L.s - L.shown) > 0.004) {
        L.shown = L.s;
        if (L.s < 0.004) {
          L.el.style.transform = ''; L.el.style.opacity = ''; L.el.style.filter = '';
        } else if (reduce) {
          L.el.style.opacity = (1 - L.s).toFixed(3);
        } else {
          const drift = Math.sin(L.i * 1.7) * 4 * L.s;
          L.el.style.transform = `translate(${drift.toFixed(2)}px, ${(-12 * L.s).toFixed(2)}px)`;
          L.el.style.opacity = (1 - L.s).toFixed(3);
          L.el.style.filter = `blur(${(L.s * 5).toFixed(2)}px)`;
        }
      }
    }
    // the orange highlight dissolves with its letters
    for (const B of boxes) {
      let s = 0;
      for (const L of B.letters) s += L.s;
      s = B.letters.length ? s / B.letters.length : 0;
      const prev = B.s;
      B.s = s;
      if (!reduce && B.pts.length) {
        B.acc += Math.max(0, s - prev) * (B.pts.length / 2) * 0.7;
        let n = B.acc | 0;
        B.acc -= n;
        n = Math.min(n, 80);
        for (let j = 0; j < n; j++) {
          const q = (Math.random() * (B.pts.length / 2)) | 0;
          emit(ORANGE, base.left + B.pts[2 * q], base.top + B.pts[2 * q + 1],
            rand(-30, 30), rand(-50, -5), rand(0.6, 1.6), rand(1, 2.2), 0.95, rand(12, 40));
        }
      }
      if (Math.abs(s - B.shown) > 0.004) {
        B.shown = s;
        B.el.style.backgroundColor = s < 0.004 ? '' : `rgba(255,90,31,${(1 - s).toFixed(3)})`;
      }
    }
  }

  /* ---------------- loop ---------------- */
  const t0 = performance.now();
  let last = t0, idle = false;
  let p = 0, pv = 0, hover = 0, hv = 0, ox = 0, oy = 0;

  /* ---------------- intro: the two balls and the impact ---------------- */
  let ballPrev = null;
  function drawBalls(it, dt) {
    if (it < 0 || it >= INTRO.impact) return;
    const e = easeInQuad(clamp01(it / INTRO.impact));
    const rb = R0 * 0.38;
    const sL = -rb * 1.3, sR = vw + rb * 1.3;
    const balls = [
      { x: sL + (cx0 - sL) * e, dir: 1 },
      { x: sR + (cx0 - sR) * e, dir: -1 },
    ];
    dctx.globalAlpha = 1;
    dctx.fillStyle = '#0A0A0A';
    for (const b of balls) {
      dctx.beginPath();
      dctx.arc(b.x, cy0, rb, 0, Math.PI * 2);
      dctx.fill();
    }
    // the faster they go, the more their trailing side frays into grains
    const speed = ballPrev === null || dt <= 0 ? 0 : Math.abs(balls[0].x - ballPrev) / dt;
    ballPrev = balls[0].x;
    for (const b of balls) {
      const n = Math.min(36, Math.round(5 + speed * dt * 0.8));
      for (let i = 0; i < n; i++) {
        const a = (b.dir > 0 ? Math.PI : 0) + rand(-1.3, 1.3);
        const ca = Math.cos(a), sa = Math.sin(a);
        const k = rand(0.92, 1.06);
        emit(Math.random() < 0.8 ? INK : ORANGE, b.x + ca * rb * k, cy0 + sa * rb * k,
          -b.dir * speed * rand(0.04, 0.16) + ca * rand(5, 25), sa * rand(5, 25),
          rand(0.4, 1.2), rand(0.7, 1.9), rand(0.5, 0.95), rand(6, 22));
      }
    }
  }

  function burst() {
    for (let i = 0; i < 560; i++) {
      const a = Math.random() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const sp = rand(40, 420);
      const u = Math.random();
      const c = u < 0.6 ? INK : u < 0.85 ? ORANGE : u < 0.95 ? CREAM : BLUE;
      emit(c, cx0 + ca * rand(0, 10), cy0 + sa * rand(0, 10), ca * sp, sa * sp,
        rand(0.5, 1.6), rand(0.8, 2.4), rand(0.6, 1), rand(4, 22));
    }
  }

  function render(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const t = (now - t0) / 1000;

    const hr = hero.getBoundingClientRect();
    if (hr.bottom < 0 || hr.top > innerHeight) {
      if (!idle) {
        vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.clearRect(0, 0, veil.width, veil.height);
        dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, dust.width, dust.height);
        idle = true;
      }
      return;
    }
    idle = false;
    const sr = stage.getBoundingClientRect();
    const tb = title.getBoundingClientRect();

    const target = clamp01(-hr.top / (hero.offsetHeight - stage.clientHeight));
    if (reduce) { p = target; hover = hoverTarget; }
    else {
      [p, pv] = spring(p, pv, target, 0.5, dt);
      [hover, hv] = spring(hover, hv, hoverTarget, 0.35, dt);
    }
    ox += (nx - ox) * Math.min(1, dt * 8);
    oy += (ny - oy) * Math.min(1, dt * 8);

    // po: how open the circle is (fully open at OPEN of the runway, then a pause inside)
    const po = clamp01(clamp01(p) / OPEN);
    const grow = po * po * (3 - 2 * po);
    const mag = 1 - po;
    const et = reduce ? 0 : t;
    const breathe = reduce ? 0 : Math.sin(t * 0.9) * 0.012;

    // intro: no hole before the impact, then it is born from the merged balls with a small pop
    const it = introTime(now);
    const born = it === DONE ? DONE : it < 0 ? -1 : it - INTRO.impact;
    const birth = born === DONE ? 1 : born < 0 ? 0 : easeOutBack(clamp01(born / INTRO.birth));
    if (born >= 0 && !burstDone) { burst(); burstDone = true; }
    const rb = R0 * 0.38;
    const rRest = R0 * (1 + breathe * mag) + hover * 12 * mag;
    const r = (born < 0 ? 0 : rb + (rRest - rb) * birth) + (Rmax - R0) * grow;
    const settle = Math.min(1, birth);
    const cx = cx0 + ox * mag * settle, cy = cy0 + oy * mag * settle;

    deformK = mag;
    if (!reduce) updateBulge(dt, cx, cy, r, mag);
    drawVeil(cx, cy, r, et);
    // seen from outside the cards are far away and small; entering, they come up to full size
    const depth = DEPTH * Math.pow(1 / DEPTH, grow);
    const lift = (cy0 - rowY) * (1 - grow); // far away, the row is centred in the circle
    inner.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) scale(${depth.toFixed(4)})`;
    reveal(grow);
    stepRow(dt, now);
    inner.style.pointerEvents = grow > 0.9 ? '' : 'none';
    const barIn = it === DONE ? 1 : clamp01((it - INTRO.bar) / 0.4);
    bar.style.opacity = (Math.max(0, 1 - po * 3) * barIn).toFixed(3);
    // once the line has evaporated it must not linger over the dark
    title.style.visibility = po > 0.3 ? 'hidden' : '';

    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, vw, vh);
    drawBalls(it, dt);
    if (born >= 0) stepRim(dt, t, et, cx, cy, r, grow, born);
    if (!reduce && born >= 0.15) evaporate(dt, et, cx, cy, r, hover, Math.abs(pv));
    updateTitle(dt, po, hover, { left: tb.left - sr.left, top: tb.top - sr.top, width: tb.width }, it);
    if (!reduce && grow > 0.92) crumbleCards(dt, sr);
    stepDust(dt, t);

    if (born > 0.3 && po < 0.6) {
      const hit = Math.max(r, 60);
      enterBtn.style.display = '';
      enterBtn.style.width = enterBtn.style.height = hit * 2 + 'px';
      enterBtn.style.left = cx - hit + 'px';
      enterBtn.style.top = cy - hit + 'px';
    } else {
      enterBtn.style.display = 'none';
    }
  }

  function loop(now) {
    render(now);
    requestAnimationFrame(loop);
  }

  measure();
  resplit();
  if (document.fonts) document.fonts.ready.then(() => { measure(); sampleTitle(); });
  // the intro starts once the fonts are in (or after half a second at most), like a loading moment
  if (!introSkip) {
    Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((res) => setTimeout(res, 500)),
    ]).then(() => { if (introStart === null) introStart = performance.now(); });
  }
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { measure(); sampleTitle(); }, 120);
  });
  render(performance.now());
  requestAnimationFrame(loop);
})();
