# -*- coding: utf-8 -*-
"""把动效工程用到的字体按实际用字子集化（几十 KB），避免大字体在并发渲染时加载失败或静默回退。

python subset_fonts.py <motion_dir> <font1> [<font2> ...]
扫描 <motion_dir>/src 下所有 .ts/.tsx 中出现的字符 + ASCII + 常用中文标点，
输出到 <motion_dir>/public/fonts/<原文件名>（变量字体保留可变轴）。
"""
import glob
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

EXTRA = "".join(chr(c) for c in range(0x20, 0x7F)) + "，。！？；：、“”‘’（）《》—…·×≈→←↑↓↕°²√％"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    mdir, fonts = sys.argv[1], sys.argv[2:]
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
