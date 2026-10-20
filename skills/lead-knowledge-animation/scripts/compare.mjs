#!/usr/bin/env node
// 把任意几张图并排成一张对比图（比较三个方向的代表帧、改前/改后、方案A vs 方案B）
// 用法：node compare.mjs a.png b.png c.png --out out/compare.png [--labels "A 等高线,B 退潮,C 像素"] [--width 640]
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, parseArgs } from './_pw.mjs';

const a = parseArgs(process.argv.slice(2));
if (a._.length < 1) { console.error('用法：node compare.mjs a.png b.png ... --out compare.png'); process.exit(1); }
const labels = String(a.labels || '').split(',');
const w = +(a.width || (a._.length > 3 ? 420 : 640));
const imgs = a._.map((f, i) => ({ src: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'), label: labels[i] || path.basename(f) }));
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: imgs.length * (w + 12) + 12, height: 300 } });
await page.setContent(`<html><body style="margin:0;background:#0b0b0b;padding:12px;display:flex;gap:12px;align-items:flex-start;font:15px system-ui,sans-serif;color:#ddd">
${imgs.map((m) => `<div style="width:${w}px"><img src="${m.src}" style="width:${w}px;display:block;outline:1px solid #222"><div style="padding:6px 2px">${m.label}</div></div>`).join('')}</body></html>`);
await page.waitForLoadState('load');
const out = path.resolve(a.out || 'out/compare.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('对比图 → ' + out);
