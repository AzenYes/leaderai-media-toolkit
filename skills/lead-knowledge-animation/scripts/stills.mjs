#!/usr/bin/env node
// 静帧与联系表：动之前先看帧，修改后只看受影响的时刻。
// 用法：
//   node stills.mjs film/index.html --scenes                 每个场景中点一张（+联系表）
//   node stills.mjs film/index.html --at 1.2,3.45,7          指定时刻
//   node stills.mjs film/index.html --every 0.5              每 0.5s 一张（全片节奏）
//   node stills.mjs film/index.html --range 4.6:5.4:0.0333   逐帧检查转场/快动作
//   node stills.mjs film/index.html --boundaries             每个场景边界前后 ±3 帧条带
//   通用：--out out/stills  --scale 0.5  --cols 6  --tag 名字（文件名前缀，避免覆盖）
//         --phone                按 360px 宽渲染，检查手机可读性
//         --crop x,y,w,h         只截设计坐标里的这一块（放大看小字/接缝），配合 --scale 1 或 2
//         --query "ratio=9x16"   传给影片的 URL 参数（切换画幅、方向、调试开关）
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, parseArgs, openFilm, shot } from './_pw.mjs';

const a = parseArgs(process.argv.slice(2));
const html = a._[0];
const query = a.query || '';
const { chromium } = loadPlaywright();
const probe = await openFilm(chromium, html, { scale: 1, query });
const meta = probe.meta; await probe.browser.close();
const fps = meta.fps || 30;
let scale = +(a.scale || (a.crop ? 1 : 0.5));
if (a.phone) scale = 360 / Math.min(meta.width, meta.height);
const crop = a.crop ? String(a.crop).split(',').map(Number) : null;

const times = []; let tag = 'at';
if (a.scenes) { tag = 'scenes'; for (const s of meta.scenes) times.push([(s.start + s.end) / 2, s.label || s.id]); }
if (a.at) { for (const x of String(a.at).split(',')) times.push([+x, '']); }
if (a.every) { tag = 'every'; for (let t = 0; t < meta.duration - 1e-9; t += +a.every) times.push([t, '']); }
if (a.range) { tag = 'range'; const [s, e, st] = String(a.range).split(':').map(Number); for (let t = s; t <= e + 1e-9; t += st || 1 / fps) times.push([t, '']); }
if (a.boundaries) {
  tag = 'boundaries';
  for (const s of meta.scenes.slice(1)) for (let k = -3; k <= 3; k++) times.push([s.start + k / fps, k === 0 ? `▶ ${s.label || s.id}` : '']);
}
if (!times.length) { console.error('请指定 --scenes / --at / --every / --range / --boundaries'); process.exit(1); }
if (a.tag) tag = a.tag + '_' + tag;
if (a.phone) tag += '_phone';
if (crop) tag += '_crop';

const outDir = path.resolve(a.out || 'out/stills');
fs.mkdirSync(outDir, { recursive: true });
const { browser, page, errors } = await openFilm(chromium, html, { scale, query });
const clip = crop ? { x: crop[0], y: crop[1], width: crop[2], height: crop[3] } : null;
const items = [];
for (const [t, label] of times) {
  const tt = Math.max(0, Math.min(meta.duration - 1e-6, t));
  const file = path.join(outDir, `${tag}_${tt.toFixed(3).replace('.', '_')}s.png`);
  const buf = await shot(page, meta, tt, file, tt, clip);
  items.push({ t: tt, label, file, data: buf.toString('base64') });
}
console.log(`已输出 ${items.length} 张 → ${outDir}`);

// 在浏览器里排版联系表（带时间码与场景名）
if (items.length > 1) {
  const W = crop ? crop[2] : meta.width, H = crop ? crop[3] : meta.height;
  const cols = +(a.cols || (tag.includes('boundaries') ? 7 : Math.min(W < H ? 8 : 6, items.length)));
  const tw = Math.min(W < H ? 270 : 480, Math.round(W * scale)), th = Math.round(tw * H / W);
  const sheet = await browser.newPage({ viewport: { width: cols * (tw + 8) + 8, height: 400 } });
  await sheet.setContent(`<html><body style="margin:0;background:#0b0b0b;padding:8px;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:8px;font:12px ui-monospace,Menlo,Consolas,monospace;color:#bbb">
    ${items.map((it) => `<div><img src="data:image/png;base64,${it.data}" style="width:${tw}px;height:${th}px;display:block;outline:1px solid #222"><div style="padding:3px 2px">${it.t.toFixed(3)}s · f${Math.round(it.t * fps)} ${it.label || ''}</div></div>`).join('')}
  </body></html>`);
  await sheet.waitForLoadState('load');
  const file = path.join(outDir, `sheet_${tag}.png`);
  await sheet.screenshot({ path: file, fullPage: true });
  console.log('联系表 → ' + file);
}
const safe = await page.evaluate(() => [...new Set(window.__SAFE || [])]);
if (safe.length) console.warn(`安全框越界（K.safe）${safe.length} 处：` + safe.slice(0, 20).join('，'));
if (errors.length) console.warn('页面报错：\n  ' + [...new Set(errors)].join('\n  '));
await browser.close();
