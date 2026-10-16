# -*- coding: utf-8 -*-
"""人声整理：高通 + 轻压缩 + 两遍 loudnorm（线性）到目标响度。

python normalize_voice.py <in_media> <out.wav> [--I -16] [--TP -1.5]
"""
import argparse
import json
import re
import subprocess
import sys

PRE = "highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--I", type=float, default=-16)
    ap.add_argument("--TP", type=float, default=-1.5)
    a = ap.parse_args()
    ln = f"loudnorm=I={a.I}:TP={a.TP}:LRA=9"
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", a.src, "-vn", "-af", f"{PRE},{ln}:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr)
    d = json.loads(m.group(0))
    af = (f"{PRE},{ln}:measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}"
          f":measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a.src, "-vn", "-af", af, "-ar", "48000", "-ac", "2", a.out],
                   check=True)
    print("measured:", d["input_i"], "LUFS ->", a.I)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
