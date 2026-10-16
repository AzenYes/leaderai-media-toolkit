# -*- coding: utf-8 -*-
"""语音能量岛 + 指定区间精听。

python speech_islands.py <audio16k.wav> islands [--thr -40] [--minsil 0.18]
    打印每个语音"岛"（连续有声区间），用于确认重说/停顿的真实边界。
python speech_islands.py <audio16k.wav> listen <s> <e> [<s> <e> ...]
    对每个区间单独转写（不带文案提示），用于确认某一段到底说了什么。
"""
import sys

import numpy as np


def load(path):
    import whisper
    return whisper.load_audio(path)


def islands(audio, thr_db=-40.0, minsil=0.18, hop=0.01):
    sr = 16000
    n = int(hop * sr)
    frames = len(audio) // n
    rms = np.array([np.sqrt(np.mean(audio[i * n:(i + 1) * n] ** 2) + 1e-12) for i in range(frames)])
    db = 20 * np.log10(rms)
    on = db > thr_db
    out, start, last_on = [], None, None
    for i, v in enumerate(on):
        t = i * hop
        if v:
            if start is None:
                start = t
            last_on = t
        elif start is not None and t - last_on > minsil:
            if last_on - start > 0.06:
                out.append((start, last_on + hop))
            start = None
    if start is not None:
        out.append((start, last_on + hop))
    return out, db


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    path, mode = sys.argv[1], sys.argv[2]
    audio = load(path)
    if mode == "islands":
        thr = float(sys.argv[sys.argv.index("--thr") + 1]) if "--thr" in sys.argv else -40.0
        ms = float(sys.argv[sys.argv.index("--minsil") + 1]) if "--minsil" in sys.argv else 0.18
        isl, _ = islands(audio, thr, ms)
        for s, e in isl:
            print(f"{s:7.2f}-{e:7.2f} ({e - s:4.2f}s)")
    elif mode == "listen":
        import whisper
        model = whisper.load_model("large-v3-turbo")
        vals = [float(x) for x in sys.argv[3:]]
        for s, e in zip(vals[::2], vals[1::2]):
            seg = audio[int(s * 16000):int(e * 16000)].astype(np.float32)
            r = model.transcribe(seg, language="zh", condition_on_previous_text=False, temperature=0.0,
                                 initial_prompt="以下是普通话口播，使用简体中文。")
            print(f"[{s:6.2f}-{e:6.2f}] {''.join(x['text'] for x in r['segments']).strip()}", flush=True)


if __name__ == "__main__":
    main()
