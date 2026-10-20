#!/usr/bin/env python
"""审片包：把草稿 MP4 变成一份独立审片人能“看到运动”的材料。

审片子 agent 只能看图片，看不到运动和转场。这个脚本把运动也变成图片：
  1. 对照联系表（每格 2 秒）
  2. 关键帧原尺寸（每个场景/字幕句的中点，最多 24 张，拼成 4 列大图）
  3. 转场条带：每个场景切换点前后 0.6 秒、每 0.1 秒一格（看转场是否干净、是否叠化残影）
  4. 运动条带：每个场景内部取 1 秒、每 0.1 秒一格（看主体有没有在动、动得顺不顺）
  5. review.md：给审片人的说明（评分维度、需要特别检查的项）

用法：python review_pack.py out/draft.mp4 --film film/ --out out/review_r1 [--ref-dir <你自己的达标样例目录>]
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, json, os, re, subprocess, shutil

def run(args): subprocess.run(['ffmpeg', '-y', '-v', 'error', *args], check=False)

def timing(film):
    p = os.path.join(film, 'timing.js')
    if not os.path.exists(p): return []
    s = open(p, encoding='utf-8').read()
    m = re.search(r'window\.TIMING\s*=\s*(\{.*?\});', s, re.S)
    return json.loads(m.group(1))['lines'] if m else []

def strip(video, t0, t1, step, out, w=320):
    n = max(1, int(round((t1 - t0) / step)))
    run(['-ss', f'{max(0, t0):.3f}', '-t', f'{t1 - t0:.3f}', '-i', video, '-vf', f'fps={1 / step},scale={w}:-2,tile={n}x1:padding=2:color=0x222222', '-frames:v', '1', out])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('--film', default='film'); ap.add_argument('--out', default='out/review')
    ap.add_argument('--ref-dir', default='', help='可选：自己此前做过的达标成片的联系表/关键帧目录（*.png），会随审片包一起给审片人')
    ap.add_argument('--scenes', default='', help='场景起点（秒，逗号分隔）；缺省用 timing.js 里的片名卡与 at 句')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.video], capture_output=True, text=True).stdout.strip() or 0)
    lines = timing(a.film)
    rows = int(dur / 2 / 9) + 1
    run(['-i', a.video, '-vf', f'fps=1/2,scale=300:-2,tile=9x{rows}:padding=2', '-frames:v', '1', os.path.join(a.out, '1_对照联系表.png')])
    # 关键帧
    mids = [(l['start'] + l['end']) / 2 for l in lines] or [dur * (i + .5) / 16 for i in range(16)]
    if len(mids) > 24: mids = [mids[int(i * len(mids) / 24)] for i in range(24)]
    kdir = os.path.join(a.out, 'keyframes'); os.makedirs(kdir, exist_ok=True)
    for i, t in enumerate(mids): run(['-ss', f'{t:.3f}', '-i', a.video, '-frames:v', '1', '-vf', 'scale=960:-2', os.path.join(kdir, f'k{i:02d}_{t:06.2f}s.png')])
    run(['-pattern_type', 'glob', '-i', os.path.join(kdir, 'k*.png').replace('\\', '/'), '-vf', 'tile=4x6:padding=4:color=0x111111', '-frames:v', '1', os.path.join(a.out, '2_关键帧.png')]) if os.name != 'nt' else None
    if os.name == 'nt':  # Windows 的 ffmpeg 不支持 glob：用 concat 列表
        lst = os.path.join(kdir, 'list.txt'); open(lst, 'w', encoding='utf-8').write(''.join(f"file '{os.path.abspath(os.path.join(kdir, f))}'\n" for f in sorted(os.listdir(kdir)) if f.endswith('.png')))
        run(['-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'tile=4x6:padding=4:color=0x111111', '-frames:v', '1', os.path.join(a.out, '2_关键帧.png')])
    # 场景切换点
    cuts = [float(x) for x in a.scenes.split(',') if x] or sorted({l['start'] for l in lines if (l.get('scene') or l.get('card')) and l['start'] > .5})
    if not cuts: print('  ! 没找到场景起点：在 lines.json 里给每个新场景的首句加 "scene": true（或用 --scenes 指定）')
    tdir = os.path.join(a.out, 'transitions'); os.makedirs(tdir, exist_ok=True)
    for t in cuts: strip(a.video, t - .6, t + .6, .1, os.path.join(tdir, f'tr_{t:06.2f}s.png'), 240)
    mdir = os.path.join(a.out, 'motion'); os.makedirs(mdir, exist_ok=True)
    seg = [0] + cuts + [dur]
    for i in range(len(seg) - 1):
        m = (seg[i] + seg[i + 1]) / 2
        strip(a.video, m - .5, m + .5, .1, os.path.join(mdir, f'mo_{m:06.2f}s.png'), 240)
    ref = os.path.abspath(a.ref_dir)
    rdir = os.path.join(a.out, 'ref'); os.makedirs(rdir, exist_ok=True)
    refs = []
    if a.ref_dir and os.path.isdir(ref):
        for f in sorted(os.listdir(ref)):
            if f.endswith('.png'): shutil.copy(os.path.join(ref, f), os.path.join(rdir, f)); refs.append('ref/' + f)
    # 字幕稿与分镜一起放进审片包（审片人只拿到这个目录）
    proj = os.path.dirname(os.path.abspath(a.film))
    for src in ['work/lines.json', 'work/film.md']:
        p = os.path.join(proj, src)
        if not os.path.exists(p): continue
        if p.endswith('film.md'):   # 去掉自评与审片记录，避免影响独立审片
            txt = open(p, encoding='utf-8').read()
            txt = re.split(r'\n#+\s*(修改记录|审片|自评|打分|第\s*\d\s*轮)', txt)[0]
            txt = '\n'.join(l for l in txt.splitlines() if not re.search(r'(自评|独立审片|打分|分数|/\s*10\b|差距\s*\d)', l))
            open(os.path.join(a.out, 'film.md'), 'w', encoding='utf-8').write(txt)
        else: shutil.copy(p, os.path.join(a.out, os.path.basename(p)))
    open(os.path.join(a.out, 'review.md'), 'w', encoding='utf-8').write(f"""# 审片说明（给独立审片人）

你是一位挑剔的资深知识动画导演，没参与制作。目标风格是发光线描式的知识讲解动画（风格要点：近黑底 + 一个主色相、大而亮的有材质主角、底部单行字幕、一句一变、开头 5 秒金句）。

## 材料
- 本片对照联系表（每格 2 秒）：1_对照联系表.png
- 本片关键帧（每句字幕中点）：2_关键帧.png，原图在 keyframes/
- 转场条带（每个场景切换前后 0.6 秒，每格 0.1 秒）：transitions/
- 运动条带（每个场景中段 1 秒，每格 0.1 秒）：motion/
- 达标样例（可选）：{chr(10).join('  - ' + r for r in refs) or '  （无，按下面的评分标准和必查项独立判断）'}
- 字幕稿：lines.json；分镜与出处：film.md（都在本目录）

## 评分（每项 1–10，写出具体时间点）
故事清晰、开头、丰富度、设计秩序、变化频率、运动质感（看 motion/）、转场（看 transitions/）、完成度，以及**与目标风格的接近程度（10 = 开头、丰富度、设计秩序、信息预算都完全达标）**。

## 必查
1. 开头：金句是否在前 5 秒内用大字出完？冷开场是否“一个主体 + 金句大字 + 一束光”，主体是否大到占满画面？有没有信息层抢戏？
2. 每帧小字：除字幕外，画面上超过 3 处小字（标注/读数/英文）就算过多。目标是每帧只有 1 个主角 + 1–2 处标注。
3. 主角：是否单一、够大（30–60%）、有材质？是否有“多个同等大小的东西并列”的松散构图？
4. 亮度：是否“暗底上一个很亮的主角”？整体过亮、雾太多也算问题。
5. 转场：transitions/ 里有没有两层画面叠在一起的残影、有没有突兀跳变？
6. 运动：motion/ 里 10 格是否几乎一样（死画面）？运动是否有缓动、有重量？
7. 长停留：联系表里连续 3 格几乎一样的地方。
8. 字幕：是否单行、不出屏、字号统一（52px，强调加粗或换色）？句末是否没有标点？字体（Plex 或思源宋体）是否贴合内容气质、全片是否统一？

最后列出影响最大的 5 条修改建议（每条带时间点和具体做法），按影响排序。
""")
    print(f'审片包 → {a.out}（对照联系表、关键帧 {len(mids)} 张、转场条带 {len(cuts)} 条、运动条带 {len(seg) - 1} 条、review.md）')

if __name__ == '__main__':
    main()
