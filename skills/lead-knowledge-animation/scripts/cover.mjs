#!/usr/bin/env node
// 封面渲染：用 film/cover.html 输出两张 4K 封面（横版 16:9 + 竖版 3:4），并可叠加安全区参考线做检查
// 用法：
//   node cover.mjs film/cover.html --out out --name 片名
//   输出：<out>/<名称>_封面_横版4K.png（3840×2160）  <out>/<名称>_封面_竖版4K.png（2160×2880）
//   --guides   额外输出安全区检查图（过程文件，不进成果目录）到 <out 的上一级>/work/封面检查/（可用 --check-dir 指定）；红色为边缘区：横版两侧各 12.5% 不放重要内容，核心在中央 4:3
//   --scale 2  相对设计尺寸的倍率（横版设计 1920×1080、竖版设计 1080×1440，默认 2 = 4K）
//   --only land|port   只出一张
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, parseArgs, openFilm, shot } from './_pw.mjs';

const a = parseArgs(process.argv.slice(2));
const html = a._[0];
if (!html) { console.error('用法：node cover.mjs film/cover.html --out out --name 片名 [--guides] [--only land|port]'); process.exit(1); }
const out = path.resolve(a.out || 'out');
const name = a.name || 'cover';
const scale = +(a.scale || 2);
const checkDir = path.resolve(a['check-dir'] || path.join(out, '..', 'work', '封面检查'));
fs.mkdirSync(out, { recursive: true });
if (a.guides) fs.mkdirSync(checkDir, { recursive: true });
const { chromium } = loadPlaywright();

const jobs = [['land', '横版'], ['port', '竖版']].filter(([k]) => !a.only || a.only === k);
for (const [k, label] of jobs) {
  const runs = [[`cover=${k}`, `${name}_封面_${label}4K.png`, out]];
  if (a.guides) runs.push([`cover=${k}&guides=1`, `${name}_封面_${label}_安全区检查.png`, checkDir]);
  for (const [query, file, dir] of runs) {
    const { browser, page, meta, errors } = await openFilm(chromium, html, { scale, query });
    const dest = path.join(dir, file);
    await shot(page, meta, 0, dest, 0);
    await browser.close();
    if (errors.length) console.warn('页面报错：\n  ' + [...new Set(errors)].slice(0, 5).join('\n  '));
    console.log(`${path.relative(process.cwd(), dest)}  ${Math.round(meta.width * scale)}×${Math.round(meta.height * scale)}`);
  }
}
