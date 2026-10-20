#!/usr/bin/env node
// 逐帧渲染 → MP4。画面由 window.seek(t) 决定，与机器快慢无关。
// 用法：
//   node render.mjs film/index.html --out out/draft.mp4 [--fps 30] [--scale 0.5]
//        [--from 12 --to 18] [--blur 8 --shutter 0.5] [--workers 4] [--audio mix.wav] [--crf 16] [--keep]
//   --scale    相对设计尺寸的输出倍率（0.5 草稿 / 1 正式 / 2 超清母版）
//   --blur N   每帧 N 个子帧做运动模糊（快动作推荐 8；4 在快动作上会留残影）
//   --shutter  快门角比例（0.5 = 180°），只在 --blur 时有效
//   --from/--to 只渲染这一段（局部修改后用它，不要每次全片重渲）
//   --query    传给影片的 URL 参数（如 "ratio=9x16"），影片可据此切换版式/方向
//   运动模糊时，影片里用 M.frameT 代替 t 的层不参与模糊（滚动数字、需要清晰的小字）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadPlaywright, parseArgs, openFilm, shot, ffmpegBin } from './_pw.mjs';

const a = parseArgs(process.argv.slice(2));
const html = a._[0];
if (!html) { console.error('需要影片 HTML 路径'); process.exit(1); }
const { chromium } = loadPlaywright();

const query = a.query || '';
const probe = await openFilm(chromium, html, { scale: 1, query });
const meta = probe.meta; await probe.browser.close();
const fps = +(a.fps || meta.fps || 30);
const scale = +(a.scale || 1);
const N = Math.max(1, +(a.blur || 1));
const shutter = +(a.shutter || 0.5);
const t0 = +(a.from || 0), t1 = Math.min(+(a.to || meta.duration), meta.duration);
const f0 = Math.round(t0 * fps), f1 = Math.round(t1 * fps); // [f0, f1)
const frames = f1 - f0;
// 默认并发：CPU 核数的一半（上限 16）。截图主要吃 CPU；WebGL 重的片子用 --workers 2–4，避免 GPU 排队
const workers = Math.max(1, Math.min(+(a.workers || Math.min(16, Math.max(2, Math.floor(os.cpus().length / 2)))), frames));
const out = path.resolve(a.out || 'out/render.mp4');
fs.mkdirSync(path.dirname(out), { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-frames-'));
console.log(`渲染 ${t0.toFixed(2)}–${t1.toFixed(2)}s · ${frames} 帧 @${fps}fps · ${Math.round(meta.width * scale)}×${Math.round(meta.height * scale)} · 子帧 ${N} · ${workers} 进程`);

// 子帧时间：以帧时刻为中心，在 shutter/fps 的窗口内均匀分布
const timeOf = (idx) => {
  const f = Math.floor(idx / N), k = idx % N;
  const off = N === 1 ? 0 : ((k + 0.5) / N - 0.5) * (shutter / fps);
  return Math.max(0, Math.min(meta.duration - 1e-6, (f0 + f) / fps + off));
};
const total = frames * N;
const started = Date.now();
let done = 0;
const allErrors = [];

await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const { browser, page, errors } = await openFilm(chromium, html, { scale, query });
  const per = Math.ceil(total / workers);
  const s = w * per, e = Math.min(total, s + per);
  for (let i = s; i < e; i++) {
    await shot(page, meta, timeOf(i), path.join(tmp, `f${String(i).padStart(6, '0')}.png`), (f0 + Math.floor(i / N)) / fps);
    done++;
    if (done % Math.max(30, Math.round(total / 10)) === 0 || done === total) {
      const el = (Date.now() - started) / 1000;
      console.log(`  ${done}/${total}  ${(done / el).toFixed(1)} 张/s  剩余约 ${Math.round((total - done) / (done / el))}s`);
    }
  }
  allErrors.push(...errors);
  await browser.close();
}));
if (allErrors.length) console.warn('页面报错（必须处理）：\n  ' + [...new Set(allErrors)].slice(0, 10).join('\n  '));

const vf = [];
if (N > 1) vf.push(`tmix=frames=${N}`, `select='eq(mod(n\\,${N})\\,${N - 1})'`, `setpts=N/${fps}/TB`);
vf.push('format=yuv420p');
const args = ['-y', '-framerate', String(fps * N), '-i', path.join(tmp, 'f%06d.png')];
if (a.audio) args.push('-ss', String(t0), '-t', String(t1 - t0), '-i', path.resolve(a.audio));
args.push('-vf', vf.join(','), '-r', String(fps), '-c:v', 'libx264', '-preset', a.preset || 'slow', '-crf', String(a.crf || 16),
  '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart');
if (a.audio) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
args.push(out);
const r = spawnSync(ffmpegBin(), args, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 28 });
if (r.status !== 0) { console.error(r.error ? String(r.error) : String(r.stderr).slice(-2000)); process.exit(1); }
if (!a.keep) fs.rmSync(tmp, { recursive: true, force: true }); else console.log('帧保留在 ' + tmp);
console.log(`完成 → ${out}  （用时 ${Math.round((Date.now() - started) / 1000)}s）`);
