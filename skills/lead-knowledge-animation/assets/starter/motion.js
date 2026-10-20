/* motion.js — 零依赖的确定性动效运行时
 * 核心约定：任意时刻的画面 = render(t) 的纯函数。
 *   - 不用 CSS transition / animation、setTimeout、requestAnimationFrame 驱动画面；
 *   - 不用 Math.random / Date.now；随机一律用 M.rng(seed) / M.noise；
 *   - 不在帧与帧之间保留状态（需要“历史”时，从 t 重新推导，或用解析式弹簧叠加）。
 * render.mjs / stills.mjs / verify.mjs 通过 window.seek(t) 驱动；浏览器直接打开时是带进度条的预览器。
 */
(function () {
  'use strict';
  const M = {};

  // ───────────── 数学基础 ─────────────
  M.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  M.lerp = (a, b, p) => a + (b - a) * p;
  M.invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
  /** 归一化进度：t 在 [a,b] 内映射到 0..1，并可套缓动 */
  M.prog = (t, a, b, ease) => {
    const p = M.clamp(M.invLerp(a, b, t));
    return ease ? ease(p) : p;
  };
  /** 从 a 映射到 b：M.map(t, 1.2, 1.8, 0, 300, M.ease.outExpo) */
  M.map = (t, t0, t1, v0, v1, ease) => M.lerp(v0, v1, M.prog(t, t0, t1, ease));
  M.smoothstep = (a, b, x) => { const p = M.clamp(M.invLerp(a, b, x)); return p * p * (3 - 2 * p); };
  M.fract = (x) => x - Math.floor(x);
  M.frameT = 0; // 当前帧中心时刻（见 window.seek）
  /** 按 fps 步进的时间：手作感（12fps 一拍二）或让某层“定格”在整帧上 */
  M.step = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;
  M.TAU = Math.PI * 2;

  // ───────────── 缓动 ─────────────
  const E = {};
  E.linear = (p) => p;
  E.inQuad = (p) => p * p; E.outQuad = (p) => 1 - (1 - p) * (1 - p);
  E.inOutQuad = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  E.inCubic = (p) => p * p * p; E.outCubic = (p) => 1 - Math.pow(1 - p, 3);
  E.inOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  E.outQuart = (p) => 1 - Math.pow(1 - p, 4);
  E.inOutQuart = (p) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2);
  E.inQuint = (p) => p ** 5; E.outQuint = (p) => 1 - Math.pow(1 - p, 5);
  E.inOutQuint = (p) => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2);
  E.inExpo = (p) => (p === 0 ? 0 : Math.pow(2, 10 * p - 10));
  E.outExpo = (p) => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p));
  E.inOutExpo = (p) => p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
  E.outCirc = (p) => Math.sqrt(1 - Math.pow(p - 1, 2));
  E.inOutSine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  E.outBack = (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  /** CSS 风格的三次贝塞尔：M.ease.bezier(.2,.8,.2,1) */
  E.bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (u) => ((ax * u + bx) * u + cx) * u;
    const sy = (u) => ((ay * u + by) * u + cy) * u;
    const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let u = x;
      for (let i = 0; i < 8; i++) { const d = dx(u); if (Math.abs(d) < 1e-6) break; u -= (sx(u) - x) / d; }
      u = M.clamp(u); return sy(u);
    };
  };
  M.ease = E;

  // ───────────── 关键帧 ─────────────
  /** keys: [[t, value, ease?], ...]；ease 作用于“到达该关键帧”的那一段。value 可为数字或数字数组 */
  M.kf = (t, keys, defEase = E.inOutCubic) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const p = (e || defEase)(M.clamp(M.invLerp(t0, t1, t)));
        return Array.isArray(v0) ? v0.map((a, j) => M.lerp(a, v1[j], p)) : M.lerp(v0, v1, p);
      }
    }
    return keys[keys.length - 1][1];
  };
  /** 缩放在对数空间插值，避免推拉时“前快后慢”的失真 */
  M.kfZoom = (t, keys, defEase = E.inOutCubic) =>
    Math.exp(M.kf(t, keys.map(([tt, z, e]) => [tt, Math.log(z), e]), defEase));

  // ───────────── 解析式弹簧 ─────────────
  /** 从 0 到 1 的阻尼弹簧响应（t 秒后）。k 刚度、d 阻尼、m 质量。示例：UI 170/26，标题 220/24 */
  M.springUnit = (t, k = 170, d = 26, m = 1, v0 = 0) => {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k / m), z = d / (2 * Math.sqrt(k * m));
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      const A = 1, B = (z * w0 * A - v0) / wd;
      return 1 - Math.exp(-z * w0 * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
    }
    const A = 1, B = w0 * A - v0;
    return 1 - Math.exp(-w0 * t) * (A + B * t);
  };
  /** 从 from 到 to，在 start 时刻起弹 */
  M.spring = (t, start, from, to, k, d, m) => M.lerp(from, to, M.springUnit(t - start, k, d, m));
  /** 叠加弹簧：targets = [[t0, v0], [t1, v1], ...]。每次换目标叠一根新弹簧，不重启、不跳变 */
  M.springTrack = (t, targets, k = 170, d = 26, m = 1) => {
    let v = targets[0][1];
    for (let i = 1; i < targets.length; i++) {
      const [ti, vi] = targets[i];
      if (t < ti) break;
      v += (vi - targets[i - 1][1]) * M.springUnit(t - ti, k, d, m);
    }
    return v;
  };
  M.springPresets = {
    snappy: [320, 30], ui: [170, 26], heavy: [120, 24], type: [220, 30], playful: [180, 12],
  };

  // ───────────── 确定性随机与噪声 ─────────────
  M.rng = (seed = 1) => {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let r = Math.imul(a ^ (a >>> 15), 1 | a); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  };
  /** 整数哈希 → 0..1，适合“第 i 个粒子的固定属性” */
  M.hash = (i, seed = 0) => { let h = (i * 374761393 + seed * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const fade = (x) => x * x * x * (x * (x * 6 - 15) + 10);
  M.noise1 = (x, seed = 0) => { const i = Math.floor(x), f = x - i; return M.lerp(M.hash(i, seed), M.hash(i + 1, seed), fade(f)) * 2 - 1; };
  M.noise2 = (x, y, seed = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => M.hash(a * 73856093 ^ b * 19349663, seed);
    const u = fade(xf), v = fade(yf);
    return M.lerp(M.lerp(h(xi, yi), h(xi + 1, yi), u), M.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v) * 2 - 1;
  };
  M.fbm = (x, y, oct = 4, seed = 0) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * M.noise2(x * f, y * f, seed + i * 17); f *= 2; a *= 0.5; } return s; };

  // ───────────── 编排 ─────────────
  /** 第 i 个元素（共 n 个）的错峰起点；spread 为总错峰时长，可传缓动让错峰本身有节奏 */
  M.stagger = (i, n, spread, ease = E.linear) => (n <= 1 ? 0 : ease(i / (n - 1)) * spread);
  /** 节拍：bpm + offset(第一拍时刻)。M.beat(8) 得到第 8 拍的秒数 */
  M.beats = (bpm, offset = 0) => { const spb = 60 / bpm; return { spb, at: (n) => offset + n * spb, index: (t) => (t - offset) / spb }; };
  /** 冲击包络：times 中每个时刻起，值瞬间到 1 再按 decay(秒) 指数回落。用于踩点的震动/闪光/缩放 */
  M.hit = (t, times, decay = 0.18) => { let v = 0; for (const h of times) { const d = t - h; if (d >= 0 && d < decay * 8) v = Math.max(v, Math.exp(-d / decay)); } return v; };
  /** 某元素的出入场：在 [a,b] 内可见，入场 inDur、出场 outDur，返回 {in, out, alive} */
  M.life = (t, a, b, inDur = 0.5, outDur = 0.35) => ({
    in: M.prog(t, a, a + inDur), out: M.prog(t, b - outDur, b), alive: t >= a && t <= b,
  });

  // ───────────── 颜色 ─────────────
  M.hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  M.rgba = (c, a = 1) => { const [r, g, b] = typeof c === 'string' ? M.hex(c) : c; return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
  /** 在线性光空间混色，比 sRGB 直接插值更干净（不发灰） */
  M.mixColor = (c1, c2, p) => {
    const a = typeof c1 === 'string' ? M.hex(c1) : c1, b = typeof c2 === 'string' ? M.hex(c2) : c2;
    const toL = (v) => Math.pow(v / 255, 2.2), toS = (v) => 255 * Math.pow(v, 1 / 2.2);
    return a.map((x, i) => toS(M.lerp(toL(x), toL(b[i]), p)));
  };

  // ───────────── Canvas 辅助 ─────────────
  /** 在 stage 内创建与设计尺寸一致的 canvas（按 devicePixelRatio 提高清晰度） */
  M.canvas = (parent, w, h, dpr = window.devicePixelRatio || 1) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px`;
    parent.appendChild(c);
    // willReadFrequently → CPU 光栅：比 GPU 慢一点，但同一时刻的抗锯齿结果稳定（verify 才能通过）
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { el: c, ctx, clear() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore(); } };
  };

  // ───────────── 资源等待 ─────────────
  const pending = [];
  /** 注册需要等待的资源（图片、视频 seeked、字体等）；渲染前统一 await */
  M.wait = (p) => { pending.push(p); return p; };
  M.image = (src) => M.wait(new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));

  // ───────────── 影片注册与预览器 ─────────────
  /**
   * M.film({
   *   width, height, fps, duration,
   *   scenes: [{ id, start, end, label }],   // 用于跳转、联系表取中点、局部渲染
   *   beats: { bpm, offset },                // 可选，预览器显示拍号
   *   cues: [{ t, sfx, gain, pan, align }],  // 可选，声音事件表：与画面共用同一组时间（scripts/cues.mjs 导出给 mix.py）
   *   stage: HTMLElement,                    // 设计尺寸的根节点（DOM/SVG/Canvas 都放这里）
   *   render(t) { ... }                      // 纯函数：只根据 t 改写画面；可返回 Promise（如视频 seek）
   * })
   */
  M.film = (opt) => {
    const { width, height, fps = 60, duration, render, stage } = opt;
    const scenes = opt.scenes || [];
    const isRender = navigator.webdriver || /[?&]render=1/.test(location.search);
    stage.style.width = width + 'px'; stage.style.height = height + 'px';
    stage.style.position = 'absolute'; stage.style.left = '0'; stage.style.top = '0';
    stage.style.overflow = 'hidden'; stage.style.transformOrigin = '0 0';

    let current = 0;
    // ft = 该帧中心时刻。运动模糊渲染时 t 是子帧时刻；需要保持清晰的层（滚动数字、小字）改用 M.frameT
    window.seek = async (t, ft) => { current = t; M.frameT = ft ?? t; await render(t); };
    window.__MOTION = { width, height, fps, duration, scenes, beats: opt.beats || null, cues: opt.cues || [] };

    const ready = (async () => {
      // 所有声明过的 @font-face 都在第一帧之前加载（懒加载会让第一次截图用错字体）
      if (document.fonts) { await Promise.all([...document.fonts].map((f) => f.load().catch(() => {}))); await document.fonts.ready; }
      await Promise.all(pending);
      await window.seek(0);
    })();
    window.__MOTION_READY = ready;

    if (isRender) { document.documentElement.classList.add('render-mode'); return; }
    ready.then(() => buildPreview());

    function buildPreview() {
      document.body.style.background = '#111';
      const fit = () => {
        const s = Math.min((innerWidth - 40) / width, (innerHeight - 110) / height);
        stage.style.transform = `translate(${(innerWidth - width * s) / 2}px, 20px) scale(${s})`;
      };
      addEventListener('resize', fit); fit();
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:10px 18px;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#ddd;background:#1b1b1b;display:flex;flex-direction:column;gap:6px;z-index:99999';
      bar.innerHTML = `<input type=range min=0 max=${duration} step=${1 / fps} value=0 style="width:100%">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button data-k=play>▶︎ 播放 [空格]</button><span data-k=time></span><span data-k=sc style="display:flex;gap:4px;flex-wrap:wrap"></span><span style="opacity:.55">←/→ 单帧 · Shift+←/→ 1 秒 · L 循环当前场景</span></div>`;
      document.body.appendChild(bar);
      const range = bar.querySelector('input'), timeEl = bar.querySelector('[data-k=time]'), playBtn = bar.querySelector('[data-k=play]');
      const scWrap = bar.querySelector('[data-k=sc]');
      scenes.forEach((s) => { const b = document.createElement('button'); b.textContent = s.label || s.id; b.onclick = () => go(s.start); scWrap.appendChild(b); });
      const bt = opt.beats ? M.beats(opt.beats.bpm, opt.beats.offset || 0) : null;
      let playing = false, loopScene = null, t0 = 0, wall0 = 0;
      const show = () => {
        const sc = scenes.find((s) => current >= s.start && current < s.end);
        timeEl.textContent = `${current.toFixed(3)}s · 帧 ${Math.round(current * fps)}${bt ? ' · 拍 ' + bt.index(current).toFixed(2) : ''}${sc ? ' · ' + (sc.label || sc.id) : ''}${loopScene ? ' · 循环中' : ''}`;
        range.value = current;
      };
      const go = async (t) => { await window.seek(M.clamp(t, 0, duration)); show(); };
      range.oninput = () => go(+range.value);
      const tick = async () => {
        if (!playing) return;
        let t = t0 + (performance.now() - wall0) / 1000;
        if (loopScene) { if (t > loopScene.end) { t0 = loopScene.start; wall0 = performance.now(); t = t0; } }
        else if (t > duration) { t0 = 0; wall0 = performance.now(); t = 0; }
        await go(t); requestAnimationFrame(tick); // 仅预览器用 rAF 推进时间；画面仍由 seek(t) 决定
      };
      const toggle = () => { playing = !playing; playBtn.textContent = playing ? '❚❚ 暂停 [空格]' : '▶︎ 播放 [空格]'; if (playing) { t0 = current; wall0 = performance.now(); tick(); } };
      playBtn.onclick = toggle;
      addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); toggle(); }
        if (e.code === 'ArrowRight') go(current + (e.shiftKey ? 1 : 1 / fps));
        if (e.code === 'ArrowLeft') go(current - (e.shiftKey ? 1 : 1 / fps));
        if (e.code === 'KeyL') { loopScene = loopScene ? null : scenes.find((s) => current >= s.start && current < s.end) || null; show(); }
      });
      show();
    }
  };

  window.M = M;
})();
