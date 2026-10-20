#!/usr/bin/env node
// 从影片导出声音事件表（与画面同一份时间）：node cues.mjs film/index.html > work/cues.json
import { loadPlaywright, parseArgs, openFilm } from './_pw.mjs';
const a = parseArgs(process.argv.slice(2));
const { chromium } = loadPlaywright();
const { browser, meta } = await openFilm(chromium, a._[0], { scale: 0.25 });
await browser.close();
process.stdout.write(JSON.stringify({ duration: meta.duration, fps: meta.fps, beats: meta.beats, scenes: meta.scenes, cues: meta.cues }, null, 2));
