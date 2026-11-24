/* heyshams.com · terminal portfolio
   No dependencies. Everything is progressive enhancement:
   without JS the page is a plain stacked document. */
(() => {
  'use strict';

  // ---------- Config ----------
  const SCREENS = ['intro', 'works', 'shifl', 'pathao', 'boost', 'contact'];
  const PROJECTS = ['shifl', 'pathao', 'boost'];
  const TITLES = {
    intro: 'Md Shamsuddin · Digital product designer',
    works: 'Works · Md Shamsuddin',
    shifl: 'Shifl customer portal · Md Shamsuddin',
    pathao: 'Pathao home screen · Md Shamsuddin',
    boost: 'Boost merchant portal · Md Shamsuddin',
    contact: 'Contact · Md Shamsuddin',
  };

  // Timings (ms). First load runs ~1.2 s end to end.
  // Noise covers the whole screen, content area included. The content locks in
  // line by line, and the noise under and around each line goes blank at the
  // same moment, so text and background settle as one top-to-bottom wave.
  // Ahead of the wave: the next few lines are grey, everything further is white.
  // Behind the wave nothing is drawn. Lines lock faster toward the bottom.
  const T = {
    load: {
      linesAt: 200,         // first line locks in (noise only until then)
      linesBudget: 650,     // time spread over all lines, top to bottom
      bgJitter: [0, 0],     // none: a settled row must be fully blank
      greyLines: 3,         // text lines ahead of the wave that show grey
      sound: 1200,
    },
    move: {
      out: 200,             // old screen dissolves
      linesBudget: 700,
      bgUntil: [180, 300],
      bgSweep: 350,
      sound: 1000,
    },
    jitter: 60,             // spread inside one line, kept small so lines lock one by one
    grey: 140,              // page moves: a cell turns grey this long before it goes blank
    ease: 1.5,              // >1: lines lock in faster and faster toward the bottom
  };
  const CELL_W = 11, CELL_H = 18;
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=?@<>/\\[]{}|~^:;!';
  const NOISE = GLYPHS + '0101';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (s) => s[(Math.random() * s.length) | 0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const track = (name) => { if (typeof window.clarity === 'function') window.clarity('event', name); };

  const PATHS = { intro: '~root/', works: '~root/works/', shifl: '~root/works/shifl', pathao: '~root/works/pathao', boost: '~root/works/boost', contact: '~root/contact/' };
  const pathEl = $('#path');
  const main = $('#main');
  let current = null;
  let busy = false;

  // ---------- Character noise (canvas) ----------
  // Moving cells are white, turn grey just before they settle, then go blank.
  // Nothing stays drawn once a cell has settled.
  const Grid = (() => {
    const cv = $('#grid');
    const ctx = cv.getContext('2d');
    const COLORS = ['#ececec', '#6e6e6e']; // white (far from settling), grey (about to settle)
    let dpr = 1, cols = 0, rows = 0, atlas = null;
    let from = new Float64Array(0), until = new Float64Array(0), greyAt = new Float64Array(0);
    let endAt = 0, raf = 0, lastDraw = 0;
    let cRect = null, occ = null; // first load: content area is noisy too, except under text

    function buildAtlas() {
      atlas = document.createElement('canvas');
      atlas.width = CELL_W * dpr * GLYPHS.length;
      atlas.height = CELL_H * dpr * COLORS.length;
      const a = atlas.getContext('2d');
      a.scale(dpr, dpr);
      a.font = '14px "IBM Plex Mono", ui-monospace, monospace';
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      COLORS.forEach((c, row) => {
        a.fillStyle = c;
        [...GLYPHS].forEach((g, i) => a.fillText(g, i * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2 + 1));
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.ceil(innerWidth * dpr);
      cv.height = Math.ceil(innerHeight * dpr);
      cols = Math.ceil(innerWidth / CELL_W);
      rows = Math.ceil(innerHeight / CELL_H);
      from = new Float64Array(cols * rows);
      until = new Float64Array(cols * rows);
      greyAt = new Float64Array(cols * rows);
      cRect = null;
      buildAtlas();
      draw(performance.now());
    }

    // Cells under content and HUD stay blank; text sits on pure black.
    function holes() {
      const showing = !cRect && main.style.visibility !== 'hidden';
      const els = [$('.hud-top'), $('.hud-bottom'), showing && current && $('#' + current)].filter(Boolean);
      return els.map((el) => {
        const r = el.getBoundingClientRect();
        return [
          Math.floor(r.left / CELL_W) - 1, Math.floor(r.top / CELL_H),
          Math.ceil(r.right / CELL_W), Math.ceil(r.bottom / CELL_H),
        ];
      });
    }

    function draw(now) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (now >= endAt) { cRect = null; return; }
      const hs = holes();
      const w = CELL_W * dpr, h = CELL_H * dpr;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let skip = false;
          for (const [x0, y0, x1, y1] of hs) if (x >= x0 && x < x1 && y >= y0 && y < y1) { skip = true; break; }
          if (skip) continue;
          if (occ && occ[i]) continue; // the text there already scrambles on its own
          if (now < from[i] || now >= until[i]) continue;
          ctx.drawImage(atlas, ((Math.random() * GLYPHS.length) | 0) * w, now >= greyAt[i] ? h : 0, w, h, x * w, y * h, w, h);
        }
      }
    }

    function loop(now) {
      if (now - lastDraw > 45) { draw(now); lastDraw = now; }
      if (now < endAt) raf = requestAnimationFrame(loop);
      else { raf = 0; draw(now); }
    }

    // Each cell scrambles from t0+fromRange to t0+untilRange (+ a top-to-bottom sweep).
    // `sweep` is a number (ms across the full height) or a function of the row's
    // pixel y returning that row's delay. `content` ({ el, at(py) }) makes the
    // element's area noisy too, going blank row by row at at(py) ms.
    // `grey` is { rows: n } (grey when the settle wave is within n rows) or { ms: n }.
    function noise(fromRange, untilRange, sweep = 0, content = null, grey = { ms: T.grey }) {
      const t0 = performance.now();
      let max = 0;
      cRect = null;
      occ = null;
      if (content) {
        const r = content.el.getBoundingClientRect();
        cRect = [Math.floor(r.left / CELL_W) - 1, Math.floor(r.top / CELL_H), Math.ceil(r.right / CELL_W), Math.ceil(r.bottom / CELL_H)];
        occ = content.occupied(cols, rows);
      }
      // When each row settles: outside the content (sweep) and inside it (with its text line).
      const rowOut = new Float64Array(rows), rowIn = new Float64Array(rows);
      for (let y = 0; y < rows; y++) {
        const py = y * CELL_H + CELL_H / 2;
        rowOut[y] = typeof sweep === 'function' ? sweep(py) : sweep * (y / Math.max(1, rows - 1));
        rowIn[y] = content ? content.at(py) : rowOut[y];
      }
      for (let y = 0; y < rows; y++) {
        const inRow = cRect && y >= cRect[1] && y < cRect[3];
        const ahead = Math.max(0, y - (grey.rows || 0));
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const inside = inRow && x >= cRect[0] && x < cRect[2];
          const tab = inside ? rowIn : rowOut;
          const j = rnd(untilRange[0], untilRange[1]);
          from[i] = t0 + rnd(fromRange[0], fromRange[1]);
          until[i] = t0 + tab[y] + j;
          greyAt[i] = grey.rows != null ? t0 + tab[ahead] + j : until[i] - grey.ms;
          if (until[i] > max) max = until[i];
        }
      }
      endAt = max;
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function refresh() { if (!raf) draw(performance.now()); }

    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 100); });
    resize();
    return { noise, refresh, holes, rebuild: () => { buildAtlas(); refresh(); } };
  })();

  // ---------- Pointer reveal (all screens) ----------
  // Random glyphs fade in around the pointer, strongest right under it and
  // dying off with distance. Content and HUD areas stay blank.
  const Hover = (() => {
    const cv = document.createElement('canvas');
    cv.id = 'hover';
    cv.setAttribute('aria-hidden', 'true');
    $('#grid').after(cv);
    const ctx = cv.getContext('2d');
    const R = 16;           // radius in cells
    const PEAK = 0.36; // opacity right under the pointer (kept low: decoration only)
    const FOLLOW = 0.14;    // pointer smoothing per frame (lower = more lag)
    const RISE = 0.12, FALL = 0.05; // per-cell ease in / out, so light trails the pointer
    let dpr = 1, tx = -1, ty = -1, sx = -1, sy = -1, target = 0, raf = 0;
    let al = new Float32Array(0), born = new Float64Array(0), life = new Float32Array(0), lines = [], cols = 0, rows = 0;
    const DIGITS = '0123456789ABCDEF';
    // Words from the whole site: cells scramble as digits, then settle on a letter of one.
    const WORDS = [...new Set((document.body.textContent.match(/[A-Za-z]{3,12}/g) || []))];
    function wordRow(n) {
      let t = '';
      while (t.length < n) t += WORDS[(Math.random() * WORDS.length) | 0] + ' ';
      return t;
    }

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.ceil(innerWidth * dpr);
      cv.height = Math.ceil(innerHeight * dpr);
      cols = Math.ceil(innerWidth / CELL_W);
      rows = Math.ceil(innerHeight / CELL_H);
      al = new Float32Array(cols * rows);
      born = new Float64Array(cols * rows);
      life = new Float32Array(cols * rows);
      lines = Array.from({ length: rows }, () => (WORDS.length ? wordRow(cols) : ''));
    }

    // Returns true while anything is still visible or moving.
    function step(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      sx += (tx - sx) * FOLLOW; sy += (ty - sy) * FOLLOW;
      const hs = Grid.holes();
      const x0 = Math.max(0, Math.floor(sx / CELL_W) - R - 2), x1 = Math.min(cols, Math.floor(sx / CELL_W) + R + 3);
      const y0 = Math.max(0, Math.floor(sy / CELL_H) - R - 2), y1 = Math.min(rows, Math.floor(sy / CELL_H) + R + 3);
      ctx.font = '14px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#8c8c8c';
      let live = Math.abs(tx - sx) + Math.abs(ty - sy) > 0.5;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let t = 0;
          if (target && x >= x0 && x < x1 && y >= y0 && y < y1) {
            const d = Math.hypot((x + 0.5) * CELL_W - sx, (y + 0.5) * CELL_H - sy) / CELL_W;
            const k = Math.max(0, 1 - d / R);
            t = k * k * k;
          }
          const a = al[i] += (t - al[i]) * (t > al[i] ? RISE : FALL);
          if (a < 0.004) { al[i] = 0; born[i] = 0; continue; }
          live = true;
          if (hs.some(([h0, h1, h2, h3]) => x >= h0 && x < h2 && y >= h1 && y < h3)) continue;
          if (!born[i]) { born[i] = now; life[i] = 220 + Math.random() * 520; }
          let ch = lines[y][x] || ' ';
          if (now - born[i] < life[i]) ch = DIGITS[(Math.random() * DIGITS.length) | 0];
          else if (ch === ' ') continue; // word gap: settles blank
          ctx.globalAlpha = PEAK * a;
          ctx.fillText(ch, x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2 + 1);
        }
      }
      ctx.globalAlpha = 1;
      return live;
    }

    function loop(now) { raf = step(now) ? requestAnimationFrame(loop) : 0; }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    const on = () => !reduced();
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !on()) return;
      if (!target) { sx = e.clientX; sy = e.clientY; }
      tx = e.clientX; ty = e.clientY; target = 1; kick();
    });
    document.documentElement.addEventListener('mouseleave', () => { target = 0; kick(); });
    addEventListener('blur', () => { target = 0; kick(); });
    addEventListener('hashchange', () => { if (!on()) { target = 0; kick(); } });
    addEventListener('resize', size);
    size();
    return { off: () => { target = 0; kick(); } };
  })();

  // ---------- Layout helpers: character rules + big text ----------
  let chW = 9;
  function measureCh() {
    const probe = document.createElement('span');
    probe.textContent = 'x'.repeat(100);
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit';
    document.body.appendChild(probe);
    chW = probe.getBoundingClientRect().width / 100 || 9;
    probe.remove();
  }

  function fillRules(root) {
    $$('.rule', root).forEach((el) => {
      const c = el.dataset.char || '-';
      el.textContent = c.repeat(Math.max(8, Math.floor(el.clientWidth / chW)));
    });
  }

  function fitBig(root) {
    $$('.bigtext', root).forEach((el) => {
      const avail = el.parentElement.clientWidth;
      el.style.fontSize = '20px';
      const natural = el.scrollWidth;
      const max = +el.dataset.max || 14;
      let fs = Math.min(max, (20 * avail * 0.96) / natural);
      el.style.fontSize = fs.toFixed(2) + 'px';
      // Glyph advances round at small sizes, so nudge down until it fits.
      for (let i = 0; i < 12 && el.scrollWidth > el.clientWidth; i++) {
        fs *= 0.96;
        el.style.fontSize = fs.toFixed(2) + 'px';
      }
    });
  }

  function layout(root) { fillRules(root); fitBig(root); }

  // ---------- Text decryption, one line after another ----------
  function collect(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.data.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest('.sr-only, script, style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  // Returns each character's visual line index (top-to-bottom order).
  function lineMap(nodes) {
    const range = document.createRange();
    const tops = nodes.map((node) => {
      const arr = new Float32Array(node.data.length);
      for (let i = 0; i < arr.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        arr[i] = Math.round(range.getBoundingClientRect().top);
      }
      return arr;
    });
    const uniq = [...new Set(tops.flatMap((a) => [...a]))].sort((a, b) => a - b);
    // merge tops that are within a few px (same visual line, mixed fonts)
    const lines = [];
    for (const t of uniq) if (!lines.length || t - lines[lines.length - 1] > 6) lines.push(t);
    const idx = (t) => { let i = 0; while (i + 1 < lines.length && lines[i + 1] <= t + 6) i++; return i; };
    return { tops: tops.map((a) => Array.from(a, idx)), count: lines.length, lines, idx };
  }

  // Marks the noise-grid cells that hold text, so the canvas leaves them to the text scramble.
  function occupancy(root, cols, rows) {
    const occ = new Uint8Array(cols * rows);
    const range = document.createRange();
    for (const node of collect(root)) {
      for (let k = 0; k < node.data.length; k++) {
        if (node.data[k] === ' ' || node.data[k] === '\n') continue;
        range.setStart(node, k);
        range.setEnd(node, k + 1);
        const r = range.getBoundingClientRect();
        if (!r.width) continue;
        const x0 = Math.max(0, Math.floor(r.left / CELL_W)), x1 = Math.min(cols - 1, Math.floor((r.right - 0.5) / CELL_W));
        const y0 = Math.max(0, Math.floor(r.top / CELL_H)), y1 = Math.min(rows - 1, Math.floor((r.bottom - 0.5) / CELL_H));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) occ[y * cols + x] = 1;
      }
    }
    return occ;
  }

  // Every line scrambles from the start. Lines lock in top to bottom, eased so
  // the last lines settle much faster than the first.
  function decryptIn(root, delay, budget) {
    const nodes = collect(root);
    const { tops, count, lines, idx } = lineMap(nodes);
    const stagger = clamp(budget / Math.max(1, count), 12, 130);
    const span = (count - 1) * stagger;
    const lineT = (i) => delay + (count > 1 ? span * (1 - Math.pow(1 - clamp(i / (count - 1), 0, 1), T.ease)) : 0);
    const items = nodes.map((node, n) => {
      const o = node.data;
      const times = new Float32Array(o.length);
      for (let i = 0; i < o.length; i++) {
        const ch = o[i];
        times[i] = ch === ' ' || ch === '\n' ? -1 : lineT(tops[n][i]) + Math.random() * T.jitter;
      }
      return { node, o, times, buf: o.split('') };
    });
    const total = lineT(count - 1) + T.jitter + 30;
    const job = run(items, total, 'in');
    // When a pixel row locks in (ms from now): `at` per text line, `timeAtY` smooth between lines.
    job.at = (py) => lineT(idx(py));
    job.timeAtY = (py) => {
      if (!lines.length) return delay;
      if (py <= lines[0]) return lineT(0);
      let i = 0;
      while (i + 1 < lines.length && lines[i + 1] <= py) i++;
      if (i + 1 >= lines.length) return lineT(i);
      return lineT(i + (py - lines[i]) / (lines[i + 1] - lines[i]));
    };
    return job;
  }

  function decryptOut(root, ms) {
    const items = collect(root).map((node) => {
      const o = node.data;
      const times = Float32Array.from(o, (ch) => (ch === ' ' || ch === '\n' ? -1 : Math.random() * ms * 0.8));
      return { node, o, times, buf: o.split('') };
    });
    return run(items, ms, 'out');
  }

  function run(items, total, mode) {
    let lastSwap = -1e9;
    const step = (el, now) => {
      const swap = now - lastSwap > 50;
      if (swap) lastSwap = now;
      for (const it of items) {
        const { o, times, buf } = it;
        let dirty = false;
        for (let i = 0; i < buf.length; i++) {
          const t = times[i];
          if (t < 0) continue;
          if (mode === 'in') {
            if (el >= t) { if (buf[i] !== o[i]) { buf[i] = o[i]; dirty = true; } }
            else if (swap || buf[i] === o[i]) { buf[i] = pick(NOISE); dirty = true; }
          } else if (el >= t && swap) { buf[i] = pick(NOISE); dirty = true; }
        }
        if (dirty) it.node.data = buf.join('');
      }
    };
    const restore = () => { for (const it of items) it.node.data = it.o; };
    if (mode === 'in') step(0, performance.now()); // noise before the first paint
    const done = new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        const el = now - start;
        if (el >= total) { if (mode === 'in') restore(); resolve(); return; }
        step(el, now);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    return { done, restore };
  }

  // ---------- Sound ----------
  // assets/audio/decrypts.m4a is the code-decrypting effect, cut from the
  // reference clip with the voice removed. A synth fallback covers decode failures.
  // Browsers may block audio until the first tap or key press. If the load
  // animation is still running when that happens, the rest of it plays.
  const Sound = (() => {
    const btn = $('#sound');
    let on = store.get('sound') !== 'off';
    let ac = null, out = null, buffer = null, pendingUntil = 0;
    const raw = fetch('assets/audio/decrypts.m4a').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    let ready = Promise.resolve();

    function init() {
      if (ac) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch { return; }
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 280; // trims room rumble under the clicks
      hp.connect(ac.destination);
      out = hp;
      ready = raw.then((ab) => ab && ac.decodeAudioData(ab.slice(0))).then((b) => { if (b) buffer = b; }).catch(() => {});
      ac.addEventListener('statechange', flushPending);
    }

    function flushPending() {
      if (!ac || ac.state !== 'running' || !pendingUntil) return;
      const left = pendingUntil - performance.now();
      pendingUntil = 0;
      if (left > 250) start(left);
    }

    function unlock() {
      init();
      if (ac && ac.state === 'suspended') ac.resume().then(flushPending).catch(() => {});
    }

    const VOL = 1; // 
    // Plays the file from its start for as long as the animation runs (capped at the file length).
    function clip(ms) {
      const t = ac.currentTime + 0.01, d = Math.min(ms / 1000, buffer.duration);
      const src = ac.createBufferSource();
      const g = ac.createGain();
      src.buffer = buffer;
      g.gain.setValueAtTime(VOL, t);
      if (d < buffer.duration) { // cut early: 20 ms fade so the end doesn't click
        g.gain.setValueAtTime(VOL, t + Math.max(0, d - 0.02));
        g.gain.linearRampToValueAtTime(0, t + d);
      }
      src.connect(g).connect(out);
      src.start(t, 0, d);
    }

    function synth(ms) {
      const t0 = ac.currentTime + 0.01, d = ms / 1000;
      for (let t = t0; t < t0 + d; t += 0.02 + Math.random() * 0.03) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square';
        o.frequency.value = 1200 + Math.random() * 2800;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.03);
      }
    }

    function start(ms) { if (buffer) clip(ms); else synth(ms); }

    function play(ms) {
      if (!on) return;
      init();
      if (!ac) return;
      if (ac.state === 'running') { start(ms); return; }
      pendingUntil = performance.now() + ms; // plays the remainder once audio is allowed
      ac.resume().then(flushPending).catch(() => {});
    }

    function render() {
      btn.setAttribute('aria-pressed', String(on));
      $('.state', btn).textContent = on ? 'ON' : 'OFF';
    }
    btn.hidden = false;
    render();
    btn.addEventListener('click', () => {
      on = !on;
      store.set('sound', on ? 'on' : 'off');
      render();
      unlock();
      if (on) setTimeout(() => play(400), 30);
      track(on ? 'sound_on' : 'sound_off');
    });
    // Browsers only start audio inside a real gesture; Safari wants click/touchend/keydown.
    ['pointerdown', 'pointerup', 'mousedown', 'click', 'keydown', 'touchstart', 'touchend'].forEach((ev) =>
      addEventListener(ev, unlock, { passive: true, capture: true }));

    // Start decoding now so the first-load sound is ready.
    if (on) init();
    return { play, ready: () => ready };
  })();

  // ---------- Hotkeys toggle (WCAG 2.1.4: single-key shortcuts can be turned off) ----------
  const hotBtn = $('#hotkeys');
  let hotkeys = store.get('hotkeys') !== 'off';
  const renderHot = () => {
    hotBtn.setAttribute('aria-pressed', String(hotkeys));
    $('.state', hotBtn).textContent = hotkeys ? 'ON' : 'OFF';
    document.documentElement.classList.toggle('no-hotkeys', !hotkeys);
  };
  hotBtn.hidden = false;
  renderHot();
  hotBtn.addEventListener('click', () => { hotkeys = !hotkeys; store.set('hotkeys', hotkeys ? 'on' : 'off'); renderHot(); });

  // ---------- Viewer ----------
  const viewer = $('#viewer');
  const viewerImg = $('#viewer-img');
  let viewerTrigger = null;
  $$('.img-btn').forEach((b) => b.addEventListener('click', () => {
    const img = $('img', b);
    viewerTrigger = b;
    viewerImg.style.setProperty('--ar', (img.getAttribute('width') / img.getAttribute('height')) || 1.5);
    viewerImg.src = b.dataset.full;
    viewerImg.alt = img.alt;
    $('#viewer-caption').textContent = img.alt;
    viewer.showModal();
    $('#viewer-close').focus();
    track('view_image_' + current);
  }));
  viewerImg.addEventListener('load', () => { if (viewerImg.naturalWidth) viewerImg.style.setProperty('--ar', viewerImg.naturalWidth / viewerImg.naturalHeight); });
  $('#viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (e) => { if (e.target !== viewerImg && !e.target.closest('button')) viewer.close(); });
  viewer.addEventListener('close', () => { if (viewerTrigger) viewerTrigger.focus(); });

  // ---------- Screens ----------
  function activate(id) {
    $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
    current = id;
    const el = $('#' + id);
    document.title = TITLES[id];
    pathEl.textContent = PATHS[id];
    const navId = PROJECTS.includes(id) || id === 'works' ? 'work' : id;
    $$('.topnav a').forEach((a) => {
      if (a.dataset.nav === navId) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    scrollTo(0, 0);
    initMenus(el);
    Cmd.mount(el);
    layout(el);
    return el;
  }

  // Project images: each picture starts as a field of scrambling digits, and every cell turns into
  // a pixel of the image when the text row at its height locks in. Then the real image fades in.
  function revealImages(root, job) {
    const PH = CELL_H / 2; // two image pixels per text row
    $$('.img-btn img', root).forEach((img) => {
      img.loading = 'eager';
      const box = img.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const w = Math.round(box.width), h = Math.round(box.height);
      const cols = Math.ceil(w / CELL_W), rows = Math.ceil(h / CELL_H);
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const cv = document.createElement('canvas');
      cv.className = 'img-fx';
      cv.width = w * dpr; cv.height = h * dpr;
      cv.setAttribute('aria-hidden', 'true');
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      img.parentElement.appendChild(cv);

      // time each text-row cell locks, and one pixel colour per half-row
      const lock = new Float32Array(cols * rows);
      let end = 0;
      for (let y = 0; y < rows; y++) {
        const base = job.timeAtY(box.top + y * CELL_H);
        for (let x = 0; x < cols; x++) { const t = base + Math.random() * T.jitter * 2; lock[y * cols + x] = t; if (t > end) end = t; }
      }
      let px = null;
      const sample = () => {
        const pc = document.createElement('canvas');
        pc.width = cols; pc.height = rows * 2;
        const c = pc.getContext('2d', { willReadFrequently: true });
        const iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw) return null;
        const ar = w / h; // object-fit: cover
        let sw = iw, sh = iw / ar;
        if (sh > ih) { sh = ih; sw = ih * ar; }
        c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, cols, rows * 2);
        const d = c.getImageData(0, 0, cols, rows * 2).data, out = new Array(cols * rows * 2);
        for (let i = 0; i < out.length; i++) {
          let l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
          l = clamp(((l / 255 - 0.5) * 1.08 + 0.5) * 0.92 * 255, 0, 255) | 0;
          out[i] = `rgb(${l},${l},${l})`;
        }
        return out;
      };
      img.decode().catch(() => {}).then(() => { px = sample(); });

      const start = performance.now();
      let lastSwap = -1e9;
      const glyph = new Array(cols * rows);
      const frame = (now) => {
        const el = now - start;
        const swap = now - lastSwap > 50;
        if (swap) lastSwap = now;
        ctx.font = '14px "IBM Plex Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const done = el >= lock[i] && px;
            if (done ? glyph[i] === null : !swap && glyph[i] !== undefined) continue;
            const X = x * CELL_W, Y = y * CELL_H;
            ctx.fillStyle = '#000';
            ctx.fillRect(X, Y, CELL_W, CELL_H);
            if (done) {
              glyph[i] = null;
              ctx.fillStyle = px[(y * 2) * cols + x]; ctx.fillRect(X, Y, CELL_W, PH);
              ctx.fillStyle = px[(y * 2 + 1) * cols + x]; ctx.fillRect(X, Y + PH, CELL_W, PH);
            } else {
              glyph[i] = pick(NOISE);
              ctx.fillStyle = Math.random() < 0.12 ? '#ff7a2f' : '#8c8c8c';
              ctx.fillText(glyph[i], X + CELL_W / 2, Y + CELL_H / 2 + 1);
            }
          }
        }
        if (el > end + 40 && px) {
          cv.style.opacity = '0';
          setTimeout(() => cv.remove(), 300);
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  async function show(id, first = false) {
    if (id === current) return;
    busy = true;
    main.setAttribute('aria-busy', 'true');
    const prev = current && $('#' + current);

    if (reduced()) {
      activate(id);
      Grid.refresh();
    } else if (first) {
      const L = T.load;
      const el = activate(id);
      main.style.visibility = '';
      el.classList.add('entering');
      const job = decryptIn(el, L.linesAt, L.linesBudget);
      revealImages(el, job);
      // Rows outside the content settle on the same top-to-bottom schedule as the text.
      const lh = parseFloat(getComputedStyle($('p', el) || el).lineHeight) || 22;
      const greyRows = Math.max(2, Math.round((L.greyLines * lh) / CELL_H));
      Grid.noise([0, 0], L.bgJitter, job.timeAtY, { el, at: job.at, occupied: (c, r) => occupancy(el, c, r) }, { rows: greyRows });
      Sound.play(L.sound);
      await job.done;
    } else {
      const M = T.move;
      Sound.play(M.sound);
      Grid.noise([0, 80], M.bgUntil, M.bgSweep);
      if (prev) {
        const out = decryptOut(prev, M.out);
        await out.done;
        out.restore();
        prev.classList.remove('entering');
      }
      const el = activate(id);
      el.classList.add('entering');
      Grid.refresh();
      const job = decryptIn(el, 0, M.linesBudget);
      revealImages(el, job);
      await job.done;
    }

    setTimeout(() => { const el = $('#' + id); if (el) el.classList.remove('entering'); }, 600);
    main.removeAttribute('aria-busy');
    busy = false;
    if (!first) $('h1, h2', $('#' + id)).focus({ preventScroll: true });
    Grid.refresh();
    track('screen_' + id);

    const want = idFromHash();
    if (want !== current) show(want); // a link was used mid-animation
  }

  function idFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    return SCREENS.includes(id) ? id : 'intro';
  }

  addEventListener('hashchange', () => { if (!busy) show(idFromHash()); });

  // Keys resolve on the active screen first, then the top nav. data-key holds space-separated keys.
  const keyTarget = (k) => current && ($(`#${current} [data-key~="${k}"]`) || $(`.topnav [data-key~="${k}"]`));

  // ---------- Option lists (Claude Code style) ----------
  // Each .menu keeps one selected row. Hover, focus and ↑/↓ move it; Enter confirms it.
  const cmdInput = $('#cmd-input');
  const selectOpt = (opt) => {
    $$('.opt', opt.closest('.menu')).forEach((o) => o.classList.toggle('is-sel', o === opt));
    if (document.activeElement === cmdInput) cmdInput.blur(); // the type row is a list row too
  };
  const initMenus = (root) => $$('.menu', root).forEach((m) => { const first = $('.opt', m); if (first) selectOpt(first); });
  const optOf = (e) => e.target.closest && e.target.closest('.opt');
  main.addEventListener('mouseover', (e) => { const o = optOf(e); if (o) selectOpt(o); });
  main.addEventListener('focusin', (e) => { const o = optOf(e); if (o) selectOpt(o); });

  // Moves the selection through the active screen's options, then the type row, and wraps.
  function moveSel(dir) {
    const screen = $('#' + current);
    const menu = $('.menu', screen);
    const opts = menu ? $$('.opt', menu) : [];
    const onType = document.activeElement === cmdInput;
    const at = onType ? opts.length : Math.max(0, opts.findIndex((o) => o.classList.contains('is-sel')));
    const next = (at + dir + opts.length + 1) % (opts.length + 1);
    if (next === opts.length) { cmdInput.focus({ preventScroll: true }); return true; }
    const hadFocus = menu.contains(document.activeElement);
    selectOpt(opts[next]);
    if (hadFocus) opts[next].focus({ preventScroll: true });
    return true;
  }

  // ---------- Command input ----------
  // "/" opens a list of pages. ↑/↓ choose, Tab or Enter go, a click goes too.
  const Cmd = (() => {
    const root = $('#cmd'), input = cmdInput, box = $('.cmd-box', $('#cmd')), list = $('#cmd-list'), msg = $('#cmd-msg');
    const COMMANDS = [
      { name: 'intro', id: 'intro', desc: 'Who I am' },
      { name: 'works', id: 'works', desc: 'All case studies' },
      { name: 'shifl', id: 'shifl', desc: 'Customer portal' },
      { name: 'pathao', id: 'pathao', desc: 'App home screen' },
      { name: 'boost', id: 'boost', desc: 'Merchant portal' },
      { name: 'contact', id: 'contact', desc: 'Email, résumé and links' },
    ];
    let items = [], sel = 0, oopsN = 0;
    // Humble, slightly funny replies for anything that isn't a page. Always points back to the commands.
    const OOPS = [
      (q) => `"${q}"? My terminal is shy and only knows a few words. Type / to see them.`,
      (q) => `Sorry, I'm just a humble portfolio and "${q}" is beyond me. Try / for the pages I do know.`,
      (q) => `I looked everywhere for "${q}" and came back empty-handed. Type / to see what I can open.`,
      (q) => `Bold of you to ask for "${q}". I only speak a handful of commands. Type / to meet them.`,
      (q) => `"${q}" is not in my vocabulary yet. Gently try / and pick a page.`,
    ];
    const oops = (q) => OOPS[oopsN++ % OOPS.length](q.length > 24 ? q.slice(0, 24) + '…' : q);

    const query = () => input.value.replace(/^\//, '').trim().toLowerCase();
    const match = () => {
      const q = query();
      return COMMANDS.filter((c) => c.name.startsWith(q)).concat(COMMANDS.filter((c) => !c.name.startsWith(q) && c.name.includes(q)));
    };

    function paint() {
      [...list.children].forEach((li, i) => {
        li.classList.toggle('is-sel', i === sel);
        li.setAttribute('aria-selected', String(i === sel));
      });
      if (items.length) input.setAttribute('aria-activedescendant', 'cmd-opt-' + items[sel].name);
      else input.removeAttribute('aria-activedescendant');
    }

    function render() {
      const typing = input.value.startsWith('/') && document.activeElement === input;
      items = typing ? match() : [];
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.replaceChildren(...items.map((c) => {
        const li = document.createElement('li');
        li.id = 'cmd-opt-' + c.name;
        li.className = 'cmd-opt';
        li.setAttribute('role', 'option');
        const name = document.createElement('span');
        name.className = 'cmd-name';
        name.textContent = '/' + c.name;
        const desc = document.createElement('span');
        desc.className = 'cmd-desc';
        desc.textContent = c.desc;
        li.append(name, desc);
        li.addEventListener('mousemove', () => { sel = items.indexOf(c); paint(); });
        li.addEventListener('click', () => go(c));
        return li;
      }));
      list.hidden = !items.length;
      input.setAttribute('aria-expanded', String(!!items.length));
      msg.textContent = typing && !items.length ? oops(input.value.trim()) : '';
      paint();
      if (items.length) list.lastElementChild.scrollIntoView({ block: 'nearest' });
    }

    function go(c) {
      input.value = '';
      sel = 0;
      render();
      if (!c) return;
      if (c.id === current) { msg.textContent = 'You are already there.'; return; }
      track('cmd_' + c.name);
      location.hash = '#' + c.id;
    }

    function submit() {
      if (items.length) return go(items[sel]);
      const q = query();
      if (!q) return;
      const hit = COMMANDS.find((c) => c.name === q) || (match().length === 1 ? match()[0] : null);
      if (hit) return go(hit);
      msg.textContent = oops(input.value.trim());
    }

    input.addEventListener('input', () => { sel = 0; render(); });
    // The type row is the last row of the screen's list: focusing it deselects the others.
    input.addEventListener('focus', () => { $$('.menu .opt', root.parentElement).forEach((o) => o.classList.remove('is-sel')); render(); });
    input.addEventListener('blur', () => {
      sel = 0;
      render();
      // Clicked away: keep one option selected so Enter still has a target.
      setTimeout(() => {
        const menu = $('.menu', root.parentElement);
        if (menu && document.activeElement !== input && !$('.opt.is-sel', menu)) selectOpt($('.opt', menu));
      }, 0);
    });
    box.addEventListener('mouseover', () => { if (document.activeElement !== input) input.focus({ preventScroll: true }); });
    box.addEventListener('click', () => input.focus({ preventScroll: true }));
    // Keep focus in the field while a row is clicked.
    list.addEventListener('mousedown', (e) => e.preventDefault());
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        if (items.length) { sel = (sel + dir + items.length) % items.length; paint(); } // command list open
        else moveSel(dir);                                                              // leave the type row
      } else if (e.key === 'Tab' && !e.shiftKey && items.length) {
        e.preventDefault();
        go(items[sel]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape' && input.value) {
        e.preventDefault();
        input.value = '';
        render();
      }
    });

    return {
      // Puts the one input at the end of the screen that is showing.
      mount(screen) {
        input.value = '';
        sel = 0;
        screen.appendChild(root);
        const n = $$('.menu .opt', screen).length + 1;
        $('.num', box).textContent = n + '.';
        box.dataset.key = String(n);
        root.hidden = false;
        render();
      },
      open() {
        input.focus({ preventScroll: true });
        input.value = '/';
        render();
      },
    };
  })();

  // ---------- Input ----------
  // Only options, links and their keys move between sections. Clicking empty space does nothing.
  const INTERACTIVE = 'a, button, input, textarea, select, summary, [contenteditable], dialog';
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || viewer.open || busy) return;
    const inField = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!inField && current && moveSel(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      if (e.target.closest && e.target.closest(INTERACTIVE)) return;
      const el = (current && $('.menu .opt.is-sel', $('#' + current))) || keyTarget('enter');
      if (el) { e.preventDefault(); el.click(); }
      return;
    }
    if (!hotkeys || e.key.length !== 1 || inField) return;
    if (e.key === '/') { e.preventDefault(); Cmd.open(); return; }
    const el = keyTarget(e.key.toLowerCase());
    if (el) { e.preventDefault(); el.click(); }
  });

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { measureCh(); if (current && !busy) { layout($('#' + current)); Grid.refresh(); } }, 120);
  });

  // ---------- Intro art ----------
  // SHAMS as chunky pixel letters: solid blocks plus a dotted shadow down and to the left.
  // Each pixel is 2 characters wide and 1 row tall.
  const FONT5 = {
    S: ['.#####', '##....', '##....', '.####.', '....##', '....##', '#####.'],
    H: ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
    A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
    M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##'],
    L: ['##....', '##....', '##....', '##....', '##....', '##....', '######'],
    E: ['######', '##....', '##....', '#####.', '##....', '##....', '######'],
    T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
    K: ['##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##'],
    "'": ['##', '##', '#.', '..', '..', '..', '..'],
    ' ': ['...', '...', '...', '...', '...', '...', '...'],
  };
  const makeArt = (text) => {
    const G = FONT5;
    const rows = Array.from({ length: 7 }, () => []);
    const chars = [...text];
    chars.forEach((ch, n) => {
      const g = G[ch];
      for (let y = 0; y < 7; y++) {
        for (const c of g[y]) rows[y].push(c === '#' ? '██' : '  ');
        if (n < chars.length - 1) rows[y].push('  ');
      }
    });
    const cells = rows.map((r) => r.join('').split(''));
    const w = cells[0].length;
    const out = cells.map((r) => r.slice());
    out.push(new Array(w).fill(' '));
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < w; x++) {
        if (cells[y][x] === '█' && x > 0 && out[y + 1][x - 1] === ' ') out[y + 1][x - 1] = '░';
      }
    }
    return out.map((r) => r.join('').trimEnd()).join('\n');
  };
  const ART = makeArt('SHAMS');

  $('.bigtext', $('#intro')).textContent = ART;
  $('.bigtext', $('#contact')).textContent = makeArt("LET'S TALK");

  // ---------- Boot ----------
  // Fonts and audio load first (capped), then the noise and decrypt run on the first screen.
  // Audio may stay blocked until the first key or click; the rest of the sound plays then.
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, sleep(400)]) : Promise.resolve();
  const assetsReady = Promise.all([fontsReady, Promise.race([Sound.ready(), sleep(300)])]);

  if (!reduced()) { main.style.visibility = 'hidden'; Grid.noise([0, 0], [5000, 5000], 0, null, { ms: 0 }); }
  assetsReady.then(async () => {
    measureCh(); Grid.rebuild();
    await show(idFromHash(), true);
    const h = $('h1, h2', $('#' + current));
    if (h) h.focus({ preventScroll: true });
  });
})();
