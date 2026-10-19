# -*- coding: utf-8 -*-
"""成片字幕：校正文本 × 逐字时间戳 → 断句 → ASS（双层柔和阴影）+ SRT + 断句报告。

python make_subtitles.py --words transcript_rough.json --text subtitle_text.txt --out-dir . \
    [--layout landscape|vertical] [--font IBMPlexSansSC-SemiBold.otf] [--terms terms.txt] [--max-width N]
    [--pos-y N] [--fontname "IBM Plex Sans SC SmBld"]

--layout 画幅（默认 landscape）：
- landscape：3840×2160 画布，字号 192，底部居中（底边 y=2048），单行最宽 2296px（避开右下人物圆环）。
- vertical：2160×3840 画布，字号 144，字幕底边落在距底部约 1/3 处（y=2560），单行最宽 1560px
  （右端停在 x≈1860，避开平台右侧点赞/评论按钮列；底部约 1/4 是平台作者名/标题区，不放字幕）。
--max-width / --pos-y 可覆盖对应画幅的默认值（单位：ASS 画布像素；pos-y 是字幕底边位置）。

subtitle_text.txt：成片里实际说出的话（已改正识别错字、数字用阿拉伯数字），按句写，保留标点。
    可以省略不影响意思的口头填充词，但不能改写观点。
--font 默认用本 skill 自带的 assets/fonts/IBMPlexSansSC-SemiBold.otf，无需每次查找字体位置。
terms.txt（可选）：每行一个不允许被拆开的词（专有名词、成语、数字+单位）。

断句规则（与 video-rough-cut 的字幕规范一致）：
- 任一时刻只有一行；ASS 禁用自动换行（WrapStyle=2 + \\q2），SRT 正文也只有一行。
- 先按句号/问号/感叹号分句，句内在标点或词边界上做动态规划切分：
  优先在标点处断，不拆专有名词/成语/数字+单位，不把“的/了/呢/吗”等虚词甩到下一行开头，
  避免 1–3 个字的孤行，单行宽度按真实字体字宽计算，不超过 max-width（ASS 画布像素）。
- 每条字幕的起止取自该行首字/末字的真实时间，不按字数估算。
"""
import argparse
import difflib
import json
import os
import re
import sys

import jieba
from fontTools.ttLib import TTFont

DEFAULT_FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "fonts", "IBMPlexSansSC-SemiBold.otf")

PUNCT = "，。！？；：、,.!?;:…—“”\"'‘’（）()《》 "
STRONG_END = "。！？!?"
NO_LEAD = set("的了呢吗吧啊着过么嘛上里中")  # 不应出现在行首的虚词与方位词（“地图|上”）
NO_TAIL = set("的把被从跟比在对向给让和与及是")  # 不宜留在行尾：定语“的”、介词、连词（“地图上的|面积”）
UNIT_AFTER_NUM = set("倍度年多万亿%岁个次米")

ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: {resx}
PlayResY: {resy}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,{outline},0,2,{margin},{margin},112,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

# 画幅预设：ASS 画布、字号、描边、阴影模糊与偏移、字幕底边中心位置、单行最大宽度
LAYOUTS = {
    "landscape": dict(resx=3840, resy=2160, size=192, outline=4.5, blur=8, shx=6, shy=8, x=1920, y=2048, max_width=2296),
    "vertical": dict(resx=2160, resy=3840, size=144, outline=3.4, blur=6, shx=4.5, shy=6, x=1080, y=2560, max_width=1560),
}


def ts_ass(t):
    t = max(0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def ts_srt(t):
    t = max(0, t)
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


class Metric:
    def __init__(self, path, size=192):
        f = TTFont(path)
        self.cmap = f.getBestCmap()
        self.hmtx = f["hmtx"]
        self.upm = f["head"].unitsPerEm
        self.size = size

    def width(self, s):
        w = 0
        for ch in s:
            g = self.cmap.get(ord(ch))
            adv = self.hmtx[g][0] if g else self.upm
            w += adv
        return w * self.size / self.upm


def asr_chars(words):
    out = []
    for w in words:
        txt = re.sub(r"\s+", "", w["w"])
        txt = "".join(c for c in txt if c not in PUNCT)
        if not txt:
            continue
        n = len(txt)
        for i, c in enumerate(txt):
            s = w["s"] + (w["e"] - w["s"]) * i / n
            e = w["s"] + (w["e"] - w["s"]) * (i + 1) / n
            out.append((c, s, e))
    return out


def align(text_chars, asr):
    """返回每个文本字符的 (s, e)；未匹配字符按前后匹配点线性插值。"""
    a = [c for c, _, _ in asr]
    sm = difflib.SequenceMatcher(None, text_chars, a, autojunk=False)
    times = [None] * len(text_chars)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            _, s, e = asr[blk.b + k]
            times[blk.a + k] = (s, e)
    # 插值
    n = len(times)
    i = 0
    while i < n:
        if times[i] is None:
            j = i
            while j < n and times[j] is None:
                j += 1
            t0 = times[i - 1][1] if i > 0 else (times[j][0] if j < n else 0)
            t1 = times[j][0] if j < n else t0 + 0.25 * (j - i)
            span = (t1 - t0) / (j - i)
            for k in range(i, j):
                times[k] = (t0 + span * (k - i), t0 + span * (k - i + 1))
            i = j
        else:
            i += 1
    matched = sum(b.size for b in sm.get_matching_blocks())
    return times, matched / max(1, len(text_chars))


def tokenize(sentence, terms):
    toks = list(jieba.cut(sentence, HMM=False))
    # 合并“数字 + 单位”
    out = []
    for t in toks:
        if out and re.search(r"[0-9]$", out[-1]) and t and (t[0] in UNIT_AFTER_NUM or t[0] in "0123456789."):
            out[-1] += t
        else:
            out.append(t)
    return out


def segment_sentence(sent, terms, metric, max_w):
    """sent: 一句（含句内标点）。返回 [(start_idx, end_idx)]（相对 sent 的字符区间，含标点）。"""
    toks = tokenize(sent, terms)
    # 边界位置（字符偏移）
    bounds = [0]
    for t in toks:
        bounds.append(bounds[-1] + len(t))
    nb = len(bounds)

    def disp(a, b):
        return clean_display(sent[a:b])

    def break_cost(pos):
        if pos == len(sent):
            return 0
        left = sent[:pos]
        right = sent[pos:]
        if left and left[-1] in PUNCT:
            return 0
        c = 4
        r0 = right.lstrip(PUNCT)[:1]
        if r0 in NO_LEAD:
            c += 30
        if left.rstrip(PUNCT)[-1:] in NO_TAIL:
            c += 15
        # 数字通常是前面动词的宾语（“放大了4倍”），不在数字前断行
        if r0.isdigit():
            c += 25
        # 保护词跨行
        for term in terms:
            for m in re.finditer(re.escape(term), sent):
                if m.start() < pos < m.end():
                    c += 1000
        return c

    INF = float("inf")
    best = [INF] * nb
    prev = [-1] * nb
    best[0] = 0
    for j in range(1, nb):
        for i in range(j):
            if best[i] == INF:
                continue
            txt = disp(bounds[i], bounds[j])
            if not txt:
                continue
            w = metric.width(txt)
            if w > max_w:
                continue
            n = len(txt.replace(" ", ""))
            short = max(0, 5 - n) * 2.5
            c = best[i] + break_cost(bounds[j]) + short + 1
            if c < best[j]:
                best[j] = c
                prev[j] = i
    if best[nb - 1] == INF:
        raise SystemExit(f"无法在宽度 {max_w} 内切分：{sent}")
    segs = []
    j = nb - 1
    while j > 0:
        i = prev[j]
        segs.append((bounds[i], bounds[j]))
        j = i
    return segs[::-1]


def clean_display(s):
    s = s.strip()
    s = re.sub(r"[，、；：,;:]", " ", s)
    s = re.sub(r"[。！？!?…“”\"'‘’（）()《》—]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--font", default=os.path.normpath(DEFAULT_FONT))
    ap.add_argument("--fontname", default="IBM Plex Sans SC SmBld")
    ap.add_argument("--terms")
    ap.add_argument("--layout", choices=sorted(LAYOUTS), default="landscape")
    ap.add_argument("--max-width", type=float)
    ap.add_argument("--pos-y", type=float)
    ap.add_argument("--name", default="字幕")
    a = ap.parse_args()

    terms = []
    if a.terms and os.path.exists(a.terms):
        terms = [x.strip() for x in open(a.terms, encoding="utf-8") if x.strip()]
    for term in terms:
        jieba.add_word(term, freq=2_000_000)
    L = dict(LAYOUTS[a.layout])
    if a.max_width:
        L["max_width"] = a.max_width
    if a.pos_y:
        L["y"] = a.pos_y
    a.max_width = L["max_width"]
    metric = Metric(a.font, L["size"])

    raw = open(a.text, encoding="utf-8").read()
    raw = re.sub(r"\s+", "", raw)
    words = json.load(open(a.words, encoding="utf-8"))["words"]
    asr = asr_chars(words)

    # 文本字符（去标点）与原文位置映射
    keep_idx = [i for i, c in enumerate(raw) if c not in PUNCT]
    text_chars = [raw[i] for i in keep_idx]
    times_k, ratio = align(text_chars, asr)
    times = {keep_idx[k]: times_k[k] for k in range(len(keep_idx))}

    # 分句
    sents = []
    start = 0
    for i, c in enumerate(raw):
        if c in STRONG_END:
            sents.append((start, i + 1))
            start = i + 1
    if start < len(raw):
        sents.append((start, len(raw)))

    lines = []
    for s0, s1 in sents:
        sent = raw[s0:s1]
        for a0, a1 in segment_sentence(sent, terms, metric, a.max_width):
            idx = [k for k in range(s0 + a0, s0 + a1) if k in times]
            if not idx:
                continue
            txt = clean_display(raw[s0 + a0:s0 + a1])
            lines.append({"text": txt, "s": times[idx[0]][0], "e": times[idx[-1]][1],
                          "w": round(metric.width(txt))})

    # 时间整理：轻微提前出现、延后消失；间隔很短时首尾相接；最短显示时长
    for i, ln in enumerate(lines):
        ln["s"] = max(0, ln["s"] - 0.06)
        ln["e"] = ln["e"] + 0.18
    for i in range(len(lines) - 1):
        nxt = lines[i + 1]["s"]
        if lines[i]["e"] > nxt - 0.02 or nxt - lines[i]["e"] < 0.35:
            lines[i]["e"] = nxt - 0.02
    for i, ln in enumerate(lines):
        if ln["e"] - ln["s"] < 0.6:
            lim = lines[i + 1]["s"] - 0.02 if i + 1 < len(lines) else ln["s"] + 0.6
            ln["e"] = max(ln["e"], min(ln["s"] + 0.6, lim))

    os.makedirs(a.out_dir, exist_ok=True)
    ass_path = os.path.join(a.out_dir, f"{a.name}.ass")
    srt_path = os.path.join(a.out_dir, f"{a.name}.srt")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ASS_HEAD.format(font=a.fontname, resx=L["resx"], resy=L["resy"], size=L["size"],
                                outline=L["outline"], margin=round((L["resx"] - L["max_width"]) / 2)))
        x, y, sx, sy = L["x"], L["y"], L["x"] + L["shx"], L["y"] + L["shy"]
        for ln in lines:
            s, e, txt = ts_ass(ln["s"]), ts_ass(ln["e"]), ln["text"]
            f.write(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{{\\q2\\pos({sx:g},{sy:g})\\1c&H000000&\\1a&HB0&"
                    f"\\3c&H000000&\\3a&HB0&\\shad0\\blur{L['blur']:g}}}{txt}\n")
            f.write(f"Dialogue: 1,{s},{e},Default,,0,0,0,,{{\\q2\\pos({x:g},{y:g})}}{txt}\n")
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, ln in enumerate(lines, 1):
            f.write(f"{i}\n{ts_srt(ln['s'])} --> {ts_srt(ln['e'])}\n{ln['text']}\n\n")

    # 断句报告：供人工复核
    rep = os.path.join(a.out_dir, f"{a.name}_断句检查.txt")
    with open(rep, "w", encoding="utf-8") as f:
        f.write(f"文本与识别对齐率：{ratio:.1%}\n画幅：{a.layout}（{L['resx']}×{L['resy']} 画布，字号 {L['size']}，字幕底边 y={L['y']:g}）\n最大行宽：{a.max_width:.0f}px\n\n")
        for i, ln in enumerate(lines, 1):
            dur = ln["e"] - ln["s"]
            cps = len(ln["text"].replace(" ", "")) / max(dur, 0.01)
            flag = "  ← 偏快" if cps > 9 else ""
            f.write(f"{i:02d} [{ln['s']:6.2f}-{ln['e']:6.2f}] {dur:4.2f}s {cps:4.1f}字/秒 w={ln['w']:4d} | {ln['text']}{flag}\n")
        bad = []
        for i in range(len(lines) - 1):
            joint = lines[i]["text"].replace(" ", "")[-4:] + "|" + lines[i + 1]["text"].replace(" ", "")[:4]
            for term in terms:
                for m in re.finditer(re.escape(term), joint.replace("|", "")):
                    cut = joint.index("|")
                    if m.start() < cut < m.end():
                        bad.append(f"{i + 1}/{i + 2} 拆开了“{term}”")
        f.write("\n保护词检查：" + ("通过" if not bad else "；".join(bad)) + "\n")
    print(open(rep, encoding="utf-8").read())


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    jieba.setLogLevel(60)
    main()
