#!/usr/bin/env node
// 新建影片工程：复制运行时（motion.js + kit.js）、布线示例、字体（首次使用自动在线下载，再子集化），并生成字幕稿模板与时间轴
// 用法：node new_film.mjs <项目目录> [--ratio 16x9|9x16|1x1|4x5] [--fonts all|sans|serif|none]
// 字体：IBM Plex Sans SC（Plex）+ 思源宋体 SC（HanSerif）全部字重；地址见 assets/fonts/fonts.json，首次使用自动下载到 <skill>/assets/fonts/（不进 git）
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './_pw.mjs';

const a = parseArgs(process.argv.slice(2));
const dir = a._[0];
if (!dir) { console.error('用法：node new_film.mjs <项目目录> [--ratio 9x16]'); process.exit(1); }
const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, '..');
const film = path.resolve(dir, 'film');
if (fs.existsSync(path.join(film, 'index.html'))) { console.error('已存在 ' + film + '/index.html，不覆盖'); process.exit(1); }
fs.mkdirSync(path.join(film, 'fonts'), { recursive: true });
for (const f of ['motion.js', 'kit.js', 'geo.js', 'cover.html']) fs.copyFileSync(path.join(skill, 'assets/starter', f), path.join(film, f));
fs.copyFileSync(path.join(skill, 'assets/geo/world110.js'), path.join(film, 'world110.js'));   // Natural Earth 110m（公有领域）点阵与海岸线
let html = fs.readFileSync(path.join(skill, 'assets/starter/index.html'), 'utf8');
const ratio = a.ratio || '16x9';
if (!['16x9', '9x16', '1x1', '4x5'].includes(ratio)) { console.error('ratio 只支持 16x9 / 9x16 / 1x1 / 4x5（其他尺寸直接改 SIZES）'); process.exit(1); }
html = html.replace("get('ratio') || '16x9'", `get('ratio') || '${ratio}'`);
const py = process.platform === 'win32' ? 'python' : 'python3';
const which = a.fonts || 'all';
if (!['all', 'sans', 'serif', 'none'].includes(which)) { console.error('--fonts 只支持 all / sans / serif / none'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(skill, 'assets/fonts/fonts.json'), 'utf8')).fonts;
const want = manifest.filter((f) => which === 'all' || (which === 'sans' && f.family === 'Plex') || (which === 'serif' && f.family === 'HanSerif'));
let pick = [];
if (want.length) {
  // 首次使用：字体不随 skill 分发，按 fonts.json 的地址在线下载（只下一次）
  const fetch = spawnSync(py, [path.join(here, 'fonts.py'), '--fetch'], { stdio: 'inherit' });
  const chk = spawnSync(py, [path.join(here, 'fonts.py'), '--check'], { encoding: 'utf8' });
  let found = {};
  try { found = JSON.parse(chk.stdout).found; } catch { console.warn('读取字体状态失败：' + (chk.stderr || chk.error)); }
  for (const f of want) if (found[f.file]) { fs.copyFileSync(found[f.file], path.join(film, 'fonts', f.file)); pick.push(f.file); }
  const miss = want.filter((f) => !found[f.file]);
  if (fetch.status !== 0 || miss.length) console.warn(`⚠ 有 ${miss.length} 个字体缺失：${miss.map((f) => f.file).join(', ')}
  联网后重跑 python ${path.join(here, 'fonts.py')} --fetch，再把字体复制进 film/fonts/ 并重跑 fonts.py film/`);
}
// 只给拿到了的字体写 @font-face（缺字体时页面会报错而不是静默换成系统字体）
const faces = manifest.filter((f) => pick.includes(f.file)).map((f) => `  @font-face { font-family: '${f.family}'; src: url('fonts/${f.file}'); font-weight: ${f.weight}; }`).join('\n');
html = html.replace(/  <!-- @fonts -->/, faces);
fs.writeFileSync(path.join(film, 'index.html'), html);
for (const d of ['work', 'out']) fs.mkdirSync(path.resolve(dir, d), { recursive: true });
const copyDoc = path.resolve(dir, 'work/文案与封面.md');
if (!fs.existsSync(copyDoc)) fs.copyFileSync(path.join(skill, 'assets/starter/copy_template.md'), copyDoc);
const lines = path.resolve(dir, 'work/lines.json');
if (!fs.existsSync(lines)) fs.writeFileSync(lines, JSON.stringify({ start: 0.3, tail: 2.5, lines: [
  { id: 'o1', text: '开头金句：一个[反常识]的结论', hook: true },
  { id: 'o2', text: '一句悬念，让人想知道[为什么]', hook: true, pause: 0.2 },
  { id: 'T', text: '片名', card: true, hold: 3.2 },
] }, null, 1));
spawnSync(py, [path.join(here, 'timeline.py'), lines, '--film', film], { stdio: 'ignore' });
if (pick.length) {
  const r = spawnSync(py, [path.join(here, 'fonts.py'), film], { encoding: 'utf8' });
  if (r.status !== 0) console.warn('字体子集化失败（需要 fontTools：pip install fonttools）：\n' + (r.stderr || r.error));
}
console.log(`已创建 ${film}（${ratio}）
  字体：${pick.length} 个（Plex = IBM Plex Sans SC，HanSerif = 思源宋体；已子集化，改了屏上文字后重跑 fonts.py）
  字幕字体：按内容在 Plex 与 HanSerif 之间选（lines.json 顶层或单句 "font": "sans" | "serif"）
  字幕稿模板：work/lines.json（写好后跑 timeline.py 生成 film/timing.js）
  封面：film/cover.html（横版 4K + 竖版 4K，代码绘制）；文案模板 work/文案与封面.md；成片后跑 cover.mjs 出图
  预览：浏览器直接打开 film/index.html（空格播放、←/→ 逐帧、Shift+←/→ 1 秒、L 循环当前场景）
  ⚠ index.html 是布线示例：视觉系统（palette、环境、主体画法、字体）必须按方向重设`);
