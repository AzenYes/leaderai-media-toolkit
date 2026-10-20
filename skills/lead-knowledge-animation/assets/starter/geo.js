/* geo.js — 地图与地球原语（依赖 motion.js、kit.js；数据在 assets/geo/world110.js：Natural Earth 110m，公有领域）
 * 用法：<script src="world110.js"></script><script src="geo.js"></script>，然后 const G = Geo(K);
 *   G.globe(c, {lon0, lat0, R, cx, cy}, {a, dots, coast, grat, day, sun:[lon,lat], tint})   正射投影点阵地球
 *   G.route([[lon,lat], ...]) → 稠密大圆路径（附累计公里 r.total）；G.routeAt(r, p) → [lon,lat]
 *   G.globePath(c, g, r, p, {p0, lift, w, col}) → 头部屏幕坐标        地球表面生长的发光路径
 *   G.map(c, {lon0, lat0, scale, cx, cy}, {a, dots, coast}) / G.mapXY(lon, lat, m)  平面世界地图（等距圆柱）
 *   G.proj(lon, lat, g) → [x, y, z]（z>0 在正面）；G.hav(a, b) → 公里
 *   G.comet(c, x, y, a, r)   彗星头；G.burst(c, x, y, p, {n, R, col})   光爆放射线
 */
(function () {
  'use strict';
  const { clamp, lerp, TAU, ease: E } = M;
  const D2R = Math.PI / 180;
  window.Geo = function (K) {
    const GEO = window.GEO || { polys: [], dots: [] };
    const G = {};
    const P = K.P;
    G.proj = (lon, lat, g) => {
      const l = (lon - g.lon0) * D2R, p = lat * D2R, p0 = g.lat0 * D2R;
      const cp = Math.cos(p), z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cp * Math.cos(l);
      return [g.cx + g.R * cp * Math.sin(l), g.cy - g.R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cp * Math.cos(l)), z];
    };
    G.slerp = (a, b, s) => {
      const v = ([lo, la]) => [Math.cos(la * D2R) * Math.cos(lo * D2R), Math.cos(la * D2R) * Math.sin(lo * D2R), Math.sin(la * D2R)];
      const A = v(a), B = v(b); const d = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1));
      if (d < 1e-6) return a.slice();
      const k1 = Math.sin((1 - s) * d) / Math.sin(d), k2 = Math.sin(s * d) / Math.sin(d);
      const x = k1 * A[0] + k2 * B[0], y = k1 * A[1] + k2 * B[1], z = k1 * A[2] + k2 * B[2];
      return [Math.atan2(y, x) / D2R, Math.atan2(z, Math.hypot(x, y)) / D2R];
    };
    G.hav = (a, b) => { const [l1, p1] = a.map((v) => v * D2R), [l2, p2] = b.map((v) => v * D2R); const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); };
    G.route = (wps, per = 24) => {
      const out = []; let km = 0;
      for (let i = 0; i < wps.length - 1; i++) for (let j = 0; j < per; j++) { const p = G.slerp(wps[i], wps[i + 1], j / per); if (out.length) km += G.hav(out[out.length - 1].ll, p); out.push({ ll: p, km }); }
      const last = wps[wps.length - 1]; km += G.hav(out[out.length - 1].ll, last); out.push({ ll: last, km });
      out.total = km; return out;
    };
    G.routeAt = (r, p) => { const f = clamp(p) * (r.length - 1), i = Math.floor(f), k = f - i; const a = r[i].ll, b = r[Math.min(i + 1, r.length - 1)].ll; return [lerp(a[0], b[0] + (Math.abs(b[0] - a[0]) > 180 ? (b[0] > a[0] ? -360 : 360) : 0), k), lerp(a[1], b[1], k)]; };
    const dayK = (sun, lon, lat) => { const s = [sun[0] * D2R, sun[1] * D2R], l = lon * D2R, p = lat * D2R; return Math.sin(s[1]) * Math.sin(p) + Math.cos(s[1]) * Math.cos(p) * Math.cos(l - s[0]); };

    G.globe = (c, g, o = {}) => {
      const a = o.a ?? 1; if (a <= .003) return; const { cx, cy, R } = g; const tint = o.tint || P.accent;
      c.save();
      K.halo(c, cx, cy, R * 1.55, .1 * a, tint);
      const at = c.createRadialGradient(cx, cy, R * .96, cx, cy, R * 1.08); at.addColorStop(0, K.rgba(tint, .22 * a)); at.addColorStop(1, K.rgba(tint, 0));
      c.fillStyle = at; c.beginPath(); c.arc(cx, cy, R * 1.08, 0, TAU); c.fill();
      const sg = c.createRadialGradient(cx - R * .35, cy - R * .4, R * .05, cx, cy, R);
      const bg = M.hex(P.bg), lit = M.mixColor(bg, M.hex(tint), .18);
      sg.addColorStop(0, M.rgba(lit, .95 * a)); sg.addColorStop(.7, M.rgba(M.mixColor(bg, M.hex(tint), .07), .96 * a)); sg.addColorStop(1, M.rgba(bg, a));
      c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
      if ((o.grat ?? 1) > 0) {
        c.lineWidth = 1; c.strokeStyle = K.I(.05 * a * (o.grat ?? 1));
        for (let lat = -75; lat <= 75; lat += 15) { c.beginPath(); let pen = false; for (let lon = -180; lon <= 180; lon += 4) { const [x, y, z] = G.proj(lon, lat, g); if (z > 0) { pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; } else pen = false; } c.stroke(); }
        for (let lon = -180; lon < 180; lon += 15) { c.beginPath(); let pen = false; for (let lat = -88; lat <= 88; lat += 4) { const [x, y, z] = G.proj(lon, lat, g); if (z > 0) { pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; } else pen = false; } c.stroke(); }
      }
      const ds = Math.max(1.2, R / 260) * (o.dotK || 1), day = o.day || 0, sun = o.sun || [0, 0];
      const a2 = M.hex(P.accent2), a1 = M.hex(tint), ink = M.hex(P.ink);
      for (const [lon, lat] of GEO.dots) {
        const [x, y, z] = G.proj(lon, lat, g); if (z <= .02 || x < -10 || x > K.W + 10 || y < -10 || y > K.H + 10) continue;
        let al = (.18 + .62 * z) * a * (o.dots ?? 1), col = ink;
        if (day > 0) { const dd = clamp(dayK(sun, lon, lat) * 4 + .5); col = M.mixColor(ink, M.mixColor(a1, a2, dd), day); al *= lerp(1, lerp(.45, 1.15, dd), day); }
        c.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${clamp(al)})`; const s = ds * (.6 + .4 * z); c.fillRect(x - s / 2, y - s / 2, s, s);
      }
      if ((o.coast ?? 1) > 0) {
        c.lineWidth = Math.max(.8, R / 500); c.strokeStyle = K.rgba(tint, .28 * a * (o.coast ?? 1)); c.beginPath();
        for (const ring of GEO.polys) { let pen = false; for (const [lon, lat] of ring) { const [x, y, z] = G.proj(lon, lat, g); if (z > 0) { pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; } else pen = false; } }
        c.stroke();
      }
      c.lineWidth = 1.5; c.strokeStyle = K.rgba(tint, .45 * a); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
      c.restore();
    };
    G.globePath = (c, g, r, p1, o = {}) => {
      const p0 = o.p0 || 0, a = o.a ?? 1; if (p1 <= p0 || a <= .003) return null;
      const n = r.length - 1, i0 = Math.floor(p0 * n), i1 = Math.floor(p1 * n), pts = [];
      const lifted = (x, y, f) => { const L = o.lift ? 1 + o.lift * Math.sin(Math.PI * f) : 1; return [g.cx + (x - g.cx) * L, g.cy + (y - g.cy) * L]; };
      for (let i = i0; i <= i1; i++) { const [x, y, z] = G.proj(r[i].ll[0], r[i].ll[1], g); if (z > -.05 || o.lift) pts.push(lifted(x, y, i / n)); }
      const hl = G.routeAt(r, p1), [hx, hy, hz] = G.proj(hl[0], hl[1], g), head = [...lifted(hx, hy, p1), hz];
      pts.push([head[0], head[1]]);
      if (pts.length > 1) K.glowLine(c, pts, { w: o.w || 2, color: o.col || P.accent, a });
      return head;
    };
    G.mapXY = (lon, lat, m) => { let d = lon - m.lon0; d = ((d + 540) % 360) - 180; return [m.cx + d * m.scale, m.cy - (lat - m.lat0) * m.scale]; };
    G.map = (c, m, o = {}) => {
      const a = o.a ?? 1; if (a <= .003) return; const ds = Math.max(1.2, m.scale * .9) * (o.dotK || 1);
      for (const [lon, lat] of GEO.dots) { const [x, y] = G.mapXY(lon, lat, m); if (x < -10 || x > K.W + 10 || y < -10 || y > K.H + 10) continue; c.fillStyle = K.I(.35 * a * (o.dots ?? 1)); c.fillRect(x - ds / 2, y - ds / 2, ds, ds); }
      if ((o.coast ?? 1) > 0) { c.lineWidth = 1; c.strokeStyle = K.A(.3 * a * (o.coast ?? 1)); c.beginPath(); for (const ring of GEO.polys) { let pen = false, px = null; for (const [lon, lat] of ring) { const [x, y] = G.mapXY(lon, lat, m); if (px !== null && Math.abs(x - px) > 200 * m.scale) pen = false; pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; px = x; } } c.stroke(); }
    };
    G.comet = (c, x, y, a = 1, r = 1) => { if (a <= .003) return; K.spr(c, 'soft', x, y, 90 * r, .6 * a); K.spr(c, 'glow', x, y, 26 * r, a); K.spr(c, 'white', x, y, 9 * r, a); };
    G.burst = (c, x, y, p, o = {}) => {
      if (p <= 0 || p >= 1) return; const n = o.n || 160, R = o.R || 900, col = o.col || P.accent, a = (o.a ?? 1) * Math.pow(1 - p, 1.4);
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const h = M.hash(i, o.seed || 21), q = i / n * TAU + h * .05, len = R * (.25 + .75 * M.hash(i, 22)), r0 = 30 + len * E.outExpo(p) * .25, r1 = r0 + len * (.15 + .85 * E.outExpo(p)) * .6;
        c.strokeStyle = K.rgba(i % 7 ? col : '#ffffff', a * (.15 + .5 * M.hash(i, 23))); c.lineWidth = .6 + 1.6 * M.hash(i, 24);
        c.beginPath(); c.moveTo(x + Math.cos(q) * r0, y + Math.sin(q) * r0); c.lineTo(x + Math.cos(q) * r1, y + Math.sin(q) * r1); c.stroke();
      }
      c.restore(); K.halo(c, x, y, 300, .5 * a, col);
    };
    return G;
  };
})();
