# -*- coding: utf-8 -*-
"""逐字时间戳转写。

用法：python transcribe.py <audio.wav> <out.json> [--model large-v3-turbo] [--terms "术语1 术语2"]

说明：
- 只把少量专有名词作为 initial_prompt，不把整篇文案塞进去，避免模型"按稿子脑补"、吞掉重说。
- condition_on_previous_text=False，降低重复幻觉。
- 输出 {"segments":[...], "words":[{"w","s","e","p"}]}，时间单位秒（原片时间）。
"""
import argparse
import json
import sys

import whisper


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("out")
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--terms", default="")
    ap.add_argument("--language", default="zh")
    a = ap.parse_args()

    model = whisper.load_model(a.model)
    prompt = "以下是普通话口播，使用简体中文。" + (a.terms or "")
    r = model.transcribe(
        a.audio,
        language=a.language,
        word_timestamps=True,
        initial_prompt=prompt,
        condition_on_previous_text=False,
        temperature=0.0,
        verbose=False,
    )
    words, segs = [], []
    for s in r["segments"]:
        segs.append({"s": round(s["start"], 3), "e": round(s["end"], 3), "text": s["text"].strip(),
                     "no_speech": round(s.get("no_speech_prob", 0), 3)})
        for w in s.get("words", []):
            words.append({"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3),
                          "p": round(w.get("probability", 0), 3)})
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"segments": segs, "words": words}, f, ensure_ascii=False, indent=1)
    for s in segs:
        print(f"[{s['s']:7.2f}-{s['e']:7.2f}] {s['text']}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
