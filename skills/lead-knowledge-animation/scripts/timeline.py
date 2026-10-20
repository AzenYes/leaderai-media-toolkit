#!/usr/bin/env python
"""文字叙事时间轴：逐句字幕稿 → film/timing.js（没有配音，字幕就是“旁白”）

知识讲解动画的骨架是一句一句的字幕：每句出现在底部（逐字显现），画面跟着这句话变化。
每句停留时长按阅读速度自动计算：hold = base + 字数 / cps（经验值：约 2.5–3.5 秒一句）。

lines.json（work/lines.json）：
{
  "start": 0.3,          // 第一句出现时间（开头要快：0.2–0.4）
  "tail": 3.0,           // 最后一句之后留多久（片名再现 / 定版）
  "cps": 6.0,            // 阅读速度（字/秒），默认 6；信息密的片子可降到 5
  "base": 0.9,           // 每句固定的“看一眼”时间
  "gap": 0.3,            // 句与句之间字幕带空白（上一句提前 0.26s 退场，需 ≥0.3）
  "font": "sans",        // 全片字幕字体："sans" = IBM Plex Sans SC，"serif" = 思源宋体（按内容选，见 叙事与字幕.md）
  "lines": [
    {"id": "o1", "text": "你每天解锁手机[96 次]", "hook": true},
    {"id": "o2", "text": "第三名，却[笑得像赢了]", "hook": true, "pause": 0.2},
    {"id": "T",  "text": "注意力的价格", "card": true, "hold": 3.2},     // 片名卡/章节卡：不进字幕带，画面中央大字
    {"id": "c1", "text": "某年，研究者[记录了]一千个人的[屏幕时间]", "at": 14.0},
    {"id": "c2", "text": "...", "hold": 4.0, "font": "serif"}         // hold：手动指定停留；font：单句换字体（少用）
  ]
}
  句末不带标点：每句最后的 。，、；：！？…—～ 等会被自动去掉（引号、书名号等成对的收尾符号保留）
  [ ] 高亮关键词；pause 本句后额外留白；at 不早于此刻出现（卡在音乐段落/大转场上）
  scene true：这一句开始一个新场景（片名卡、带 at 的句也自动算场景起点）——review_pack 据此做转场条带
  card true：片名卡、章节标题、无字幕的纯画面段（cap=false），时长用 hold（默认 2.5s）
  hook true：开头金句（1–2 句）。画面中下部大字显示（约 104px），不进字幕带；必须在前 5 秒内全部出现完毕
  beats.json 可选：--beats work/beats.json 把每句的起点吸附到最近的拍点（±0.18s 内），让切换踩在音乐上

用法：python timeline.py work/lines.json --film film/ [--beats work/beats.json]
产物：film/timing.js → window.TIMING = {total, lines:[{id,start,end,text,cap,card,font}]}；window.L = {id: line}
     画面里所有时间都写成 L.<id>.start + 偏移；改稿后重跑，画面自动对齐。
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, json, os, re

TRAIL = set('。．.，,、；;：:！!？?…—–-~～·')
CLOSE = set('”’」』》〉）)】]')   # 成对符号的收尾（含 [高亮] 的 ]）保留，只去掉它前面的标点
FONTS = {'sans', 'serif'}

def strip_end(text):
    """去掉句末标点：'你知道[为什么？]' → '你知道[为什么]'，'……他说。”' → '……他说”'"""
    s = text.rstrip()
    while True:
        j = len(s)
        while j > 0 and (s[j - 1] in CLOSE or s[j - 1].isspace()): j -= 1
        k = j
        while k > 0 and s[k - 1] in TRAIL: k -= 1
        if k == j: return s
        s = (s[:k] + s[j:]).rstrip()

def count(text):
    return len(re.sub(r'[\s\[\]{}<>|，。、：；！？,.!?“”"「」『』（）()—…·-]', '', text))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lines'); ap.add_argument('--film', required=True); ap.add_argument('--beats')
    ap.add_argument('--music-start', type=float, default=0, help='音乐从原曲第几秒开始用（与 mix.py --music-start 一致），拍点会相应平移')
    a = ap.parse_args()
    spec = json.load(open(a.lines, encoding='utf-8'))
    cps, base, gap = float(spec.get('cps', 6.0)), float(spec.get('base', 0.9)), float(spec.get('gap', 0.3))
    beats = []
    if a.beats and os.path.exists(a.beats):
        b = json.load(open(a.beats, encoding='utf-8')); beats = [x - a.music_start for x in b.get('beats', []) if x >= a.music_start]
    def snap(t):
        if not beats: return t
        near = min(beats, key=lambda x: abs(x - t))
        return near if abs(near - t) <= 0.18 else t
    t = float(spec.get('start', 0.3)); out = []; prev_end = -1; stripped = []
    font_all = spec.get('font')
    for ln in spec['lines']:
        card = bool(ln.get('card'))
        if not card:
            for key in ('text', 'cap'):
                if isinstance(ln.get(key), str):
                    s2 = strip_end(ln[key])
                    if s2 != ln[key]: stripped.append(ln['id']); ln[key] = s2
        font = ln.get('font', font_all)
        if font and font not in FONTS: print(f"  · {ln['id']} 的 font={font!r} 不是 sans/serif，按字族名直接使用")
        n = count(ln['text'])
        hook = bool(ln.get('hook'))
        hold = float(ln['hold']) if 'hold' in ln else (2.5 if card else max(1.5, .5 + n / 8) if hook else max(1.6, base + n / cps))
        if ln.get('at') is not None: t = max(t, float(ln['at']))
        ts = snap(t); t = ts if ts >= prev_end + gap * .5 else t   # 吸附不能让句子和上一句重叠
        out.append(dict(id=ln['id'], start=round(t, 3), end=round(t + hold, 3), text=ln['text'],
                        cap=(False if card else ln.get('cap', True)), card=card, n=n,
                        scene=bool(card or ln.get('scene') or ln.get('at') is not None), hook=hook))
        if font: out[-1]['font'] = font
        prev_end = t + hold; t += hold + gap + float(ln.get('pause', 0))
    total = round(out[-1]['end'] + float(spec.get('tail', 3.0)), 3)
    if stripped: print(f"  · 已去掉句末标点（字幕句末不带标点）：{', '.join(dict.fromkeys(stripped))}——建议同步改掉 lines.json")
    # 检查：开头金句 5 秒内出完；单行宽度（字幕 52px、金句 104px，按 1920 宽估算）
    hooks = [l for l in out if l['hook']]
    if not hooks: print('  ! 没有标 hook 的开头金句：前 5 秒要用大字给出一句结论或悬念（"hook": true）')
    elif hooks[0]['start'] > 1.0 or hooks[-1]['start'] + hooks[-1]['n'] / 22 + .5 > 5.0: print(f"  ! 开头金句太慢：第一句 {hooks[0]['start']}s 出现、最后一句 {hooks[-1]['start']}s 开始——要在前 5 秒内全部出完（减少字数、调小 start/pause）")
    def width(txt, size):
        import unicodedata
        w = 0
        for ch in re.sub(r'[\[\]{}<>|]|#[0-9a-fA-F]{6}', '', txt):
            w += size * (1.0 if unicodedata.east_asian_width(ch) in 'WF' else .58) + size * .05
        return w
    for l in out:
        if l['card']: continue
        size, lim = (104, 1920 * .9) if l['hook'] else (52, 1920 * .86)
        w = width(l['text'], size)
        if w > lim: print(f"  ! 单行过长（约 {w:.0f}px > {lim:.0f}px，会被自动缩小）：{l['id']} {l['text']} → 建议拆成两句")
    js = 'window.TIMING = ' + json.dumps({'total': total, 'lines': out}, ensure_ascii=False, indent=1) + ';\n'
    js += 'window.L = Object.fromEntries(window.TIMING.lines.map((l) => [l.id, l]));  // L.o1.start / L.o1.end\n'
    os.makedirs(a.film, exist_ok=True)
    open(os.path.join(a.film, 'timing.js'), 'w', encoding='utf-8').write(js)
    for l in out:
        tag = '［卡］' if l['card'] else ('［金句］' if l['hook'] else '')
        print(f"  {l['id']:>5}  {l['start']:7.2f}–{l['end']:7.2f}s  {l['end'] - l['start']:4.1f}s  {tag}{l['text']}")
    print('  提醒：改稿或重跑 timeline 之后，句子时间会变——要重新导出 cues（cues.mjs）并重新混音（mix.py），否则音效错位')
    caps = [l for l in out if l['cap']]
    print(f"总长 {total}s · {len(out)} 句（字幕 {len(caps)} 句，平均 {sum(l['end'] - l['start'] for l in caps) / max(1, len(caps)):.1f}s/句）→ {os.path.join(a.film, 'timing.js')}")

if __name__ == '__main__':
    main()
