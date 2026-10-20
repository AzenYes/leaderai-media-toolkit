#!/usr/bin/env node
// 纯函数检查：同一时刻无论怎样跳转，画面必须一致；同时收集页面报错和字体失败。
// 失败通常意味着：Math.random / Date.now / 帧间累积状态 / CSS transition / 未等待的资源 / 共面 3D 层排序不稳定。
// 多层发光、渐变、大面积 mask 的光栅有 ±3–11 的抖动，默认容差 --tol 12 视为一致；大面积渐变 + 发光字 + 密集点阵可到 20–25，用 --tol 26
// 超出容差时打印差异的包围盒，去那块区域找原因。
// 用法：node verify.mjs film/index.html [--samples 9] [--tol 12] [--query "dir=B"]
// 按需生成的缓存（预渲精灵/火焰帧/纹理）请在加载时一次性生成，否则第一次用到时会让 verify 误报“连拍不同”
import { loadPlaywright, parseArgs, openFilm, shot, diffPng } from './_pw.mjs';

const a = parseArgs(process.argv.slice(2));
const { chromium } = loadPlaywright();
const { browser, page, meta, errors } = await openFilm(chromium, a._[0], { scale: 0.5, query: a.query || '' });
const n = +(a.samples || 9), tol = +(a.tol ?? 12);   // 多层发光/渐变的 CPU 光栅有 3–11 的抖动，12 以内视为一致
const D = meta.duration;
let bad = 0, soft = 0;
const ts = Array.from({ length: n }, (_, i) => +(((i + 0.5) / n) * D).toFixed(4));
for (const s of meta.scenes || []) ts.push(+(s.start + 0.001).toFixed(4));
for (const t of ts) {
  const a1 = await shot(page, meta, t);
  const a2 = await shot(page, meta, t);
  await shot(page, meta, (t + D / 2) % D);
  const a3 = await shot(page, meta, t);
  const d12 = await diffPng(browser, a1, a2), d13 = await diffPng(browser, a1, a3);
  const worst = d12.max >= d13.max ? d12 : d13;
  const exact = worst.n === 0;
  const ok = worst.max <= tol;
  if (!ok) bad++; else if (!exact) soft++;
  const info = exact ? '逐像素一致' : `最大差 ${worst.max}，${worst.n} 像素，区域 [x,y,w,h]=${JSON.stringify(worst.box.map((v) => v * 2))}（设计坐标）`;
  console.log(`${ok ? '✓' : '✗'} t=${t.toFixed(3)}s  ${info}${d12.n === 0 && d13.n > 0 ? '  ← 只在“跳转后”不同：帧间状态/累积' : ''}${d12.n > 0 ? '  ← 连拍两次都不同：随机数/时钟/GPU 抖动' : ''}`);
}
const safe = await page.evaluate(() => [...new Set(window.__SAFE || [])]);
if (safe.length) console.log(`! 安全框越界（K.safe）：${safe.slice(0, 20).join('，')}`);
if (errors.length) { bad++; console.log('✗ 页面报错：\n  ' + [...new Set(errors)].join('\n  ')); }
await browser.close();
console.log(bad ? `\n未通过：${bad} 项。先修确定性，再谈审美。` : `\n通过：画面是时间的纯函数${soft ? `（${soft} 处有容差内的光栅抖动，无需处理）` : ''}。`);
process.exit(bad ? 1 : 0);
