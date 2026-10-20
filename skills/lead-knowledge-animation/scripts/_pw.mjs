// 公共工具：解析 playwright（项目本地 → 全局 npm）、启动浏览器、打开影片页面、像素比对
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export function loadPlaywright() {
  const tries = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];
  try { tries.push(execSync('npm root -g', { encoding: 'utf8' }).trim()); } catch {}
  for (const base of tries) {
    try { return createRequire(path.join(base, 'noop.js'))('playwright'); } catch {}
    try { return createRequire(path.join(base, 'noop.js'))(path.join(base, 'playwright')); } catch {}
  }
  throw new Error('找不到 playwright：在影片目录执行 `npm i -D playwright && npx playwright install chromium`，或全局安装。');
}

export function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith('--')) a[key] = true; else { a[key] = nxt; i++; }
    } else a._.push(k);
  }
  return a;
}

export function fileUrl(p) {
  if (/^https?:\/\//.test(p)) return p;
  return pathToFileURL(path.resolve(p)).href;
}

function buildUrl(htmlPath, query) {
  const u = fileUrl(htmlPath);
  const q = ['render=1', query].filter(Boolean).join('&');
  return u + (u.includes('?') ? '&' : '?') + q;
}

const FONT_ERR = /OTS parsing error|Failed to decode downloaded font/i;

async function loadPage(browser, url, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const errors = [], fontErrors = [];
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')));
  page.on('console', (m) => {
    const tx = m.text();
    if (FONT_ERR.test(tx)) fontErrors.push(tx);
    else if (m.type() === 'error') errors.push(tx);
  });
  page.on('requestfailed', (r) => errors.push(`资源加载失败：${r.url()} (${r.failure()?.errorText})`));
  await page.goto(url);
  try {
    // 页面一报错就立刻失败（不要傻等 30 秒）
    await Promise.race([
      page.waitForFunction(() => window.__MOTION && window.__MOTION_READY, null, { timeout: 30000 }),
      new Promise((_, rej) => page.on('pageerror', (er) => rej(new Error('页面脚本报错')))),
    ]);
    await page.evaluate(() => window.__MOTION_READY);
  } catch (e) {
    const hint = [...fontErrors, ...errors].slice(0, 8).join('\n  ') || '（页面没有报错：确认 index.html 引入了 motion.js 并调用了 M.film）';
    throw new Error(`影片页面没能就绪：${String(e.message).split('\n')[0]}\n  页面信息：\n  ${hint}${fontErrors.length ? '\n  → 字体问题：python <skill>/scripts/fonts.py film/' : ''}`);
  }
  // 预热：第一次合成时 GPU/字体/图片解码缓存尚未就绪，扔掉一张截图
  for (const f of [0, .5, .25, .75, .1]) { await page.evaluate((k) => window.seek(window.__MOTION.duration * k), f); await page.screenshot({ type: 'png' }); }
  // 字体检查：声明过的 @font-face 加载失败时直接报错（否则会静默换成系统字体）
  const fstat = await page.evaluate(() => [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, status: f.status })));
  const bad = fstat.filter((f) => f.status === 'error');
  if (bad.length || fontErrors.length) {
    throw new Error(`字体加载失败（页面会静默换成系统字体）：${bad.map((f) => f.family + ' ' + f.weight).join(', ')}\n  ${fontErrors.slice(0, 3).join('\n  ')}\n  处理：python <skill>/scripts/fonts.py film/  （子集化 skill 自带字体，改了屏上文字后重跑）`);
  }
  const unused = fstat.filter((f) => f.status === 'unloaded');
  if (unused.length && scale !== 1) {} // 只在主页面提示一次
  return { ctx, page, errors, unused };
}

export async function openFilm(chromium, htmlPath, { scale = 1, query = '' } = {}) {
  const browser = await chromium.launch({
    args: ['--font-render-hinting=none', '--disable-lcd-text', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--use-angle=default', '--enable-unsafe-swiftshader'],
  });
  const url = buildUrl(htmlPath, query);
  try {
    const probe = await loadPage(browser, url, { width: 800, height: 600 }, 1);
    const meta = await probe.page.evaluate(() => window.__MOTION);
    if (probe.unused.length && !openFilm.warned) {
      openFilm.warned = true;
      console.warn(`提示：这些字体声明了但首帧没用到，首次出现可能晚加载：${probe.unused.map((f) => f.family + ' ' + f.weight).join(', ')}。在影片里 M.wait(document.fonts.load('700 100px 字族')) 预载。`);
    }
    await probe.ctx.close();
    const { page, errors } = await loadPage(browser, url, { width: meta.width, height: meta.height }, scale);
    return { browser, page, meta, errors };
  } catch (e) { await browser.close(); throw e; }
}

/** 渲染 t 时刻并截图。frameT = 该帧的中心时刻（运动模糊的子帧渲染时传入，影片里用 M.frameT 让某层不参与模糊） */
export async function shot(page, meta, t, file, frameT, clip) {
  await page.evaluate(([tt, ft]) => window.seek(tt, ft), [t, frameT ?? t]);
  const buf = await page.screenshot({ type: 'png', clip: clip || { x: 0, y: 0, width: meta.width, height: meta.height }, animations: 'disabled', caret: 'hide' });
  if (file) fs.writeFileSync(file, buf);
  return buf;
}

/** 在浏览器里比较两张 PNG：最大通道差、差异像素数、差异包围盒 */
export async function diffPng(browser, a, b) {
  const p = await browser.newPage();
  const r = await p.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(x), load(y)]);
    const c = new OffscreenCanvas(A.width, A.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, A.width, A.height).data;
    g.clearRect(0, 0, A.width, A.height); g.drawImage(B, 0, 0); const db = g.getImageData(0, 0, A.width, A.height).data;
    let max = 0, n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > 0) { n++; const px = (i / 4) % A.width, py = Math.floor(i / 4 / A.width); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
      if (d > max) max = d;
    }
    return { max, n, total: da.length / 4, box: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null };
  }, [a.toString('base64'), b.toString('base64')]);
  await p.close();
  return r;
}

export function ffmpegBin() {
  const e = process.env.MOTION_FFMPEG || process.env.FFMPEG;
  try { if (e && fs.statSync(e).isFile()) return e; } catch {}
  return 'ffmpeg';
}
