#!/usr/bin/env python
"""成片体检：只拦“硬伤”，不替代人眼。所有“提示”都是让你去看那一刻，而不是错误本身。

检查：
  1. 时长 / 帧率 / 帧数 / 音轨（帧数≈时长×帧率）
  2. 死区：连续一段画面几乎不变（默认 >2.5s，按 6×6 分区里最活跃的一格判断）；用 --holds 声明有意的停留
  3. 单帧跳变：某帧变化量是相邻帧的 3 倍以上——闪帧、层级错乱、转场接缝
  4. 黑/白闪帧
  5. 运动占比：明显运动的帧所占比例（太低＝像幻灯片；太高＝可能太躁）
  6. 响度与峰值（有音轨时）
  7. 联系表：每 0.5s 一格，交付前必须亲眼看

用法：python qa_video.py out/final.mp4 [--sheet out/qa_sheet.png] [--dead 2.5] [--holds 3.0-4.5,9-10] [--cuts 5.0,10.2,49.5-51.2]
  --cuts 可以写时刻或区间（区间用于 12fps 步进、倒放这类有意的逐帧跳变）
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, json, subprocess, re, os
import numpy as np

def probe(path, tries=6):
    import time
    for _ in range(tries):  # 渲染脚本可能还在封装 MP4：等它写完
        js = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], capture_output=True, text=True, encoding='utf-8').stdout or '{}')
        if js.get('streams'): break
        time.sleep(10)
    return _probe(js)

def _probe(js):
    v = next(s for s in js['streams'] if s['codec_type'] == 'video')
    a = [s for s in js['streams'] if s['codec_type'] == 'audio']
    num, den = map(int, v['r_frame_rate'].split('/'))
    return dict(w=v['width'], h=v['height'], fps=num / den, frames=int(v.get('nb_frames', 0) or 0),
                dur=float(js['format']['duration']), audio=bool(a), pix=v.get('pix_fmt'))

def frames_gray(path, fps, w=192):
    h = None
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:-2,format=gray', '-f', 'rawvideo', '-'],
                       capture_output=True, check=True).stdout
    info = probe(path); h = int(round(info['h'] * w / info['w'] / 2) * 2)
    arr = np.frombuffer(p, dtype=np.uint8)
    return arr.reshape(-1, h, w).astype(np.float32)

def ranges(s):
    out = []
    for part in filter(None, (s or '').split(',')):
        a, b = part.split('-'); out.append((float(a), float(b)))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('--sheet'); ap.add_argument('--dead', type=float, default=2.5)
    ap.add_argument('--holds', default=''); ap.add_argument('--cuts', default='')
    ap.add_argument('--film', default='film', help='影片目录：自动读取 timing.js 的场景起点，作为有意的硬切/闪白（免得被报成单帧跳变）')
    ap.add_argument('--ref-sheet', help='再输出一张每格 2 秒、宽 300、每行 9 格的“对照联系表”，方便看全片节奏、多版本并排')
    a = ap.parse_args()
    info = probe(a.video)
    fps = info['fps']
    print(f"■ {a.video}\n  {info['w']}×{info['h']} · {fps:.3f}fps · {info['dur']:.3f}s · 帧数 {info['frames']} · {info['pix']} · 音轨 {'有' if info['audio'] else '无'}")
    exp = info['dur'] * fps
    if info['frames'] and abs(info['frames'] - exp) > 2: print(f'  ✗ 帧数与时长×帧率不符（期望≈{exp:.0f}）')
    if info['pix'] != 'yuv420p': print('  ! 像素格式不是 yuv420p，部分平台/播放器会出问题')

    g = frames_gray(a.video, fps)
    d = np.abs(np.diff(g, axis=0)).mean(axis=(1, 2))  # 每帧平均变化量（0–255）
    t = (np.arange(len(d)) + 1) / fps
    holds = ranges(a.holds)
    tj = os.path.join(a.film, 'timing.js')
    if os.path.exists(tj):
        m = re.search(r'window\.TIMING\s*=\s*(\{.*?\});', open(tj, encoding='utf-8').read(), re.S)
        if m:
            auto = [l['start'] for l in json.loads(m.group(1))['lines'] if l.get('scene') or l.get('card')]
            a.cuts = ','.join(filter(None, [a.cuts] + [f'{x - .3:.2f}-{x + 1.2:.2f}' for x in auto]))
    cut_ranges = [(float(x.split('-')[0]), float(x.split('-')[1])) if '-' in x else (float(x), float(x)) for x in filter(None, a.cuts.split(','))]
    in_hold = lambda x: any(s <= x <= e for s, e in holds)
    near_cut = lambda x: any(s - 1.5 / fps <= x <= e + 1.5 / fps for s, e in cut_ranges)

    # 活跃度：按 15fps 重采样（与渲染帧率、运动模糊无关），取 6×6 分区里变化最大的一格
    # ——细线主体、大面积纯色背景的片子也能被正确判断
    step = max(1, int(round(fps / 15)))
    gs = g[::step]
    hh, ww = gs.shape[1] // 6 * 6, gs.shape[2] // 6 * 6
    dd = np.abs(np.diff(gs[:, :hh, :ww], axis=0)).reshape(len(gs) - 1, 6, hh // 6, 6, ww // 6).mean(axis=(2, 4))
    act = dd.max(axis=(1, 2))                 # 每个采样点最活跃分区的变化量
    ts = (np.arange(len(act)) + 1) * step / fps
    sfps = fps / step

    # 死区（扣掉 --holds 声明的有意停留后，剩余连续部分仍 ≥ --dead 才报）
    still = act < 0.6
    for k, x in enumerate(ts):
        if in_hold(x): still[k] = False
    dead, i = [], 0
    while i < len(still):
        if still[i]:
            j = i
            while j < len(still) and still[j]: j += 1
            if (j - i) / sfps >= a.dead: dead.append((ts[i] - 1 / sfps, ts[j - 1]))
            i = j
        else: i += 1
    print(f"  {'✓' if not dead else '!'} 死区（>{a.dead}s 几乎无变化，已扣除 holds）：" + (', '.join(f'{x:.2f}–{y:.2f}s' for x, y in dead) or '无'))

    # 单帧跳变
    spikes = []
    for k in range(2, len(d) - 2):
        nb = np.median(np.r_[d[k - 2:k], d[k + 1:k + 3]])
        if d[k] > 6 and d[k] > 3 * max(nb, 0.8) and not near_cut(t[k]): spikes.append((t[k], d[k], nb))
    print(f"  {'✓' if not spikes else '!'} 单帧跳变（去看：是有意的硬切，还是闪帧/接缝）：" +
          (', '.join(f'{x:.3f}s({v:.0f}/{n:.1f})' for x, v, n in spikes[:12]) or '无'))

    # 黑/白闪帧
    mean = g.mean(axis=(1, 2))
    flash = [k / fps for k in range(1, len(mean) - 1) if (mean[k] < 6 or mean[k] > 249) and abs(mean[k] - mean[k - 1]) > 40]
    print(f"  {'✓' if not flash else '!'} 黑/白闪帧：" + (', '.join(f'{x:.3f}s' for x in flash[:10]) or '无'))

    # 运动占比（分区口径）
    moving = float((act > 1.5).mean())
    tag = '偏静：亲眼确认不是幻灯片感' if moving < 0.4 else ('非常满：确认不是在躁、有没有给阅读留停顿' if moving > 0.95 else '正常')
    print(f'  · 有明显运动的时间占比 {moving:.0%}（{tag}；仅供参考，不是目标值）')

    # 每秒活跃度条（快速看节奏起伏：好的片子有起伏，不是一条直线）
    sec = [float(act[int(k * sfps): int((k + 1) * sfps)].mean()) for k in range(int(len(act) / sfps))]
    if sec:
        mx = max(sec) or 1
        bars = ''.join(' ▁▂▃▄▅▆▇█'[min(8, int(8 * v / mx + 0.5))] for v in sec)
        print(f'  · 每秒活跃度  |{bars}|')

    # 亮度指纹（目标区间：p99≈130–146、高亮像素≈1.5–2.4%、均值≈17–20、近黑帧≈17–39%）
    gl = g[::max(1, int(round(fps * 2)))][:, :int(0.85 * g.shape[1])]
    p99 = float(np.median(np.percentile(gl.reshape(len(gl), -1), 99, axis=1)))
    brightp = float(np.median((gl > 110).mean(axis=(1, 2)))) * 100
    meanv = float(np.median(gl.mean(axis=(1, 2))))
    darkf = float(((gl < 18).mean(axis=(1, 2)) > .85).mean())
    low = p99 < 130 or brightp < 1.5 or darkf > .4
    high = meanv > 24 or brightp > 3.5
    ok = not low and not high
    if fps >= 50: print('    （成片带运动模糊时 p99 通常比 30fps 草稿低 2–4，草稿 ≥133 才稳）')
    print(f"  {'✓' if ok else '!'} 亮度指纹：亮部峰值 p99={p99:.0f}（目标 ≥130）· 高亮像素 {brightp:.1f}%（目标 ≈2%，>3.5% 过亮）· 画面均值 {meanv:.0f}（目标 17–20，>24 偏亮）· 近黑帧 {darkf:.0%}（目标 17–39%）")
    if low: print('    → 主体不够亮/不够大：用 K.core 亮核、bloom、放大主体或让纹理铺满背景；见 丰富度与设计秩序.md')
    if darkf < .1: print('    · 近黑帧偏少（目标 17–39%）：奇观之后留暗场呼吸，冷开场先暗后亮')
    if high: print('    → 画面偏亮/发光过多：压暗雾和背景纹理、降低 bloom，让主角之外的区域回到暗底（目标均值 17–20、高亮 ≈2%）')

    if info['audio']:
        err = subprocess.run(['ffmpeg', '-hide_banner', '-i', a.video, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                             capture_output=True, text=True, encoding='utf-8', errors='ignore').stderr
        I = re.findall(r'\bI\x3a\s+(-?[\d.]+) LUFS', err); P = re.findall(r'Peak\x3a\s+(-?[\d.]+) dBFS', err)
        print(f"  · 响度 {I[-1] if I else '?'} LUFS · 真峰值 {P[-1] if P else '?'} dBFS（常用 -14±1 / ≤-1）")
        sil = subprocess.run(['ffmpeg', '-hide_banner', '-i', a.video, '-af', 'silencedetect=n=-50dB:d=0.8', '-f', 'null', '-'],
                             capture_output=True, text=True, encoding='utf-8', errors='ignore').stderr
        ss = re.findall(r'silence_start: ([\d.]+)', sil)
        if ss: print(f'  ! 静音段起点：{", ".join(ss[:8])}（确认是有意留白）')

    if a.ref_sheet: ref_sheet(a.video, a.ref_sheet, info['dur'])
    if a.sheet:
        n = int(info['dur'] * 2)
        cols = 8; rows = (n + cols - 1) // cols
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', a.video, '-vf',
                        f"fps=2,scale=320:-2,tile={cols}x{rows}:padding=4:color=0x111111",
                        '-frames:v', '1', a.sheet], check=False)
        print(f'  联系表 → {a.sheet}（每格 0.5s，从左到右、从上到下；必须亲眼看）')

def ref_sheet(video, out, dur):
    rows = int(dur / 2 / 9) + 1
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-vf', f'fps=1/2,scale=300:-2,tile=9x{rows}:padding=2', '-frames:v', '1', out], check=False)
    print(f'  对照联系表 → {out}（每格 2 秒）')

if __name__ == '__main__':
    main()
