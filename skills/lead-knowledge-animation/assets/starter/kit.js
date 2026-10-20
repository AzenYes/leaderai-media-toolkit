/* kit.js — 丰富度工具包（依赖 motion.js）
 * 解决“画面太简单”：分层画布、按时间编排的环境系统（雾/星云/星空/微尘/光斑/网格）、发光精灵、
 * 镜头光斑、闪白/震屏、HUD 框架、逐字动效文字、底部逐字字幕、数字读数、引线标注、精细原语。
 * 所有东西仍是 t 的纯函数；随机数一律来自种子。
 *
 * 用法（index.html 里，motion.js 之后）：
 *   const K = Kit({ W, H, palette: { bg:'#05080c', ink:'#eef2f5', accent:'#5be7ff', accent2:'#ffb547' }, font:'Plex', seed: 7 });
 *   K.amb.keys([[0,{haze:0,stars:0}],[2,{haze:.5,stars:.8,dust:.5,bokeh:.3}], ...]);   // 环境随时间
 *   K.hud.chapters([[3,'01','时间会弯曲','TIME BENDS'], ...]);  K.hud.corner(t => `FRAME ${...}`);
 *   K.caption.lines(TIMING.lines);                              // 底部字幕（timeline.py 生成的 timing.js）
 *   K.text(parent, '你头顶的时间|比脚下走得[更快]', { x, y, size:76 })  →  在 render 里 el.reveal(t, t0) / el.hide(t, t1)
 *   render(t){ K.begin(t); ...你的场景（画到 K.ctx 或 DOM）...; K.end(t); }
 */
(function () {
  'use strict';
  const { clamp, lerp, prog, ease: E, rng, hash, fbm, TAU } = M;

  function Kit(o) {
    const W = o.W, H = o.H, P = Object.assign({ bg: '#05080c', ink: '#eef2f5', sub: '#8a98a6', accent: '#5be7ff', accent2: '#ffb547' }, o.palette || {});
    const FONT = o.font || 'Plex';
    const stage = o.stage || document.getElementById('stage');
    const K = { W, H, P, FONT };
    const rgb = (c) => (typeof c === 'string' ? M.hex(c) : c);
    K.rgba = (c, a = 1) => M.rgba(rgb(c), a);
    K.A = (a) => K.rgba(P.accent, a);   // 强调色透明度
    K.I = (a) => K.rgba(P.ink, a);      // 墨色透明度

    // ───────────── 分层：bg(氛围) → bg2(星点/网格) → world(DOM 主体) → main(canvas 主体) → fg(光斑/尘) → hud → caption → grain/vignette
    stage.style.background = P.bg;
    const layer = (cls, z) => { const c = M.canvas(stage, W, H); c.el.style.zIndex = z; c.el.dataset.layer = cls; return c; };
    const L = { bg: layer('bg', 1), bg2: layer('bg2', 2) };
    K.world = document.getElementById('world') || (() => { const d = document.createElement('div'); d.id = 'world'; stage.appendChild(d); return d; })();
    Object.assign(K.world.style, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', zIndex: 5, transformOrigin: '0 0' });
    L.main = layer('main', 4); L.fg = layer('fg', 6);
    const BLOOM = o.bloom ?? .9;   // 0 关闭；.6–1.2 常用
    const bl = document.createElement('canvas'); bl.width = Math.round(W / 4); bl.height = Math.round(H / 4); const blx = bl.getContext('2d', { willReadFrequently: true });
    const btc = document.createElement('canvas'); btc.width = bl.width; btc.height = bl.height; const bt = btc.getContext('2d', { willReadFrequently: true });
    L.bloom = M.canvas(stage, W, H, .5); L.bloom.el.style.zIndex = 4; L.bloom.el.style.mixBlendMode = 'screen'; L.bloom.el.style.pointerEvents = 'none';
    L.fg.el.style.mixBlendMode = 'screen';
    K.ctx = L.main.ctx; K.bg = L.bg.ctx; K.bg2 = L.bg2.ctx; K.fg = L.fg.ctx; K.layers = L;
    const mk = (z, css) => { const d = document.createElement('div'); Object.assign(d.style, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none', zIndex: z }, css); stage.appendChild(d); return d; };
    K.hudEl = mk(8, {}); K.capEl = mk(9, {});
    const flashEl = mk(10, { background: o.flashColor || '#ffffff', opacity: 0, mixBlendMode: 'screen' });
    const vig = mk(11, { background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,${o.vignette ?? 0.55}) 100%)` });
    const grain = M.canvas(stage, W, H, 0.5); grain.el.style.zIndex = 12; grain.el.style.mixBlendMode = 'overlay'; grain.el.style.opacity = o.grain ?? 0.22;

    // ───────────── 发光精灵（替代 shadowBlur：快、柔、可叠加）
    function sprite(r, stops) { const c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d', { willReadFrequently: true }); const g = x.createRadialGradient(r, r, 0, r, r, r); stops.forEach(([s, col]) => g.addColorStop(s, col)); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; }
    const a1 = rgb(P.accent).join(','), w1 = rgb(P.ink).join(','), a2 = rgb(P.accent2).join(',');
    K.SPR = {
      glow: sprite(64, [[0, `rgba(255,255,255,1)`], [.12, `rgba(${a1},.8)`], [.35, `rgba(${a1},.22)`], [1, `rgba(${a1},0)`]]),
      soft: sprite(64, [[0, `rgba(${a1},.5)`], [.5, `rgba(${a1},.12)`], [1, `rgba(${a1},0)`]]),
      white: sprite(64, [[0, 'rgba(255,255,255,1)'], [.15, `rgba(${w1},.6)`], [.4, `rgba(${w1},.12)`], [1, `rgba(${w1},0)`]]),
      warm: sprite(64, [[0, 'rgba(255,255,255,1)'], [.14, `rgba(${a2},.8)`], [.4, `rgba(${a2},.2)`], [1, `rgba(${a2},0)`]]),
      bokeh: sprite(64, [[0, `rgba(${a1},.5)`], [.72, `rgba(${a1},.38)`], [.86, `rgba(${a1},.6)`], [.93, `rgba(${a1},.15)`], [1, `rgba(${a1},0)`]]),
    };
    /** 画一个发光点：K.spr(ctx,'glow',x,y,r,a) */
    // 所有原语都乘上调用时 ctx 的 globalAlpha（场景整体淡入淡出时，光点也跟着淡）
    K.spr = (c, s, x, y, r, a = 1) => { const ga = c.globalAlpha; if (a * ga <= .002 || r <= .1) return; c.globalAlpha = a * ga; c.drawImage(K.SPR[s], x - r, y - r, r * 2, r * 2); c.globalAlpha = ga; };
    /** 光晕：径向渐变 */
    K.halo = (c, x, y, r, a = .3, col = P.accent) => { if (a <= .002 || r <= 1) return; const k = rgb(col).join(','); const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${k},${a})`); g.addColorStop(.4, `rgba(${k},${a * .35})`); g.addColorStop(1, `rgba(${k},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };

    // ───────────── 程序化纹理（加载时一次性生成，之后只平移/缩放）
    function noiseTex(w, h, fn) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); const img = x.createImageData(w, h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const [r, g, b, a] = fn(i / w, j / h); const k = (j * w + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = a; }
      x.putImageData(img, 0, 0); return c;
    }
    const seed = o.seed || 7;
    const ac = rgb(P.accent), a2c = rgb(P.accent2);
    // 雾/星云：domain-warp fbm，低分辨率生成后放大（天然柔）
    K.TEX = {
      haze: noiseTex(320, 180, (u, v) => {
        const q = fbm(u * 3, v * 3, 4, seed), r = fbm(u * 3 + 2 * q + 1.7, v * 3 + 2 * q + 9.2, 5, seed + 3);
        const d = clamp(0.45 + 0.9 * r); const m = Math.pow(d, 2.6) * 0.75;
        return [ac[0] * m * .55, ac[1] * m * .7, ac[2] * m * .8, 255 * clamp(m)];
      }),
      wisp: noiseTex(320, 180, (u, v) => {
        const r = fbm(u * 6 + fbm(u * 2, v * 2, 3, seed + 5) * 2, v * 6, 5, seed + 9);
        const m = Math.pow(clamp(0.5 + r), 7) * 0.7;
        return [lerp(ac[0], 255, .5) * m, lerp(ac[1], 255, .5) * m, lerp(ac[2], 255, .5) * m, 255 * clamp(m)];
      }),
      warm: noiseTex(320, 180, (u, v) => {
        const r = fbm(u * 2.5 + 4, v * 2.5 + fbm(u * 3, v * 3, 3, seed + 11), 5, seed + 13);
        const m = Math.pow(clamp(0.45 + r), 3);
        return [a2c[0] * m, a2c[1] * m, a2c[2] * m, 255 * clamp(m)];
      }),
    };
    K.texture = noiseTex;

    // ───────────── 环境系统：一组参数随时间平滑插值（每个段落都在“同一个世界”里换气氛）
    // 参数：haze 雾/星云  wisp 丝状亮雾  warm 暖色雾  stars 星点  dust 前景微尘  bokeh 虚焦光斑  grid 蓝图网格  warp 跃迁拉丝  cam 镜头漂移幅度
    const R = rng(seed + 101);
    const STARS = [0, 1, 2].map((l) => Array.from({ length: [900, 260, 60][l] }, () => ({ x: R() * (W + 280) - 140, y: R() * (H + 220) - 110, s: R(), w: 1 + R() * 3, p: R() * TAU })));
    const DUST = Array.from({ length: 140 }, () => ({ x: R() * W, y: R() * H, s: R(), p: R() * TAU, v: .3 + R() }));
    const BOK = Array.from({ length: 16 }, () => ({ x: R() * W, y: R() * H, r: 18 + R() * 70, p: R() * TAU, a: .4 + R() * .6 }));
    let AMBK = [[0, {}]];
    const DEF = { haze: 0, wisp: 0, warm: 0, stars: 0, dust: 0, bokeh: 0, grid: 0, gridLabels: 0, warp: 0, cam: 1 };
    const amb = { keys(k) { AMBK = k.map(([t, v]) => [t, Object.assign({}, DEF, v)]); }, now: Object.assign({}, DEF) };
    K.amb = amb;
    function ambAt(t) {
      let i = 0; while (i < AMBK.length - 2 && AMBK[i + 1][0] <= t) i++;
      const [t0, a] = AMBK[i], [t1, b] = AMBK[Math.min(i + 1, AMBK.length - 1)];
      const k = t1 === t0 ? 1 : E.inOutSine(clamp((t - t0) / (t1 - t0)));
      for (const key in DEF) amb.now[key] = lerp(a[key] ?? DEF[key], b[key] ?? DEF[key], k);
      return amb.now;
    }
    // 镜头：连续的慢漂 + 呼吸推拉（世界里所有层按视差跟随）
    K.cam = { x: 0, y: 0, s: 1, extraX: 0, extraY: 0, extraS: 1 };
    const SHK = { x: 0, y: 0 };
    let shakes = [], flashes = [], flares = [];
    /** 震屏：K.shake(t0, 幅度px, 时长) */
    K.shake = (t0, amp = 10, dur = .25) => shakes.push([t0, amp, dur]);
    /** 闪白：K.flash(t0, 峰值, 时长) */
    K.flash = (t0, peak = .25, dur = .45) => flashes.push([t0, peak, dur]);
    /** 镜头光斑：K.flare(t0, x, y, 峰值, 时长)，x 可为函数 t=>[x,y] */
    K.flare = (t0, x, y, peak = 1, dur = 1.6) => flares.push([t0, x, y, peak, dur]);

    /** 镜头关键帧：K.camKeys([[t, zoom, worldX, worldY, ease], ...])——把世界坐标 (worldX,worldY) 放到画面中心，缩放走对数插值。
     *  作用于 K.world（DOM）与 K.ctx（主画布）；背景层只做轻微视差。不设时镜头只做慢漂呼吸。
     *  “景别变化”就靠它：同一个场景里 全景 → 中景 → 特写 → 拉回，不用换场也能每句都有新画面。 */
    let CAMK = null;
    K.camKeys = (keys) => { CAMK = keys; };
    K.camAt = (t) => {
      if (!CAMK) return { z: 1, x: W / 2, y: H / 2 };
      const z = M.kfZoom(t, CAMK.map(([tt, zz, , , e]) => [tt, zz, e]));
      const x = M.kf(t, CAMK.map(([tt, , xx, , e]) => [tt, xx, e])), y = M.kf(t, CAMK.map(([tt, , , yy, e]) => [tt, yy, e]));
      return { z, x, y };
    };
    /** 世界坐标 → 屏幕坐标（做安全框检查、把标注贴到画布物体上时用） */
    K.toScreen = (t, wx, wy) => { const c = K.camAt(t); return [(wx - c.x) * c.z + W / 2, (wy - c.y) * c.z + H / 2]; };
    function drawAmbient(t) {
      const A = ambAt(t), C = K.cam;
      C.x = A.cam * (16 * Math.sin(t * .061) + 7 * Math.sin(t * .17 + 1.3)) + C.extraX;
      C.y = A.cam * (10 * Math.sin(t * .047 + .7) + 4 * Math.sin(t * .13)) + C.extraY;
      C.s = (1.018 + .014 * A.cam * Math.sin(t * TAU / 47)) * C.extraS;
      SHK.x = SHK.y = 0;
      for (const [t0, amp, dur] of shakes) { const d = t - t0; if (d >= 0 && d < dur) { const k = 1 - d / dur; const n = Math.floor(d * 30); SHK.x += (n % 2 ? -1 : 1) * amp * k; SHK.y += (((n * 5) % 3) - 1) * amp * .5 * k; } }
      const CK = K.camAt(t), z = CK.z * C.s;
      K.world.style.transformOrigin = '0 0';
      K.world.style.transform = `translate(${W / 2 + C.x * .5 + SHK.x}px,${H / 2 + C.y * .5 + SHK.y}px) scale(${z}) translate(${-CK.x}px,${-CK.y}px)`;
      L.main.el.style.transformOrigin = '0 0';
      L.main.el.style.transform = K.world.style.transform;
      C.zoom = CK.z;
      // 背景氛围
      const b = K.bg;
      const neb = (img, a, par, sx, sy, sc, comp) => {
        if (a <= .003) return;
        b.globalAlpha = a; b.globalCompositeOperation = comp || 'source-over';
        const w = W * 1.25 * sc, h = H * 1.25 * sc;
        b.drawImage(img, (W - w) / 2 + Math.sin(t * sx) * (w - W) * .45 + C.x * par, (H - h) / 2 + Math.cos(t * sy) * (h - H) * .45 + C.y * par, w, h);
      };
      neb(K.TEX.haze, A.haze, .2, .011, .008, 1.0, 'lighter');
      neb(K.TEX.warm, A.warm, .25, .009, .012, 1.05, 'lighter');
      neb(K.TEX.wisp, A.wisp, .35, .014, .011, 1.1, 'lighter');
      b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
      // 网格
      const g = K.bg2;
      if (A.grid > .01) {
        const ox = (C.x * .4) % 40, oy = (C.y * .4) % 40;
        g.lineWidth = 1; g.strokeStyle = K.I(.03 * A.grid); g.beginPath();
        for (let x = -40 + ox; x < W + 40; x += 40) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = -40 + oy; y < H + 40; y += 40) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
        g.strokeStyle = K.I(.07 * A.grid); g.beginPath();
        for (let x = -40 + ox; x < W + 40; x += 200) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = -40 + oy; y < H + 40; y += 200) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
        g.strokeStyle = K.A(.25 * A.grid); g.beginPath();
        for (let x = -40 + ox; x < W + 40; x += 200) for (let y = -40 + oy; y < H + 40; y += 200) { g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); }
        g.stroke();
        if (A.gridLabels > .5) { g.fillStyle = K.I(.22 * A.grid); g.font = `300 12px "${FONT}"`; }
        if (A.gridLabels > .5) for (let x = -40 + ox, i = 0; x < W + 40; x += 200, i++) g.fillText(String(i * 200).padStart(4, '0'), x + 4, 24);
      }
      // 星点：三层视差 + 闪烁；warp 时拉成放射线
      if (A.stars > .01) STARS.forEach((Ls, l) => {
        const par = [.15, .45, .9][l], base = [.45, .7, 1][l] * A.stars;
        for (const s of Ls) {
          const x = s.x + C.x * par * 2, y = s.y + C.y * par * 2;
          const al = base * (.25 + .75 * s.s) * (.55 + .45 * Math.sin(t * s.w + s.p));
          if (A.warp > .02) { const dx = x - W / 2, dy = y - H / 2, k = (.05 + A.warp * .5) * (.4 + par); g.strokeStyle = l === 2 ? K.A(al) : K.I(al); g.lineWidth = .6 + l * .5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - dx * k, y - dy * k); g.stroke(); continue; }
          if (l === 2) { K.spr(g, s.s > .7 ? 'glow' : 'white', x, y, 4 + s.s * 9, al * .9); if (s.s > .93) { g.globalAlpha = al * .5; g.strokeStyle = K.I(.8); g.lineWidth = .8; const kk = 16 + 22 * s.s; g.beginPath(); g.moveTo(x - kk, y); g.lineTo(x + kk, y); g.moveTo(x, y - kk); g.lineTo(x, y + kk); g.stroke(); g.globalAlpha = 1; } }
          else { g.globalAlpha = al; g.fillStyle = l ? P.ink : K.rgba(P.accent, 1); g.fillRect(x - .5, y - .5, 1 + l * .6, 1 + l * .6); }
        }
        g.globalAlpha = 1;
      });
      // 前景：微尘 + 虚焦光斑
      const f = K.fg;
      if (A.dust > .01) for (const d of DUST) {
        const x = ((d.x + Math.sin(t * .2 * d.v + d.p) * 40 + t * 6 * d.v + C.x * 1.6) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = ((d.y + Math.cos(t * .17 * d.v + d.p) * 30 - t * 3 * d.v + C.y * 1.6) % (H + 40) + H + 40) % (H + 40) - 20;
        f.globalAlpha = A.dust * (.12 + .4 * d.s) * (.5 + .5 * Math.sin(t * 1.3 * d.v + d.p)); f.fillStyle = d.s > .8 ? P.accent : P.ink;
        f.beginPath(); f.arc(x, y, .6 + d.s * 1.3, 0, TAU); f.fill();
      }
      if (A.bokeh > .01) for (const k of BOK) {
        const x = ((k.x + t * 9 + Math.sin(t * .1 + k.p) * 60 + C.x * 2.6) % (W + 200) + W + 200) % (W + 200) - 100;
        K.spr(f, 'bokeh', x, k.y + Math.cos(t * .08 + k.p) * 40 + C.y * 2.6, k.r, A.bokeh * .085 * k.a * (.6 + .4 * Math.sin(t * .4 + k.p)));
      }
      f.globalAlpha = 1;
    }
    function drawFlare(x, y, k, w = 1400) {
      if (k <= .002) return; const c = K.fg; c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(x - w * k, 0, x + w * k, 0); g.addColorStop(0, K.A(0)); g.addColorStop(.5, K.I(.55 * k)); g.addColorStop(1, K.A(0));
      c.fillStyle = g; c.fillRect(x - w * k, y - 1.5, 2 * w * k, 3);
      const g2 = c.createLinearGradient(x - w * .6 * k, 0, x + w * .6 * k, 0); g2.addColorStop(0, K.A(0)); g2.addColorStop(.5, K.A(.16 * k)); g2.addColorStop(1, K.A(0));
      c.fillStyle = g2; c.fillRect(x - w * .6 * k, y - 14, 1.2 * w * k, 28);
      K.spr(c, 'white', x, y, 90 * k, .9 * k); K.spr(c, 'soft', x, y, 320 * k, .5 * k);
      [-.35, .4, .75, 1.25].forEach((fr, i) => K.spr(c, 'bokeh', x + (W / 2 - x) * (1 + fr), y + (H / 2 - y) * (1 + fr), [26, 60, 18, 90][i] * (.6 + .4 * k), .12 * k));
      c.restore();
    }

    // ───────────── HUD：章节号 + 中英标题、右上读数、底部进度与时间码（“框架感”，低对比，不抢主体）
    const hud = { ch: [], cornerFn: null, show: true, timecode: false, total: o.duration || 60 };
    K.hud = hud;
    hud.chapters = (list) => { hud.ch = list; };
    hud.corner = (fn) => { hud.cornerFn = fn; };
    const hudCss = `position:absolute;font:500 18px/1.6 '${FONT}',sans-serif;letter-spacing:.22em;color:${K.I(.5)};white-space:nowrap`;
    K.hudEl.innerHTML = `<div data-h="tl" style="${hudCss};left:${56 * W / 1920}px;top:${40 * H / 1080}px"></div>
      <div data-h="tr" style="${hudCss};right:${56 * W / 1920}px;top:${40 * H / 1080}px;text-align:right;font-size:14px;color:${K.I(.4)}"></div>
      <div data-h="bl" style="${hudCss};left:${56 * W / 1920}px;bottom:${34 * H / 1080}px;font-size:11px;color:${K.I(.3)}"></div>
      <div data-h="br" style="${hudCss};right:${56 * W / 1920}px;bottom:${34 * H / 1080}px;font-size:11px;color:${K.I(.3)}"></div>
      <div data-h="bar" style="position:absolute;left:${56 * W / 1920}px;right:${56 * W / 1920}px;bottom:${58 * H / 1080}px;height:1px;background:${K.I(.08)}"><div style="height:1px;width:0;background:${K.A(.7)}"></div></div>`;
    const hq = (k) => K.hudEl.querySelector(`[data-h=${k}]`);
    function drawHud(t) {
      K.hudEl.style.opacity = hud.show ? clamp(prog(t, .6, 1.4) * (1 - prog(t, hud.total - 1.6, hud.total - .8))) : 0;
      let c = null; for (const ch of hud.ch) if (t >= ch[0]) c = ch;
      const tl = hq('tl');
      if (c) {
        const k = E.outCubic(prog(t, c[0], c[0] + .8));
        tl.innerHTML = `<span style="color:${K.A(.9)}">${c[1]}</span><span style="display:inline-block;width:46px;height:1px;background:${K.I(.3)};vertical-align:middle;margin:0 14px"></span><span style="color:${K.I(.75)};letter-spacing:.12em">${c[2]}</span><span style="margin-left:14px;color:${K.I(.4)};font-size:14px">${c[3] || ''}</span>`;
        tl.style.opacity = k; tl.style.transform = `translateX(${(1 - k) * -24}px)`;
      } else tl.style.opacity = 0;
      hq('tr').innerHTML = hud.cornerFn ? hud.cornerFn(t) : '';
      const s = Math.floor(t), fr = Math.floor(t * 60) % 60, tot = hud.total;
      for (const k of ['bl', 'br', 'bar']) hq(k).style.display = hud.timecode ? '' : 'none';
      hq('br').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')} / ${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(Math.floor(tot % 60)).padStart(2, '0')}`;
      hq('bl').textContent = `T + ${t.toFixed(3)} s`;
      hq('bar').firstElementChild.style.width = (t / tot * 100) + '%';
    }

    // ───────────── 文字：逐字（模糊 + 上浮）入场 / 中心放大砸入 / 擦除；[高亮] {加粗} | 换行
    const style = document.createElement('style');
    style.textContent = `.kt{position:absolute;white-space:nowrap;font-family:"${FONT}",sans-serif;color:${P.ink};will-change:auto}
      .kt .ch{display:inline-block;white-space:pre}.kt .hl{color:${P.accent};font-weight:700;text-shadow:0 0 18px ${K.A(.55)},0 0 2px ${K.A(.9)}}.kt .b{font-weight:700}
      .kt .sm{font-size:.42em;letter-spacing:.3em;color:${K.I(.45)};font-weight:500}`;
    document.head.appendChild(style);
    /**
     * K.text(parent, '你头顶的时间|比脚下走得[更快]', { x, y, size, w:300, align:'l'|'c'|'r', ls:'.04em', lh:1.25, color })
     * 返回 el；在 render(t) 里调用 el.reveal(t, t0, {mode:'rise'|'center'|'wipe'|'type', dur, stagger}) 和 el.hide(t, t1, {dur})
     */
    K.text = (parent, str, opt = {}) => {
      const e = document.createElement('div'); e.className = 'kt';
      Object.assign(e.style, { fontSize: (opt.size || 48) + 'px', fontWeight: opt.w || 300, letterSpacing: opt.ls || '.04em', lineHeight: opt.lh || 1.25, top: opt.y + 'px', color: opt.color || '' });
      if (opt.align === 'c') Object.assign(e.style, { left: (opt.x ?? 0) + 'px', width: (opt.width || W) + 'px', textAlign: 'center' });
      else if (opt.align === 'r') Object.assign(e.style, { right: (W - opt.x) + 'px', textAlign: 'right' });
      else e.style.left = opt.x + 'px';
      let hl = false, bd = false, sm = false;
      const chs = [];
      let hlc = null; const chars = [...str];
      for (let ci = 0; ci < chars.length; ci++) { const c = chars[ci];
        if (c === '[') { hl = true; const j = chars.indexOf(']', ci); const seg = chars.slice(ci + 1, j).join(''); const m = seg.match(/#([0-9a-fA-F]{6})$/); hlc = m ? '#' + m[1] : null; if (m) { chars.splice(j - 7, 7); } continue; } if (c === ']') { hl = false; hlc = null; continue; }
        if (c === '{') { bd = true; continue; } if (c === '}') { bd = false; continue; }
        if (c === '<') { sm = true; continue; } if (c === '>') { sm = false; continue; }
        if (c === '|') { e.appendChild(document.createElement('br')); continue; }
        const s = document.createElement('span'); s.className = 'ch' + (hl ? ' hl b' : '') + (bd ? ' b' : '') + (sm ? ' sm' : ''); s.textContent = c; if (hl && hlc) { s.style.color = hlc; s.style.textShadow = `0 0 18px ${K.rgba(hlc, .55)},0 0 2px ${K.rgba(hlc, .9)}`; } e.appendChild(s); chs.push(s);
      }
      (parent || K.world).appendChild(e);
      e._ch = chs;
      let rv = null, hd = null;
      e.reveal = (t, t0, ro = {}) => { rv = [t0, ro]; e._apply(t); return e; };
      e.hide = (t, t1, ho = {}) => { hd = [t1, ho]; e._apply(t); return e; };
      e._apply = (t) => {
        const n = chs.length;
        let anyVis = false;
        chs.forEach((s, i) => {
          let op = 1, y = 0, bl = 0, sc = 1;
          if (rv) {
            const [t0, ro] = rv, mode = ro.mode || 'rise', dur = ro.dur ?? .8, st = ro.stagger ?? (mode === 'type' ? .045 : .035);
            const order = mode === 'center' ? Math.abs(i - (n - 1) / 2) : i;
            const p = prog(t, t0 + order * st, t0 + order * st + dur), k = E.outExpo(p);
            if (mode === 'rise') { op = clamp(p * 2); y = (1 - k) * (ro.y ?? 36); bl = (1 - k) * (ro.blur ?? 10); }
            if (mode === 'center') { op = clamp(p * 2); sc = lerp(ro.from ?? 1.6, 1, k); bl = (1 - k) * 14; }
            if (mode === 'type') { op = p > 0 ? 1 : 0; }
            if (mode === 'ink') { op = clamp(p * 1.6); bl = (1 - E.outCubic(p)) * (ro.blur ?? 6); y = (1 - E.outCubic(p)) * (ro.y ?? 4); }
            if (mode === 'wipe') { op = clamp(p * 3); }
          }
          if (hd) {
            const [t1, ho] = hd, dur = ho.dur ?? .4, st = ho.stagger ?? 0;
            const p = prog(t, t1 + i * st, t1 + i * st + dur), k = E.inCubic(p);
            op *= 1 - p; y += -k * (ho.y ?? 30); bl += k * (ho.blur ?? 8);
          }
          s.style.opacity = op; s.style.transform = (y || sc !== 1) ? `translateY(${y}px) scale(${sc})` : '';
          s.style.filter = bl > .05 ? `blur(${bl}px)` : '';
          if (op > 0) anyVis = true;
        });
        e.style.visibility = anyVis ? 'visible' : 'hidden';
      };
      return e;
    };
    /** 砸入（整块）：K.slam(el, t, t0, {from:1.6, dur:.6}) */
    K.slam = (el, t, t0, so = {}) => { const p = prog(t, t0, t0 + (so.dur ?? .6)), k = E.outExpo(p); el.style.opacity = clamp(p * 2.5); el.style.transform = `scale(${lerp(so.from ?? 1.6, 1, k)})`; el.style.filter = k < .99 ? `blur(${(1 - k) * 18}px)` : ''; };

    // ───────────── 底部字幕（与 timeline.py 生成的 timing 同步）：底部居中，一次一句，[高亮]
    // 做法：底部单行字幕，逐字带模糊显现（约 16 字/秒），关键词用强调色；片名卡/章节卡不进字幕带
    // 字幕字体按内容选：IBM Plex Sans SC（'sans' → Plex，正文 500 / 强调 700）或 思源宋体（'serif' → HanSerif，正文 600 / 强调 900）
    //   全片：lines.json 顶层 "font" 或 K.caption.set(lines, {font})；单句：该句 "font"。强调另加角色色；单行显示，超宽自动缩小（不换行、不出屏）
    //   句末不带标点（timeline.py 会自动去掉）
    // 开头金句（lines.json 里 "hook": true）：不进字幕带，画面中下部大字砸出，前 5 秒内完成
    const cap = { lines: [], hooks: [], y: H - 132 * H / 1080, size: 52 * Math.min(W, H) / 1080, el: [], hel: [], font: null,
      fonts: { sans: 'Plex', serif: 'HanSerif' }, weights: { Plex: [500, 700], HanSerif: [600, 900] }, cps: 16, colors: null, shade: .55,
      maxW: W * .86, hookSize: 104 * Math.min(W, H) / 1080, hookY: H * .64, hookMaxW: W * .9, hookCps: 22 };
    K.caption = cap;
    cap.set = (lines, co = {}) => {
      cap.lines = lines.filter((l) => l.cap !== false && !l.card && !l.hook); cap.hooks = lines.filter((l) => l.hook); Object.assign(cap, co);
      K.capEl.innerHTML = '';
      if (cap.shade > 0) { const sh = document.createElement('div'); Object.assign(sh.style, { position: 'absolute', left: 0, right: 0, bottom: 0, height: (H - cap.y + 90) + 'px', background: `linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,${cap.shade}))` }); K.capEl.appendChild(sh); }
      // cap.colors：{词: 颜色}，字幕里 [词] 高亮时按“角色色”着色（颜色 = 概念，全片一致）
      const paint = (txt) => cap.colors ? txt.replace(/\[([^\]#]+)\]/g, (m, w) => cap.colors[w] ? `[${w}${cap.colors[w]}]` : m) : txt;
      // 字体：单句 font > 全片 cap.font > Kit 的 font；'sans' / 'serif' 是别名，也可以直接写字族名
      const face = (e, l) => { const f = l.font || cap.font || FONT, fam = cap.fonts[f] || f, [w0, w1] = cap.weights[fam] || [500, 700];
        e.style.fontFamily = `"${fam}"`; e.style.fontWeight = w0; for (const ch of e._ch) if (ch.classList.contains('b')) ch.style.fontWeight = w1; e._fam = fam; e._w = [w0, w1]; return e; };
      cap.el = cap.lines.map((l) => { const e = face(K.text(K.capEl, paint(typeof l.cap === 'string' ? l.cap : l.text), { x: 0, y: cap.y, size: cap.size, align: 'c', ls: '.06em' }), l); e.style.textShadow = '0 2px 12px rgba(0,0,0,.7)'; return e; });
      cap.hel = cap.hooks.map((l) => { const e = face(K.text(K.capEl, paint(l.text), { x: 0, y: cap.hookY, size: cap.hookSize, align: 'c', ls: '.04em', lh: 1.15 }), l); e.style.textShadow = '0 4px 30px rgba(0,0,0,.75)'; e._hook = true; return e; });
    };
    // 单行适配：首次绘制时（字体已加载）量出真实宽度，超过上限就按比例缩小字号
    const fitCtx = document.createElement('canvas').getContext('2d');
    const fit = (e, size, maxW) => {
      if (e._fit) return; e._fit = true;
      let w = 0; for (const ch of e._ch) { fitCtx.font = `${e._w[ch.classList.contains('b') ? 1 : 0]} ${size}px "${e._fam}"`; w += fitCtx.measureText(ch.textContent).width + size * (e._hook ? .04 : .06); }
      if (w > maxW) { e.style.fontSize = (size * maxW / w).toFixed(2) + 'px'; console.warn(`字幕过长已缩小到 ${(size * maxW / w).toFixed(0)}px：${e.textContent}（建议拆句，≤20 字）`); }
    };
    function drawCaption(t) {
      cap.hooks.forEach((l, i) => {
        const e = cap.hel[i]; fit(e, cap.hookSize, cap.hookMaxW);
        const end = Math.min(l.end, (cap.hooks[i + 1]?.start ?? 1e9) - .2, (cap.lines[0]?.start ?? 1e9) - .2);
        if (t < l.start - .3 || t > end + .6) { e.style.visibility = 'hidden'; return; }
        e.reveal(t, l.start, { mode: 'rise', dur: .5, stagger: 1 / (cap.hookCps || 22), blur: 12, y: 26 }); e.hide(t, end, { dur: .3, stagger: 0, y: -16, blur: 8 });
      });
      cap.lines.forEach((l, i) => {
        const e = cap.el[i]; fit(e, cap.size, cap.maxW); const end = Math.min(l.end, (cap.lines[i + 1]?.start ?? 1e9) - .26);
        if (t < l.start - .3 || t > end + .5) { e.style.visibility = 'hidden'; return; }
        e.reveal(t, l.start, { mode: 'ink', dur: .3, stagger: 1 / (cap.cps || 16), blur: 6, y: 3 }); e.hide(t, end, { dur: .22, stagger: 0, y: 0, blur: 4 });
      });
    }

    // ───────────── 读数 / 标注 / 精细原语（画在 ctx 上）
    /** 数字读数：K.num(t, t0, t1, from, to, fmt, ease) → 字符串 */
    // 数字读数自动用帧中心时刻 M.frameT：--blur 子帧渲染时数字不会叠出重影
    K.num = (t, t0, t1, a, b, fmt = (v) => Math.round(v).toLocaleString('en-US'), ez = E.outExpo) => { const tt = Math.abs((M.frameT ?? t) - t) < .05 ? M.frameT : t; return fmt(lerp(a, b, ez(prog(tt, t0, t1)))); };
    /** 引线标注：从点 (x,y) 拉出折线到文字。p=0..1 生长进度 */
    K.callout = (c, x, y, dx, dy, label, p = 1, o2 = {}) => {
      if (p <= 0) return; const k = E.outCubic(p);
      const ex = x + dx * Math.min(1, k * 2), ey = y + dy * Math.min(1, k * 2), lx = ex + (o2.len ?? 120) * Math.sign(dx || 1) * clamp(k * 2 - 1);
      c.save(); c.strokeStyle = o2.color || K.I(.55); c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.lineTo(lx, ey); c.stroke();
      c.fillStyle = o2.color || K.I(.75); c.beginPath(); c.arc(x, y, 2.5, 0, TAU); c.fill();
      if (k > .5) { c.globalAlpha *= clamp((k - .5) * 3); c.font = `${o2.w || 500} ${Math.max(17, o2.size || 18)}px "${FONT}"`; c.letterSpacing = '2px'; c.textAlign = dx < 0 ? 'right' : 'left'; c.fillText(label, dx < 0 ? lx - 6 : lx + 6, ey - 8); if (o2.sub) { c.font = `300 ${Math.max(15, (o2.size || 18) - 3)}px "${FONT}"`; c.fillStyle = K.I(.4); c.fillText(o2.sub, dx < 0 ? lx - 6 : lx + 6, ey + 18); } }
      c.restore();
    };
    // ───────────── 纪实叙事类原语：体积光、粒子成形、发光线描人形、巨字虚影、发光标题
    /** 体积光（舞台聚光灯）：从 (x,y) 向 angle 方向打出锥形光，width 为张角（弧度），len 长度 */
    K.spotlight = (c, x, y, angle = Math.PI / 2, width = .5, len = 900, a = .5, col = P.ink) => {
      if (a <= .002) return; const k = rgb(col).join(',');
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(angle - Math.PI / 2);
      const g = c.createLinearGradient(0, 0, 0, len); g.addColorStop(0, `rgba(${k},${a})`); g.addColorStop(.6, `rgba(${k},${a * .25})`); g.addColorStop(1, `rgba(${k},0)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.lineTo(Math.tan(width / 2) * len, len); c.lineTo(-Math.tan(width / 2) * len, len); c.closePath(); c.fill();
      const r3 = rng(Math.round(x * 7 + y)); for (let i = 0; i < 60; i++) { const yy = r3() * len, xx = (r3() * 2 - 1) * Math.tan(width / 2) * yy; c.fillStyle = `rgba(${k},${a * .6 * r3()})`; c.fillRect(xx, yy, 1.5, 1.5); }
      c.restore(); K.halo(c, x, y, 60, a * .8, col);
    };
    /** 把文字或图形采样成粒子目标点：K.sample('35', {font:'700 420px Plex', w:900, h:500, step:6}) 或 K.sample((x,w,h)=>{...画形状...}, {...}) */
    K.sample = (src, so = {}) => {
      const w = so.w || 900, h = so.h || 500, step = so.step || 6; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (typeof src === 'function') src(x, w, h); else { x.font = so.font || `700 ${h * .8}px "${FONT}"`; x.fillText(src, w / 2, h / 2); }
      const d = x.getImageData(0, 0, w, h).data, pts = [], r4 = rng(so.seed || 3);
      for (let j = 0; j < h; j += step) for (let i = 0; i < w; i += step) if (d[(j * w + i) * 4 + 3] > 128) pts.push({ x: i - w / 2 + (r4() - .5) * step * .6, y: j - h / 2 + (r4() - .5) * step * .6, r: r4(), s: r4() });
      return pts;
    };
    /** 粒子聚合/散开：pts 为 K.sample 的结果；p=0 散落 → p=1 成形。po: {spread, size, color:'accent'|'warm'|'white', stagger, a, t} */
    K.particles = (c, pts, cx, cy, p, po = {}) => {
      const spread = po.spread ?? 900, size = po.size ?? 2.2, col = po.color || 'accent';
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]; const delay = q.r * (po.stagger ?? .5); const k = E.inOutCubic(clamp((p - delay) / (1 - delay + 1e-6)));
        const ang = q.s * TAU * 3, far = spread * (.4 + q.r);
        const x = cx + lerp(q.x + Math.cos(ang) * far, q.x, k), y = cy + lerp(q.y + Math.sin(ang) * far * .6, q.y, k);
        const tw = .6 + .4 * Math.sin((po.t || 0) * 3 + q.s * 20);
        K.spr(c, col === 'accent' ? 'glow' : col === 'warm' ? 'warm' : 'white', x, y, size * 3, (po.a ?? 1) * tw * (.3 + .7 * k));
      }
    };
    /** 发光线描人形：pose = 'stand' | 'run' | 'win'（举臂）| 'sit' | 'fall'；phase 驱动跑步周期（0..1 循环）。fo: {color, a, core} */
    K.figure = (c, x, y, sc = 1, pose = 'stand', phase = 0, fo = {}) => {
      const col = fo.color || P.ink, a = fo.a ?? 1; if (a <= .002) return;
      const S = 46 * sc, sw = Math.sin(phase * TAU), cw = Math.cos(phase * TAU);
      const J = { hip: [0, -S * 1.9], neck: [0, -S * 3.3] };
      let lean = 0, armL, armR, legL, legR;
      if (pose === 'run') { lean = .3; armL = [[.15 - sw * .95, .9], [-1.75, .85]]; armR = [[.15 + sw * .95, .9], [-1.75, .85]]; legL = [[.1 + sw * .85, 1], [-(.35 + 1.5 * Math.max(0, cw)), 1]]; legR = [[.1 - sw * .85, 1], [-(.35 + 1.5 * Math.max(0, -cw)), 1]]; }
      else if (pose === 'walk') { lean = .06; armL = [[sw * .45, .9], [-.35, .9]]; armR = [[-sw * .45, .9], [-.35, .9]]; legL = [[sw * .45, 1], [-.12 - Math.max(0, -sw) * .5, 1]]; legR = [[-sw * .45, 1], [-.12 - Math.max(0, sw) * .5, 1]]; }
      else if (pose === 'down') { lean = .35; armL = [[.15, .9], [.05, .9]]; armR = [[-.05, .9], [.05, .9]]; legL = [[.08, 1], [0, 1]]; legR = [[-.08, 1], [0, 1]]; }
      else if (pose === 'win') { armL = [[Math.PI + .5, .9], [-.2, .9]]; armR = [[Math.PI - .5, .9], [.2, .9]]; legL = [[.18, 1], [-.04, 1]]; legR = [[-.18, 1], [.04, 1]]; }
      else if (pose === 'sit') { armL = [[.5, .9], [-.9, .9]]; armR = [[.4, .9], [-.9, .9]]; legL = [[1.5, 1], [-1.5, 1]]; legR = [[1.4, 1], [-1.5, 1]]; J.hip = [0, -S * 1.0]; J.neck = [0, -S * 2.4]; }
      else if (pose === 'fall') { lean = 1.1; armL = [[2.2, .9], [.4, .9]]; armR = [[-1.6, .9], [.4, .9]]; legL = [[.6, 1], [.2, 1]]; legR = [[-.3, 1], [.4, 1]]; }
      else { armL = [[.2, .9], [.06, .9]]; armR = [[-.2, .9], [-.06, .9]]; legL = [[.16, 1], [-.04, 1]]; legR = [[-.16, 1], [.04, 1]]; }
      const rot = (p, ang) => [p[0] * Math.cos(ang) - p[1] * Math.sin(ang), p[0] * Math.sin(ang) + p[1] * Math.cos(ang)];
      const neck = rot([J.neck[0] - J.hip[0], J.neck[1] - J.hip[1]], lean).map((v, i) => v + J.hip[i]);
      // 角度 0 = 竖直向下；正值向前（右）
      const limb = (from, segs, len, base = 0) => { const pts = [from]; let ang = base, p = from; for (const [da, l] of segs) { ang += da; p = [p[0] + Math.sin(ang) * len * l, p[1] + Math.cos(ang) * len * l]; pts.push(p); } return pts; };
      const bob = pose === 'run' ? Math.abs(cw) * S * .12 : 0;
      const T = (pts) => pts.map(([px, py]) => [x + px, y + py - bob]);
      const parts = [[J.hip, neck], limb(neck, armL, S * .95, 0), limb(neck, armR, S * .95, 0), limb(J.hip, legL, S * 1.05), limb(J.hip, legR, S * 1.05)];
      const k = rgb(col).join(',');
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      const style = fo.style || 'outline';   // 'outline'：深色填充 + 亮边（描边质感）；'solid'：实心发光
      const W1 = S * .34, rim = Math.max(1.4, S * .045), fill = fo.fill || K.mix(P.bg, col, .22);
      const strokeAll = (w, col) => { c.strokeStyle = col; for (const [pi, pts] of parts.entries()) { c.lineWidth = pi === 0 ? w * 1.55 : w; c.beginPath(); T(pts).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); } };
      const hd = T([rot([0, -S * .62], lean).map((v, i) => v + neck[i])])[0], HR = S * .42;
      const ga = c.globalAlpha;
      c.globalAlpha = ga * a * .5; strokeAll(W1 + S * .5, `rgba(${k},.08)`); strokeAll(W1 + S * .22, `rgba(${k},.16)`);
      K.halo(c, hd[0], hd[1], S * 1.3, .3, col);
      c.globalAlpha = ga * a;
      if (style === 'outline') {
        strokeAll(W1 + rim * 2, `rgba(${k},.95)`); c.fillStyle = `rgba(${k},.95)`; c.beginPath(); c.arc(hd[0], hd[1], HR + rim, 0, TAU); c.fill();
        strokeAll(W1, M.rgba(M.hex(fill), .92)); c.fillStyle = M.rgba(M.hex(fill), .92); c.beginPath(); c.arc(hd[0], hd[1], HR, 0, TAU); c.fill();
        c.globalAlpha = ga * a * .35; strokeAll(W1 * .25, `rgba(${k},.6)`);   // 身体里一条很淡的亮芯，剪影不是死黑
      } else { strokeAll(W1, `rgba(${k},.92)`); c.fillStyle = `rgba(${k},1)`; c.beginPath(); c.arc(hd[0], hd[1], HR, 0, TAU); c.fill(); }
      c.globalAlpha = ga;
      if (fo.core) K.spr(c, 'white', x + neck[0] * .5, y - bob + (neck[1] + J.hip[1]) / 2, S * .5, a * .8);
      c.restore();
    };
    /** 巨字虚影：背景里极大、极淡的关键字（“如果”），给画面纵深和主题感 */
    K.ghost = (c, str, x, y, size, a = .08, fontW = 900, family) => { if (a <= .002) return; c.save(); c.font = `${fontW} ${size}px "${family || FONT}"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = K.I(a); c.fillText(str, x, y); c.restore(); };
    /** 发光标题样式（DOM）：K.glowTitle(el, {color, strength}) —— 白芯 + 三层光晕，用于片名卡 / 章节大字 */
    K.glowTitle = (el, go = {}) => { const col = go.color || P.ink, k = rgb(col).join(','), st = go.strength ?? 1; el.style.color = '#fff'; el.style.textShadow = `0 0 ${4 * st}px rgba(${k},.95), 0 0 ${22 * st}px rgba(${k},.6), 0 0 ${70 * st}px rgba(${k},.35)`; return el; };

    K.roundRect = (c, x, y, w, h, r = 12) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    /** 玻璃卡片：K.card(c, x, y, w, h, {r, title, sub, accent, p, size})——半透明深底 + 1px 亮边 + 左上色条；p 0..1 展开进度。返回内容区 {x,y,w,h} */
    K.card = (c, x, y, w, h, co = {}) => {
      const p = co.p ?? 1; if (p <= 0) return null; const hh = h * E.outCubic(clamp(p));
      c.save(); K.roundRect(c, x, y, w, hh, co.r ?? 14);
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, K.I(.1)); g.addColorStop(1, K.I(.035)); c.fillStyle = g; c.fill();
      c.strokeStyle = co.accent ? K.rgba(co.accent, .7) : K.I(.18); c.lineWidth = 1; c.stroke(); c.clip();
      c.fillStyle = co.accent ? K.rgba(co.accent, .9) : K.A(.9); c.fillRect(x, y + 14, 3, 26);
      if (co.title) { c.font = `600 ${co.size || 18}px "${FONT}"`; c.fillStyle = co.accent ? K.rgba(co.accent, 1) : K.A(1); c.textAlign = 'left'; c.fillText(co.title, x + 20, y + 34); }
      if (co.sub) { c.font = `400 14px "${FONT}"`; c.fillStyle = K.I(.45); c.textAlign = 'right'; c.fillText(co.sub, x + w - 18, y + 34); }
      c.restore(); return { x: x + 20, y: y + 56, w: w - 40, h: h - 70 };
    };
    /** 按进度生长的发光折线：K.grow(c, pts, p, {w, color, a, head})；返回当前端点 */
    K.grow = (c, pts, p, go = {}) => {
      if (p <= 0 || pts.length < 2) return null; let tot = 0; const seg = [];
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
      let rem = tot * clamp(p); const out = [pts[0]];
      for (let i = 1; i < pts.length && rem > 0; i++) { const d = seg[i - 1]; if (rem >= d) { out.push(pts[i]); rem -= d; } else { const f = rem / d; out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); rem = 0; } }
      K.glowLine(c, out, { w: go.w || 2, color: go.color, a: go.a });
      const e = out[out.length - 1]; if (go.head !== false && p < 1) K.spr(c, 'glow', e[0], e[1], (go.w || 2) * 7, 1); return e;
    };
    /** 手写圈注：K.scribble(c, x, y, rx, ry, p, {color, w})——不规则手画椭圆，p 为画出进度 */
    K.scribble = (c, x, y, rx, ry, p, so = {}) => {
      if (p <= 0) return; const n = 64, pts = [];
      for (let i = 0; i <= n * 1.15 * clamp(p); i++) { const q = i / n * TAU - .4, wob = 1 + .06 * Math.sin(q * 3 + 1) + .03 * Math.sin(q * 7); pts.push([x + Math.cos(q) * rx * wob * (1 + i / n * .06), y + Math.sin(q) * ry * wob]); }
      K.glowLine(c, pts, { w: so.w || 2.5, color: so.color || P.accent });
    };
    /** 线性光混色并返回 hex（可直接传给 K.rgba、palette） */
    K.mix = (c1, c2, p) => '#' + M.mixColor(c1, c2, p).map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
    /** 安全框检查：把世界坐标矩形换算到屏幕，越过画面边缘或进入字幕带时在控制台报警（审片时看 verify 的报错） */
    K.safe = (t, wx, wy, ww, wh, tag = '') => {
      const [x0, y0] = K.toScreen(t, wx, wy), [x1, y1] = K.toScreen(t, wx + ww, wy + wh);
      const capTop = K.caption.y - 20;
      if (x0 < 0 || y0 < 0 || x1 > W || y1 > H || (y1 > capTop && K.caption.lines.some((l) => t >= l.start && t <= l.end))) (window.__SAFE = window.__SAFE || []).push(`${tag} @${t.toFixed(2)}s`), console.warn(`SAFE ${tag} t=${t.toFixed(2)} 屏幕 [${x0 | 0},${y0 | 0},${x1 | 0},${y1 | 0}] 越界或压字幕`);
    };
    /** 圆形放大镜：从 (sx,sy) 引出两条切线到圆心 (x,y) 半径 r 的镜框，内部用 draw(c) 画微观细节。
     *  p 0..1 打开进度；lo: {label, sub, color}。draw 回调里坐标以镜心为原点。 */
    K.lens = (c, sx, sy, x, y, r, p, draw, lo = {}) => {
      if (p <= 0) return; const k = E.outCubic(clamp(p)), rr = r * k, col = lo.color || P.accent;
      c.save();
      // 引线：源点到镜框的两条切线
      const d = Math.hypot(x - sx, y - sy), ang = Math.atan2(y - sy, x - sx), off = Math.asin(clamp(rr / Math.max(d, rr + 1)));
      c.strokeStyle = K.rgba(col, .35 * k); c.lineWidth = 1; c.setLineDash([4, 6]);
      for (const sgn of [-1, 1]) { const q = ang + sgn * off, tl = Math.sqrt(Math.max(0, d * d - rr * rr)); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(q) * tl, sy + Math.sin(q) * tl); c.stroke(); }
      c.setLineDash([]); K.spr(c, 'glow', sx, sy, 10, k);
      // 镜内
      c.save(); c.beginPath(); c.arc(x, y, rr, 0, TAU); c.clip();
      const g = c.createRadialGradient(x, y - rr * .3, rr * .1, x, y, rr); g.addColorStop(0, K.rgba(K.mix(P.bg, col, .14), 1)); g.addColorStop(1, K.rgba(P.bg, 1)); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      c.translate(x, y); if (draw) draw(c, rr, k); c.restore();
      // 镜框：亮边 + 外环刻度
      K.glowLine(c, Array.from({ length: 97 }, (_, i) => [x + Math.cos(i / 96 * TAU) * rr, y + Math.sin(i / 96 * TAU) * rr]), { w: 1.6, color: col, a: k });
      c.strokeStyle = K.I(.18 * k); c.beginPath(); c.arc(x, y, rr * 1.07, 0, TAU); c.stroke();
      for (let i = 0; i < 60; i++) { const q = i / 60 * TAU; c.strokeStyle = K.I((i % 5 ? .12 : .35) * k); c.beginPath(); c.moveTo(x + Math.cos(q) * rr * 1.07, y + Math.sin(q) * rr * 1.07); c.lineTo(x + Math.cos(q) * rr * (i % 5 ? 1.1 : 1.13), y + Math.sin(q) * rr * (i % 5 ? 1.1 : 1.13)); c.stroke(); }
      if (lo.label && lo.labelPos !== 'none' && k > .6) { c.globalAlpha *= clamp((k - .6) * 3); if (lo.labelPos === 'below') { c.font = `600 22px "${FONT}"`; c.fillStyle = K.rgba(col, 1); c.textAlign = 'center'; c.fillText(lo.label, x, y + rr * 1.22 + 22); if (lo.sub) { c.font = `400 16px "${FONT}"`; c.fillStyle = K.I(.5); c.fillText(lo.sub, x, y + rr * 1.22 + 48); } c.restore(); return; } c.font = `600 22px "${FONT}"`; c.fillStyle = K.rgba(col, 1); c.textAlign = 'left'; c.fillText(lo.label, x + rr * .75, y + rr * 1.05); if (lo.sub) { c.font = `400 15px "${FONT}"`; c.fillStyle = K.I(.5); c.fillText(lo.sub, x + rr * .75 + c.measureText(lo.label).width * 1.5 + 14, y + rr * 1.05); } }
      c.restore();
    };
    /** 亮核主体：K.core(c, x, y, r, a, col)——白色实心亮核 + 主色光晕 + 柔光，用于高亮主体（光源、细胞核、信号、星体） */
    K.core = (c, x, y, r, a = 1, col = P.accent) => { K.sprC(c, col, x, y, r * 7, .55 * a, 'soft'); K.halo(c, x, y, r * 3.2, .5 * a, col); K.sprC(c, col, x, y, r * 2.2, a); K.spr(c, 'white', x, y, r * 1.1, a); };
    // ───────────── 有材质的插画式主体（“主角”：有体积、高光、边缘光，占画面 30–60%）
    /** 材质球 / 细胞 / 星体：K.orb(c, x, y, r, {color, a, light:[-.4,-.45], spec, rim, nucleus, membrane, rx, ry, rot, t})
     *  - color 主色；light 光源方向（相对半径）；spec 高光强度；rim 边缘光；nucleus: {r, dx, dy, color}；
     *  - membrane: 边上一圈亮点（细胞膜/通道）；rx/ry 椭圆比例；rot 旋转；t 让膜上亮点缓慢流动 */
    K.orb = (c, x, y, r, o2 = {}) => {
      const a = o2.a ?? 1; if (a <= .003 || r <= 1) return; const col = M.hex(o2.color || P.accent), L2 = o2.light || [-.38, -.42];
      const ga = c.globalAlpha; c.save(); c.translate(x, y); c.rotate(o2.rot || 0); c.scale(o2.rx || 1, o2.ry || 1);
      K.halo(c, 0, 0, r * 1.9, .22 * a, M.rgba(col)); c.globalAlpha = ga * a;
      const dark = M.mixColor(col, M.hex(P.bg), .72), mid = col, lit = M.mixColor(col, [255, 255, 255], .55);
      const g = c.createRadialGradient(L2[0] * r, L2[1] * r, r * .05, 0, 0, r * 1.02);
      g.addColorStop(0, M.rgba(lit, 1)); g.addColorStop(.35, M.rgba(mid, .95)); g.addColorStop(1, M.rgba(dark, .95));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      if (o2.nucleus) { const n = o2.nucleus, nc = M.hex(n.color || M.rgba(dark)); const ng = c.createRadialGradient((n.dx || 0) * r - n.r * r * .3, (n.dy || 0) * r - n.r * r * .3, 0, (n.dx || 0) * r, (n.dy || 0) * r, n.r * r); ng.addColorStop(0, M.rgba(M.mixColor(nc, [255, 255, 255], .25), .75)); ng.addColorStop(1, M.rgba(nc, .65)); c.fillStyle = ng; c.beginPath(); c.arc((n.dx || 0) * r, (n.dy || 0) * r, n.r * r, 0, TAU); c.fill(); }
      // 高光与边缘光
      const sp = o2.spec ?? 1; if (sp > 0) { K.spr(c, 'white', L2[0] * r * .9, L2[1] * r * .9, r * .55, .55 * sp); K.spr(c, 'white', L2[0] * r * .9, L2[1] * r * .9, r * .14, .9 * sp); }
      const rim = o2.rim ?? .8; c.lineWidth = Math.max(1.2, r * .012); c.strokeStyle = M.rgba(M.mixColor(col, [255, 255, 255], .6), .7 * rim); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
      if (o2.membrane) { const n = o2.membrane === true ? 64 : o2.membrane; for (let i = 0; i < n; i++) { const q = i / n * TAU + (o2.t || 0) * .05 + M.hash(i, 9) * .08; const rr = r * (1 + (M.hash(i, 3) - .5) * .02); K.spr(c, 'white', Math.cos(q) * rr, Math.sin(q) * rr, 3 + 4 * M.hash(i, 5), .55 + .45 * Math.sin((o2.t || 0) * 2 + i)); } }
      c.restore();
    };
    /** 神经元 / 树突 / 闪电 / 河网：预生成的分枝结构（加载时调用一次），返回 {segs, draw(c, x, y, p, {color, a, w, pulse, t})}
     *  K.branches({seed, depth:6, len:180, spread:.55, arms:6})：arms 个主干从中心向外分叉；p 0..1 生长进度；pulse 让信号沿枝条流动 */
    K.branches = (bo = {}) => {
      const R = rng(bo.seed || 13), segs = [], depth = bo.depth ?? 6, arms = bo.arms ?? 6, L0 = bo.len ?? 180, spread = bo.spread ?? .55;
      const grow = (x, y, ang, len, d, t0) => {
        const steps = 6, pts = [[x, y]]; let cx = x, cy = y, a = ang;
        for (let i = 0; i < steps; i++) { a += (R() - .5) * .5; cx += Math.cos(a) * len / steps; cy += Math.sin(a) * len / steps; pts.push([cx, cy]); }
        segs.push({ pts, d, t0, t1: t0 + 1 / (depth + 1) });
        if (d < depth) { const n = R() < .35 ? 3 : 2; for (let k = 0; k < n; k++) grow(cx, cy, a + (k - (n - 1) / 2) * spread * (1 + R() * .6), len * (.62 + R() * .2), d + 1, t0 + 1 / (depth + 1)); }
      };
      for (let k = 0; k < arms; k++) grow(0, 0, k / arms * TAU + R() * .4, L0 * (.8 + R() * .4), 0, 0);
      return {
        segs,
        draw(c, x, y, p, d2 = {}) {
          const col = d2.color || P.accent, a = d2.a ?? 1, w = d2.w ?? 2.4; if (a <= .003) return;
          c.save(); c.translate(x, y); if (d2.scale) c.scale(d2.scale, d2.scale);
          for (const s of segs) {
            const k = clamp((p - s.t0) / (s.t1 - s.t0)); if (k <= 0) continue;
            const n = Math.max(2, Math.ceil(s.pts.length * k)); const pts = s.pts.slice(0, n);
            K.glowLine(c, pts, { w: Math.max(.6, w * Math.pow(.72, s.d)), color: col, a: a * (1 - s.d * .07) });
            if (d2.pulse && s.d <= 3) { const q = M.fract((d2.t || 0) * .6 + M.hash(s.d * 31 + s.pts[0][0] | 0, 4)); const i = Math.floor(q * (pts.length - 1)); K.spr(c, 'white', pts[i][0], pts[i][1], 6, a * .9 * k); }
          }
          K.core(c, 0, 0, w * 5, a, col);
          c.restore();
        },
      };
    };
    /** 虹膜 / 眼睛特写（冷开场常用）：K.iris(c, x, y, r, {color, pupil:.42, a, t, open:1}) */
    K.iris = (c, x, y, r, io = {}) => {
      const a = io.a ?? 1; if (a <= .003) return; const col = M.hex(io.color || P.ink), pr = r * (io.pupil ?? .42) * (io.open ?? 1);
      const ga = c.globalAlpha; c.save(); c.translate(x, y); c.globalAlpha = ga * a;
      const g = c.createRadialGradient(0, 0, pr, 0, 0, r); g.addColorStop(0, M.rgba(M.mixColor(col, [255, 255, 255], .2), .9)); g.addColorStop(.6, M.rgba(col, .55)); g.addColorStop(1, M.rgba(M.mixColor(col, M.hex(P.bg), .7), .9));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      for (let i = 0; i < 900; i++) { const q = M.hash(i, 1) * TAU, r0 = pr * (1 + M.hash(i, 2) * .15), r1 = r * (.55 + .45 * M.hash(i, 3)); c.strokeStyle = M.rgba(M.mixColor(col, [255, 255, 255], M.hash(i, 4) * .7), .08 + .22 * M.hash(i, 5)); c.lineWidth = .6 + M.hash(i, 6) * 1.6; c.beginPath(); c.moveTo(Math.cos(q) * r0, Math.sin(q) * r0); c.lineTo(Math.cos(q + (M.hash(i, 7) - .5) * .05) * r1, Math.sin(q + (M.hash(i, 7) - .5) * .05) * r1); c.stroke(); }
      const pg = c.createRadialGradient(0, 0, pr * .8, 0, 0, pr * 1.15); pg.addColorStop(0, M.rgba(M.hex(P.bg), 1)); pg.addColorStop(1, M.rgba(M.hex(P.bg), 0)); c.fillStyle = pg; c.beginPath(); c.arc(0, 0, pr * 1.15, 0, TAU); c.fill();
      c.fillStyle = M.rgba(M.mixColor(M.hex(P.bg), [0, 0, 0], .5), 1); c.beginPath(); c.arc(0, 0, pr * .92, 0, TAU); c.fill();
      K.spr(c, 'white', -r * .3, -r * .32, r * .18, .7); K.spr(c, 'white', -r * .3, -r * .32, r * .05, 1);
      c.restore();
    };

    // ───────────── 转场（不要默认交叉溶解）
    /** 圆形遮罩转场：在 render 里先画下一场景，再 K.irisWipe(c, x, y, p, drawPrev) —— p 0→1 时上一场景从 (x,y) 收成一个点（或反过来展开） */
    K.irisWipe = (c, x, y, p, drawInside, open = true) => { const R2 = Math.hypot(W, H); const rr = (open ? E.inOutCubic(p) : 1 - E.inOutCubic(p)) * R2; c.save(); c.beginPath(); c.arc(x, y, Math.max(0, rr), 0, TAU); c.clip(); c.fillStyle = P.bg; c.fillRect(0, 0, W, H); drawInside(c); c.restore(); K.glowLine(c, Array.from({ length: 97 }, (_, i) => [x + Math.cos(i / 96 * TAU) * rr, y + Math.sin(i / 96 * TAU) * rr]), { w: 2, a: Math.sin(Math.PI * clamp(p)) }); };
    /** 光扫转场：一道竖向光带从左到右扫过，光带左侧显示新场景。drawNew(c) 画新场景 */
    K.lightSweep = (c, p, drawNew, so = {}) => { const x = lerp(-200, W + 200, E.inOutCubic(clamp(p))); c.save(); c.beginPath(); c.rect(0, 0, Math.max(0, x), H); c.clip(); c.fillStyle = P.bg; c.fillRect(0, 0, W, H); drawNew(c); c.restore(); if (p > 0 && p < 1) { const g = c.createLinearGradient(x - 160, 0, x + 40, 0); g.addColorStop(0, K.A(0)); g.addColorStop(.85, K.rgba(so.color || P.accent, .5)); g.addColorStop(1, K.I(0)); c.fillStyle = g; c.fillRect(x - 160, 0, 200, H); K.spr(c, 'white', x, H / 2, 300, .25); } };
    /** 匹配剪辑辅助：返回 0..1 的“推近穿越”进度——把镜头推进上一场景的某个物体（眼睛、门、屏幕、细胞），满屏后切到下一场景 */
    K.pushThrough = (t, t0, dur = .7) => E.inExpo(prog(t, t0, t0 + dur));
    // ───────────── 多色发光（每个场景可以换主色）
    const SPRC = new Map();
    /** 任意颜色的发光精灵：K.sprC(c, '#ff7a59', x, y, r, a, kind='glow'|'soft') */
    K.warm = (cols) => { for (const col of cols) for (const kind of ['glow', 'soft']) K.sprC(document.createElement('canvas').getContext('2d'), col, 0, 0, 1, 1, kind); };   // 预热：把本片会用的颜色在加载时生成好
    K.sprC = (c, col, x, y, r, a = 1, kind = 'glow') => {
      const key = col + kind; let s = SPRC.get(key);
      if (!s) { const k = rgb(col).join(','); s = sprite(64, kind === 'soft' ? [[0, `rgba(${k},.5)`], [.5, `rgba(${k},.12)`], [1, `rgba(${k},0)`]] : [[0, 'rgba(255,255,255,1)'], [.12, `rgba(${k},.8)`], [.35, `rgba(${k},.22)`], [1, `rgba(${k},0)`]]); SPRC.set(key, s); }
      const ga = c.globalAlpha; if (a * ga <= .002 || r <= .1) return; c.globalAlpha = a * ga; c.drawImage(s, x - r, y - r, r * 2, r * 2); c.globalAlpha = ga;
    };
    /** 人物侧脸剪影（冷开场的情绪锚点）：K.profile(c, x, y, h, {color, a, facing:1|-1, rim:1, fill})——高 h 的头肩侧影，亮边勾出轮廓 */
    K.profile = (c, x, y, h, po = {}) => {
      const a = po.a ?? 1; if (a <= .003) return; const col = po.color || P.ink, f = po.facing ?? 1, s = h / 100;
      const path = () => { c.beginPath(); c.moveTo(-30, 100); c.bezierCurveTo(-34, 78, -30, 70, -16, 64); c.bezierCurveTo(-8, 60, -6, 54, -8, 48);
        c.bezierCurveTo(-24, 44, -30, 30, -28, 12); c.bezierCurveTo(-26, -8, -10, -18, 6, -16); c.bezierCurveTo(22, -14, 30, -2, 30, 10);
        c.bezierCurveTo(30, 16, 34, 20, 37, 26); c.bezierCurveTo(38, 29, 34, 30, 32, 31); c.bezierCurveTo(33, 35, 31, 37, 30, 38); c.bezierCurveTo(31, 41, 29, 43, 27, 44);
        c.bezierCurveTo(26, 50, 20, 52, 12, 51); c.bezierCurveTo(10, 56, 12, 62, 22, 66); c.bezierCurveTo(40, 72, 48, 82, 50, 100); c.closePath(); };
      const ga = c.globalAlpha; c.save(); c.translate(x, y); c.scale(s * f, s); c.globalAlpha = ga * a;
      K.halo(c, 10, 30, 90, .25, col);
      const g = c.createLinearGradient(-30, 0, 40, 0); g.addColorStop(0, M.rgba(M.hex(po.fill || K.mix(P.bg, col, .05)), 1)); g.addColorStop(1, M.rgba(M.hex(K.mix(P.bg, col, .2)), 1));
      path(); c.fillStyle = g; c.fill();
      c.lineJoin = 'round'; c.strokeStyle = K.rgba(col, .18 * (po.rim ?? 1)); c.lineWidth = 7 / s; path(); c.stroke();
      c.strokeStyle = K.rgba(K.mix(col, '#ffffff', .5), .95 * (po.rim ?? 1)); c.lineWidth = 1.8 / s; path(); c.stroke();
      c.restore();
    };
    // ───────────── 场景调度器：多个场景 + 转场（转场期间新旧两个场景同时绘制）
    /** K.scenes([{ id, start, end, draw(c, t, lt), color?, in: {type:'iris'|'sweep'|'push'|'cut'|'fade', dur, x, y} }])
     *  在 render 里调用 K.drawScenes(t)。in 描述“本场景如何进入”：
     *   iris  从 (x,y) 圆形展开；sweep 光带从左向右扫；push 上一场景推近放大并淡出，本场景从中心展开；cut 硬切；fade 叠化（少用）
     *  draw 只画 canvas 内容；场景自己的 DOM 文字请按 lt（场景内时间）自行 reveal/hide。 */
    let SC = [];
    K.scenes = (list) => { SC = list.slice().sort((a, b) => a.start - b.start); };
    K.sceneAt = (t) => SC.find((s) => t >= s.start && t < s.end) || null;
    K.drawScenes = (t) => {
      const c = K.ctx;
      for (let i = 0; i < SC.length; i++) {
        const s = SC[i], tr = s.in || { type: 'cut' }, dur = tr.dur ?? .6, prev = SC[i - 1];
        if (t < s.start || t >= s.end) continue;
        const p = clamp((t - s.start) / dur), inTr = prev && p < 1 && tr.type !== 'cut';
        if (!inTr) { s.draw(c, t, t - s.start); continue; }
        const drawPrev = () => prev.draw(c, t, t - prev.start), drawCur = (cc) => s.draw(cc || c, t, t - s.start);
        if (tr.type === 'iris') { drawPrev(); K.irisWipe(c, tr.x ?? W / 2, tr.y ?? H / 2, p, drawCur); }
        else if (tr.type === 'sweep') { drawPrev(); K.lightSweep(c, p, drawCur, { color: s.color }); }
        else if (tr.type === 'push') { c.save(); c.globalAlpha *= 1 - E.inCubic(p); c.translate(tr.x ?? W / 2, tr.y ?? H / 2); const z = 1 + 2.5 * E.inExpo(p); c.scale(z, z); c.translate(-(tr.x ?? W / 2), -(tr.y ?? H / 2)); drawPrev(); c.restore(); K.irisWipe(c, tr.x ?? W / 2, tr.y ?? H / 2, E.outCubic(p), drawCur); }
        else { c.save(); c.globalAlpha *= 1 - p; drawPrev(); c.restore(); c.save(); c.globalAlpha *= p; drawCur(); c.restore(); }
      }
    };
    // ───────────── 火焰与氛围色雾（来自《生日悖论》测试片的沉淀）
    /** 火焰（蜡烛、火种、灯、信号、“一个人”）：K.flame(c, x, y, h, {t, seed, color, a, glow, lean, wide, shimmer}) ——(x,y) 为火焰底部 */
    K.flame = (c, x, y, h, o = {}) => {
      const a = o.a ?? 1; if (a <= .003 || h < 1) return;
      const t = o.t ?? 0, sd = o.seed ?? 0, col = o.color || P.accent2;
      const n1 = M.noise1(t * 6.5 + sd * 3.1, sd + 1), n2 = M.noise1(t * 15 + sd * 1.7, sd + 7);
      const hh = h * (1 + .07 * n1 + .025 * n2), ww = h * .26 * (o.wide ?? 1);
      const lean = (o.lean || 0) + .09 * M.noise1(t * 2.1 + sd * 5, sd + 3) + .035 * n2;
      const ga = c.globalAlpha; c.save(); c.translate(x, y); c.globalAlpha = ga * a;
      if ((o.glow ?? 1) > 0) { K.sprC(c, col, 0, -hh * .42, h * 2.5 * (o.glow ?? 1), .34, 'soft'); K.sprC(c, col, 0, -hh * .38, h, .3, 'soft'); }
      c.globalCompositeOperation = 'lighter';
      const shape = (s, dy = 0) => { const H2 = hh * s, w2 = ww * s, tx = lean * H2 * .55; c.beginPath(); c.moveTo(0, w2 * .38 + dy); c.bezierCurveTo(w2 * 1.18, w2 * .32 + dy, w2 * .92 + tx * .15, -H2 * .44 + dy, tx, -H2 + dy); c.bezierCurveTo(-w2 * .92 + tx * .15, -H2 * .44 + dy, -w2 * 1.18, w2 * .32 + dy, 0, w2 * .38 + dy); c.closePath(); };
      const deep = M.mixColor(col, '#ff3a0c', .5), pale = M.mixColor(col, '#ffffff', .35);
      let g = c.createRadialGradient(0, -hh * .16, hh * .02, 0, -hh * .34, hh * .86);
      g.addColorStop(0, 'rgba(255,248,232,.95)'); g.addColorStop(.3, M.rgba(pale, .85)); g.addColorStop(.64, M.rgba(deep, .5)); g.addColorStop(1, M.rgba(deep, 0));
      shape(1); c.fillStyle = g; c.fill();
      c.lineWidth = Math.max(.6, h * .012); c.strokeStyle = M.rgba(pale, .22); shape(.98); c.stroke();
      g = c.createRadialGradient(0, -hh * .14, 0, 0, -hh * .2, hh * .46);
      g.addColorStop(0, 'rgba(255,255,252,1)'); g.addColorStop(.55, 'rgba(255,242,205,.75)'); g.addColorStop(1, 'rgba(255,215,150,0)');
      shape(.56, -ww * .05); c.fillStyle = g; c.fill();
      g = c.createRadialGradient(0, ww * .12, 0, 0, ww * .12, ww * .95);
      g.addColorStop(0, 'rgba(110,150,255,0)'); g.addColorStop(.55, 'rgba(80,120,255,.38)'); g.addColorStop(1, 'rgba(60,90,255,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, ww * .06, ww * .82, ww * .56, 0, 0, TAU); c.fill();
      c.globalCompositeOperation = 'source-over';
      K.spr(c, 'white', 0, -hh * .2, ww * .95, .9);
      if (o.shimmer) { c.lineCap = 'round'; for (let s2 = 0; s2 < 3; s2++) { c.strokeStyle = `rgba(255,200,150,${.05 * o.shimmer})`; c.lineWidth = 1.2 + s2; c.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20, yy = -hh * (1 + u * 1.1), xx = lean * hh * .55 + Math.sin(u * 9 - t * 5 + s2 * 2) * ww * .25 * u + M.noise1(u * 4 - t * 1.3, s2 + 9) * ww * .4 * u; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); } }
      c.restore();
    };
    /** 氛围色雾：K.fog(t, color, a) —— 在背景层叠几团缓慢漂移的主色光雾（按章节换色时用；画在 K.begin 之后） */
    K.fog = (t, col, al = .08) => {
      if (al <= .003) return; const b = K.bg, k = rgb(col).join(',');
      b.save(); b.globalCompositeOperation = 'lighter';
      const blob = (x, y, r, a) => { const g = b.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${k},${a})`); g.addColorStop(.45, `rgba(${k},${a * .35})`); g.addColorStop(1, `rgba(${k},0)`); b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2); };
      blob(W * .22 + 120 * Math.sin(t * .05), H * .3 + 60 * Math.cos(t * .07), 900 * W / 1920, al);
      blob(W * .82 + 100 * Math.cos(t * .04), H * .72 + 50 * Math.sin(t * .06), 1000 * W / 1920, al * .8);
      blob(W * .5, H * .5, 700 * W / 1920, al * .35);
      b.restore();
    };
    /** 放射光丝：K.rays(c, x, y, t, a, color, {n, len}) ——光源背后缓慢旋转的细光束 */
    K.rays = (c, x, y, t, a = 1, col = P.accent, ro = {}) => {
      if (a <= .003) return; const n = ro.n || 48, L0 = ro.len || 700; c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (let i = 0; i < n; i++) { const q = i / n * TAU + t * .03 + M.hash(i, 31) * .1, len = L0 * (.4 + .6 * M.hash(i, 32)), w = .6 + 1.4 * M.hash(i, 33); const g = c.createLinearGradient(x, y, x + Math.cos(q) * len, y + Math.sin(q) * len); g.addColorStop(0, K.rgba(col, .35 * a * (.4 + .6 * M.hash(i, 34)))); g.addColorStop(1, K.rgba(col, 0)); c.strokeStyle = g; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(q) * len, y + Math.sin(q) * len); c.stroke(); }
      c.restore();
    };
    /** 刻度尺：K.ruler(c, x0, y0, x1, y1, n, {major:5, len:8, labels:i=>''}) */
    K.ruler = (c, x0, y0, x1, y1, n, ro = {}) => {
      const dx = (x1 - x0) / n, dy = (y1 - y0) / n, len = ro.len ?? 8, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
      c.save(); c.strokeStyle = ro.color || K.I(.35); c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
      for (let i = 0; i <= n; i++) { const m = i % (ro.major || 5) === 0 ? 1.8 : 1; const px = x0 + dx * i, py = y0 + dy * i; c.moveTo(px, py); c.lineTo(px + nx / nl * len * m, py + ny / nl * len * m); }
      c.stroke();
      if (ro.labels) { c.fillStyle = K.I(.4); c.font = `300 11px "${FONT}"`; c.textAlign = 'center'; for (let i = 0; i <= n; i += ro.major || 5) { const s = ro.labels(i); if (s) c.fillText(s, x0 + dx * i + nx / nl * (len * 2 + 12), y0 + dy * i + ny / nl * (len * 2 + 12) + 4); } }
      c.restore();
    };
    /** 环形刻度表盘：K.dial(c, x, y, r, {ticks:60, p:进度0..1, label}) */
    K.dial = (c, x, y, r, d = {}) => {
      const n = d.ticks ?? 60; c.save(); c.translate(x, y); c.lineWidth = 1;
      for (let i = 0; i < n; i++) { const q = i / n * TAU - Math.PI / 2, big = i % 5 === 0; c.strokeStyle = K.I(big ? .6 : .22); c.beginPath(); c.moveTo(Math.cos(q) * r * (big ? .86 : .92), Math.sin(q) * r * (big ? .86 : .92)); c.lineTo(Math.cos(q) * r, Math.sin(q) * r); c.stroke(); }
      if (d.p != null) { c.strokeStyle = K.A(.9); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r * 1.06, -Math.PI / 2, -Math.PI / 2 + TAU * d.p); c.stroke(); const q = -Math.PI / 2 + TAU * d.p; K.spr(c, 'glow', Math.cos(q) * r * 1.06, Math.sin(q) * r * 1.06, 10, .9); }
      c.strokeStyle = K.I(.12); c.beginPath(); c.arc(0, 0, r * 1.14, 0, TAU); c.stroke();
      c.restore();
    };
    /** 发光线：K.glowLine(c, pts, {w:2, a:1, color}) —— 一条实线 + 两层光晕 */
    K.glowLine = (c, pts, g = {}) => {
      const col = g.color || P.accent; c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      [[(g.w || 2.6) * 6, .08], [(g.w || 2.6) * 2.5, .22], [g.w || 2.6, 1]].forEach(([w, a]) => { c.strokeStyle = K.rgba(col, a * (g.a ?? 1)); c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); });
      c.restore();
    };

    // ───────────── 帧开始/结束
    K.begin = (t) => {
      for (const l of Object.values(L)) l.clear();
      drawAmbient(t);
    };
    K.end = (t) => {
      if (BLOOM > 0) { // 只让亮部发光：先压掉中间调（阈值），再模糊
        bt.clearRect(0, 0, bl.width, bl.height); bt.filter = 'brightness(.55) contrast(3.2)'; bt.drawImage(L.main.el, 0, 0, bl.width, bl.height); bt.filter = 'none';
        blx.clearRect(0, 0, bl.width, bl.height); blx.filter = 'blur(5px)'; blx.drawImage(btc, 0, 0); blx.filter = 'none'; const bc = L.bloom.ctx; bc.save(); bc.globalAlpha = Math.min(1, BLOOM); bc.drawImage(bl, 0, 0, W, H); if (BLOOM > 1) { bc.globalAlpha = BLOOM - 1; bc.drawImage(bl, 0, 0, W, H); } bc.restore(); L.bloom.el.style.transformOrigin = '0 0'; L.bloom.el.style.transform = L.main.el.style.transform; }
      for (const [t0, x, y, peak, dur] of flares) { if (t < t0 - .05 || t > t0 + dur) continue; const k = peak * (t < t0 ? prog(t, t0 - .05, t0) : Math.pow(1 - prog(t, t0, t0 + dur), 2)); const [px, py] = typeof x === 'function' ? x(t) : [x, y]; drawFlare(px, py, k); }
      let fl = 0; for (const [t0, peak, dur] of flashes) { const d = t - t0; if (d >= 0 && d < dur) fl = Math.max(fl, peak * Math.pow(1 - d / dur, 2)); }
      flashEl.style.opacity = fl;
      drawHud(t); drawCaption(t);
      const gr = grain.ctx, r2 = rng(Math.floor(t * 24) + 1); grain.clear();
      for (let i = 0; i < 2200; i++) { gr.fillStyle = r2() > .5 ? '#fff' : '#000'; gr.globalAlpha = .16 * r2(); gr.fillRect(r2() * W, r2() * H, 2, 2); }
      gr.globalAlpha = 1;
    };
    K.warm([P.accent, P.accent2, P.ink]);
    return K;
  }
  window.Kit = Kit;
})();
