# -*- coding: utf-8 -*-
"""人声 + 音效混音（一次 ffmpeg 完成，避免动效引擎为每条音效单独起进程）。

python mix_audio.py --voice voice.wav --sfx-dir public/sfx --cues src/sfx.json --duration 51.13 --out mix.wav
cues: [[秒, "音效名", 音量0-1], ...]，与动效工程 src/sfx.json 共用一份。
"""
import argparse
import json
import os
import subprocess
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--sfx-dir", required=True)
    ap.add_argument("--cues", required=True)
    ap.add_argument("--duration", type=float, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fade-out", type=float, default=0.18)
    a = ap.parse_args()
    cues = json.load(open(a.cues, encoding="utf-8"))
    inputs = ["-i", a.voice]
    parts = ["[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v0]"]
    labels = ["[v0]"]
    for i, (t, name, vol) in enumerate(cues, 1):
        inputs += ["-i", os.path.join(a.sfx_dir, f"{name}.wav")]
        ms = int(round(t * 1000))
        parts.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[s{i}]")
        labels.append(f"[s{i}]")
    st = max(0, a.duration - a.fade_out)
    parts.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0,"
                 f"atrim=0:{a.duration},afade=t=out:st={st}:d={a.fade_out},alimiter=limit=0.89:level=false[m]")
    cmd = ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(parts), "-map", "[m]",
           "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", a.out]
    subprocess.run(cmd, check=True)
    print(f"mixed {len(cues)} cues -> {a.out}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
