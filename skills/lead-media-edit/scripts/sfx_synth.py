# -*- coding: utf-8 -*-
"""程序化合成 B-roll 音效（无版权风险，48kHz 立体声 WAV）。

python sfx_synth.py <out_dir>

生成：whoosh_in / whoosh_out / swish / pop / tick / click / drag / shrink / impact /
      riser / chime / peel / stretch / type / glide
所有音效峰值约 -3 dBFS，混音时在动效工程里统一压低到人声之下。
"""
import os
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def write(path, x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    peak = np.max(np.abs(x)) + 1e-9
    x = x / peak * 0.707  # -3 dBFS
    data = (x * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def env_adsr(n, a, d, s, r, sustain_level=0.6):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    s = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.linspace(1, sustain_level, d, endpoint=False),
                        np.full(s, sustain_level), np.linspace(sustain_level, 0, r)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def onepole_lp(x, fc):
    """时变一阶低通，fc 可为数组。"""
    fc = np.broadcast_to(fc, x.shape)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        a = 1 - np.exp(-2 * np.pi * fc[i] / SR)
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def bandsweep(d, f0, f1, q=2.0, curve="exp"):
    """噪声带通扫频（两级低通相减近似带通），用于 whoosh。"""
    n = int(d * SR)
    noise = rng.standard_normal(n)
    u = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
    hi = onepole_lp(noise, f * (1 + 1 / q))
    lo = onepole_lp(noise, f / (1 + 1 / q))
    return hi - lo


def stereo_pan(x, start=-0.6, end=0.6):
    p = np.linspace(start, end, len(x))
    l = x * np.cos((p + 1) * np.pi / 4)
    r = x * np.sin((p + 1) * np.pi / 4)
    return np.stack([l, r], axis=1)


def whoosh(d=0.7, f0=300, f1=3200, pan=(-0.7, 0.7), peak_at=0.55):
    n = int(d * SR)
    x = bandsweep(d, f0, f1)
    u = np.linspace(0, 1, n)
    e = np.where(u < peak_at, (u / peak_at) ** 2.2, ((1 - u) / (1 - peak_at)) ** 1.6)
    return stereo_pan(x * e, *pan)


def pop(f=880, d=0.12):
    t = t_axis(d)
    f_t = f * (1 + 1.2 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(f_t) / SR
    x = np.sin(ph) * np.exp(-t * 38) + 0.25 * np.sin(2 * ph) * np.exp(-t * 60)
    return x


def tick(d=0.05):
    t = t_axis(d)
    x = rng.standard_normal(len(t)) * np.exp(-t * 400)
    x = x - onepole_lp(x, 2500)
    x += 0.6 * np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 180)
    return x


def click():
    a = tick(0.04)
    b = np.pad(tick(0.04) * 0.6, (int(0.035 * SR), 0))
    n = max(len(a), len(b))
    return np.pad(a, (0, n - len(a))) + np.pad(b, (0, n - len(b)))


def drag(d=1.4):
    n = int(d * SR)
    x = bandsweep(d, 900, 600, q=1.2)
    grain = (rng.random(n) < 0.004).astype(float) * rng.standard_normal(n)
    grain = grain - onepole_lp(grain, 1800)
    e = env_adsr(n, 0.15, 0.2, 0, 0.4, 0.7)
    return stereo_pan((x * 0.8 + grain * 0.5) * e, -0.2, 0.2)


def shrink(d=0.6):
    t = t_axis(d)
    f = 1100 * (220 / 1100) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 4) * (1 - np.exp(-t * 200))
    x += 0.3 * bandsweep(d, 3000, 400) * np.exp(-t * 5)
    return x


def impact(d=1.6):
    t = t_axis(d)
    f = 120 * (38 / 120) ** np.clip(t / 0.45, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t * 3.2)
    trans = rng.standard_normal(len(t)) * np.exp(-t * 40)
    trans = onepole_lp(trans, 4000)
    tail = bandsweep(d, 1800, 300) * np.exp(-t * 2.5) * 0.35
    x = boom * 1.0 + trans * 0.5 + tail
    return np.tanh(x * 1.6)


def riser(d=1.2):
    n = int(d * SR)
    t = t_axis(d)
    x = bandsweep(d, 400, 6000)
    f = 200 * (800 / 200) ** (t / d)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    e = (t / d) ** 2.5
    e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return stereo_pan((x + tone) * e, -0.3, 0.3)


def chime(d=1.8, base=880):
    t = t_axis(d)
    x = np.zeros_like(t)
    for k, (m, a, dec) in enumerate([(1, 1, 3), (2.01, 0.45, 4.5), (3.02, 0.22, 6), (4.2, 0.12, 8)]):
        x += a * np.sin(2 * np.pi * base * m * t + k) * np.exp(-t * dec)
    x2 = np.zeros_like(t)
    off = int(0.09 * SR)
    for m, a, dec in [(1.5, 0.7, 3.2), (3.0, 0.3, 5)]:
        x2[off:] += a * np.sin(2 * np.pi * base * m * t[:-off]) * np.exp(-t[:-off] * dec)
    x = x * (1 - np.exp(-t * 400)) + x2
    return np.stack([x, np.roll(x, 120) * 0.9], axis=1)


def peel(d=1.3):
    n = int(d * SR)
    x = np.zeros(n)
    pos = 0
    while pos < n:
        ln = int(rng.uniform(0.01, 0.05) * SR)
        burst = rng.standard_normal(ln) * np.hanning(ln) * rng.uniform(0.3, 1)
        end = min(n, pos + ln)
        x[pos:end] += burst[:end - pos]
        pos += int(rng.uniform(0.004, 0.03) * SR)
    x = x - onepole_lp(x, 900)
    x = onepole_lp(x, 7000)
    e = env_adsr(n, 0.1, 0.3, 0, 0.5, 0.8)
    return stereo_pan(x * e, -0.5, 0.5)


def stretch(d=1.2):
    t = t_axis(d)
    f = 160 * (520 / 160) ** (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sign(np.sin(ph)) * 0.3 + np.sin(ph)
    x = onepole_lp(x, 1400)
    x += 0.4 * bandsweep(d, 500, 2500)
    e = env_adsr(len(t), 0.2, 0.2, 0, 0.35, 0.8)
    return x * e


def glide(d=0.9):
    """柔和的上滑音，用于标题出现。"""
    t = t_axis(d)
    f = 440 * (660 / 440) ** np.clip(t / 0.25, 0, 1)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * env_adsr(len(t), 0.02, 0.2, 0, 0.6, 0.5)
    return np.stack([x, np.roll(x, 200)], axis=1)


def type_ticks(n=8, gap=0.06):
    out = np.zeros(int((n * gap + 0.1) * SR))
    for i in range(n):
        tk = tick(0.04) * rng.uniform(0.5, 1)
        p = int(i * gap * SR + rng.uniform(-0.008, 0.008) * SR)
        p = max(0, p)
        out[p:p + len(tk)] += tk[:len(out) - p]
    return out


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    items = {
        "whoosh_in": whoosh(0.75, 250, 3800, (-0.8, 0.6), 0.6),
        "whoosh_out": whoosh(0.65, 3200, 300, (0.6, -0.8), 0.35),
        "swish": whoosh(0.4, 900, 5200, (-0.4, 0.4), 0.5),
        "pop": pop(880),
        "pop_low": pop(520),
        "tick": tick(),
        "click": click(),
        "drag": drag(1.4),
        "shrink": shrink(),
        "impact": impact(),
        "riser": riser(),
        "chime": chime(),
        "peel": peel(),
        "stretch": stretch(),
        "glide": glide(),
        "type": type_ticks(),
    }
    for k, v in items.items():
        write(os.path.join(out, f"{k}.wav"), v)
        print("wrote", k)


if __name__ == "__main__":
    main()
