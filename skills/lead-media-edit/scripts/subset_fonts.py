# -*- coding: utf-8 -*-
"""把动效工程用到的字体按实际用字子集化（几十 KB），避免大字体在并发渲染时加载失败或静默回退。

python subset_fonts.py <motion_dir> [<font1> <font2> ...]
不传字体时，按 <motion_dir>/src/engine/fonts.ts 里登记的 fonts/xxx 文件名，从本 skill 的 assets/fonts/ 取完整字体；
传入的字体若只写文件名（如 IBMPlexSansSC-Bold.otf），也先到 assets/fonts/ 找。
扫描 <motion_dir>/src 下所有 .ts/.tsx 中出现的字符 + ASCII + 常用中文标点，
输出到 <motion_dir>/public/fonts/<原文件名>（变量字体保留可变轴）。
"""
import glob
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ASSET_FONTS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "fonts"))
EXTRA = "".join(chr(c) for c in range(0x20, 0x7F)) + "，。！？；：、“”‘’（）《》—…·×≈→←↑↓↕°²√％"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    mdir, fonts = sys.argv[1], sys.argv[2:]
    if not fonts:
        reg = open(os.path.join(mdir, "src", "engine", "fonts.ts"), encoding="utf-8").read()
        fonts = sorted(set(re.findall(r"[\"']fonts/([^\"']+)[\"']", reg)))
    fonts = [f if os.path.exists(f) else os.path.join(ASSET_FONTS, os.path.basename(f)) for f in fonts]
    missing = [f for f in fonts if not os.path.exists(f)]
    if missing:
        raise SystemExit(f"找不到字体：{missing}（字体库：{ASSET_FONTS}）")
    chars = set(EXTRA)
    for p in glob.glob(os.path.join(mdir, "src", "**", "*.ts*"), recursive=True):
        chars.update(open(p, encoding="utf-8").read())
    chars = {c for c in chars if c.isprintable()}
    out_dir = os.path.join(mdir, "public", "fonts")
    os.makedirs(out_dir, exist_ok=True)
    for f in fonts:
        font = TTFont(f)
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        opts.glyph_names = False
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(sorted(chars)))
        sub.subset(font)
        dst = os.path.join(out_dir, os.path.basename(f))
        font.save(dst)
        print(f"{os.path.basename(f)}: {len(chars)} chars -> {os.path.getsize(dst) // 1024} KB")


if __name__ == "__main__":
    main()
