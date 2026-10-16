# -*- coding: utf-8 -*-
"""重叠短窗口复核转写：长句转写可能把重说"合并"掉，用短窗口逐段再听一遍。

用法：python probe_windows.py <audio.wav> [--win 5] [--hop 2.5] [--start 0] [--end 0] [--model large-v3-turbo]
输出每个窗口的文本（不加任何文案提示，避免模型按稿脑补）。
"""
import argparse
import sys

import numpy as np
import whisper


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--win", type=float, default=5.0)
    ap.add_argument("--hop", type=float, default=2.5)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, default=0)
    ap.add_argument("--model", default="large-v3-turbo")
    a = ap.parse_args()
    audio = whisper.load_audio(a.audio)
    sr = 16000
    end = a.end or len(audio) / sr
    model = whisper.load_model(a.model)
    t = a.start
    while t < end:
        seg = audio[int(t * sr): int(min(t + a.win, end) * sr)].astype(np.float32)
        if len(seg) < sr * 0.4:
            break
        r = model.transcribe(seg, language="zh", condition_on_previous_text=False, temperature=0.0,
                             initial_prompt="以下是普通话口播，使用简体中文。", word_timestamps=True)
        words = [f"{w['word'].strip()}{t + w['start']:.2f}" for s in r["segments"] for w in s.get("words", [])]
        print(f"[{t:6.2f}-{t + a.win:6.2f}] " + " ".join(words), flush=True)
        t += a.hop


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
