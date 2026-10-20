#!/usr/bin/env python
"""程序化音效套件（无版权风险的兜底方案）。
实录 CC0 音效通常更“贵”；用户有音效库/授权素材时优先用素材，这里只保证“没有素材也不难听”。
每个音效都做了：分层（瞬态+主体+空气）、包络、轻混响、立体声，峰值统一到 -3 dBFS。

用法：
  python sfx.py --out work/sfx                      # 生成整套
  python sfx.py --out work/sfx --seed 7 --variants 3  # 每种生成 3 个变体（重复使用时轮换，避免机械感）
  python sfx.py --bed 20 --bpm 96 --key A --mood calm --out work/sfx   # 额外生成 20s 氛围底乐（非常克制，只当垫底）
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, os, zlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000

def t_(d): return np.arange(int(SR * d)) / SR

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos'), x)

def lp(x, f, order=2): return sosfilt(butter(order, f, btype='lowpass', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, btype='highpass', fs=SR, output='sos'), x)

def env_ad(n, a, d, curve=4.0):
    tt = np.arange(n) / SR
    e = np.where(tt < a, (tt / max(a, 1e-6)) ** 1.5, np.exp(-curve * (tt - a) / max(d, 1e-6)))
    return e

def sweep_noise(rng, d, f0, f1, q=1.2, steps=48):
    """中心频率随时间扫动的带通噪声（分块滤波 + 交叉淡化）"""
    n = int(SR * d); out = np.zeros(n); x = rng.standard_normal(n + 4096)
    blk = n // steps + 1
    for i in range(steps):
        p = i / max(1, steps - 1)
        fc = f0 * (f1 / f0) ** p
        lo, hi = fc / (1 + 1 / q), min(fc * (1 + 1 / q), SR / 2 - 100)
        seg = bp(x[max(0, i * blk - 2048): i * blk + blk + 2048], max(30, lo), hi)
        s = i * blk - max(0, i * blk - 2048)
        part = seg[s: s + blk]
        out[i * blk: i * blk + len(part)] += part[: max(0, min(blk, n - i * blk))]
    return out

def reverb(x, rng, decay=0.6, wet=0.18, pre=0.012):
    n = int(SR * decay * 1.5)
    ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / (SR * decay))
    ir = lp(ir, 6000)
    ir = np.concatenate([np.zeros(int(SR * pre)), ir])
    y = fftconvolve(x, ir)[: len(x) + len(ir) - 1]
    y = y / (np.max(np.abs(y)) + 1e-9) * np.max(np.abs(x))
    out = np.zeros(len(y)); out[: len(x)] += x
    return out + wet * y

def stereo(x, pan=0.0, width=0.0, rng=None):
    l = x * np.sqrt(0.5 * (1 - pan)); r = x * np.sqrt(0.5 * (1 + pan))
    if width and rng is not None:
        d = int(SR * 0.0007 * width)
        r = np.concatenate([np.zeros(d), r[:-d] if d else r])
    return np.stack([l, r], axis=1)

def pan_sweep(x, p0, p1):
    p = np.linspace(p0, p1, len(x))
    return np.stack([x * np.sqrt(0.5 * (1 - p)), x * np.sqrt(0.5 * (1 + p))], axis=1)

def norm(y, peak_db=-3.0):
    pk = np.max(np.abs(y)) + 1e-9
    y = y / pk * 10 ** (peak_db / 20)
    fade = min(len(y), int(SR * 0.004))
    y[-fade:] *= np.linspace(1, 0, fade)[:, None] if y.ndim == 2 else np.linspace(1, 0, fade)
    return y

# ───────────── 音效 ─────────────
def click(rng, v):
    n = int(SR * 0.05)
    body = np.sin(2 * np.pi * (2400 + 300 * v) * t_(0.05)) * env_ad(n, 0.0005, 0.012, 5)
    tr = hp(rng.standard_normal(n), 3000) * env_ad(n, 0.0002, 0.004, 6)
    return stereo(reverb(0.55 * body + 0.6 * tr, rng, 0.25, 0.08), 0, 1, rng)

def tick(rng, v):
    n = int(SR * 0.03)
    x = bp(rng.standard_normal(n), 4000 + 500 * v, 9000) * env_ad(n, 0.0002, 0.006, 6)
    return stereo(x, 0, 0.5, rng)

def pop(rng, v):
    d = 0.16; tt = t_(d); n = len(tt)
    f = 420 + 900 * (1 - np.exp(-tt / 0.03)) + 60 * v
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * env_ad(n, 0.004, 0.06, 4) + 0.15 * np.sin(2 * ph) * env_ad(n, 0.002, 0.03)
    return stereo(reverb(x, rng, 0.35, 0.12), 0, 1, rng)

def whoosh(rng, v, d=0.55, f0=300, f1=3200):
    d = d * (1 + 0.08 * v)
    x = sweep_noise(rng, d, f0, f1, q=1.6)
    n = len(x); tt = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.6 * np.exp(-1.2 * tt / d)
    x = x * e + 0.25 * lp(rng.standard_normal(n), 400) * e
    y = pan_sweep(reverb(x, rng, 0.5, 0.15), -0.5, 0.5)
    return y

def swish(rng, v): return whoosh(rng, v, 0.28, 800, 6000)

def thump(rng, v):
    d = 0.6; tt = t_(d); n = len(tt)
    f = 46 + 110 * np.exp(-tt / 0.045) + 4 * v
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.002, 0.32, 4)
    knock = lp(rng.standard_normal(n), 1800) * env_ad(n, 0.0005, 0.02, 5)
    return stereo(reverb(np.tanh(1.6 * body) + 0.35 * knock, rng, 0.5, 0.1), 0, 0.6, rng)

def impact(rng, v):
    d = 1.4; tt = t_(d); n = len(tt)
    f = 38 + 130 * np.exp(-tt / 0.05)
    sub = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.002, 0.6, 3.5))
    crack = bp(rng.standard_normal(n), 900, 7000) * env_ad(n, 0.0005, 0.08, 4)
    tail = lp(rng.standard_normal(n), 2500) * env_ad(n, 0.01, 0.9, 5) * 0.12
    return stereo(reverb(0.9 * sub + 0.45 * crack + tail, rng, 1.2, 0.22), 0, 1.2, rng)

def riser(rng, v):
    d = 1.6 + 0.2 * v; tt = t_(d); n = len(tt)
    x = sweep_noise(rng, d, 200, 7000, q=2.2) * (tt / d) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * tt / d)) / SR) * (tt / d) ** 3 * 0.25
    y = reverb(x + tone, rng, 0.6, 0.2)[:n]
    y[-int(SR * 0.006):] *= np.linspace(1, 0, int(SR * 0.006))
    return stereo(y, 0, 1, rng)  # 用 align=end：结尾对准画面的“爆点”

def reverse(rng, v):
    y = impact(rng, v)[::-1].copy()
    return y

def chime(rng, v):
    d = 2.2; tt = t_(d); n = len(tt)
    base = [880, 1046.5, 1318.5, 1174.7][v % 4]
    x = sum(a * np.sin(2 * np.pi * base * r * tt) * np.exp(-tt * k) for a, r, k in [(1, 1, 2.2), (0.5, 2.756, 3.5), (0.3, 5.404, 6), (0.18, 8.93, 9)])
    x = x * env_ad(n, 0.002, d, 1)
    return stereo(reverb(x, rng, 1.6, 0.3), 0, 1.5, rng)

def glitch(rng, v):
    d = 0.22; n = int(SR * d)
    x = rng.standard_normal(n)
    hold = rng.integers(8, 60)
    x = np.repeat(x[::hold], hold)[:n]
    gate = (np.sin(2 * np.pi * (35 + 10 * v) * t_(d)) > 0).astype(float)
    x = bp(x * gate, 300, 6000) * env_ad(n, 0.001, 0.2, 3)
    return stereo(x, 0, 1, rng)

def type_(rng, v):
    out = np.zeros(int(SR * 0.6))
    for k in range(6):
        s = int(SR * (k * 0.085 + rng.uniform(0, 0.02)))
        c = tick(rng, v + k)[:, 0] * rng.uniform(0.5, 1)
        out[s: s + len(c)] += c[: len(out) - s]
    return stereo(out, 0, 0.5, rng)

def sub(rng, v):
    d = 1.8; tt = t_(d); n = len(tt)
    f = 30 + 50 * np.exp(-tt / 0.5)
    x = np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * env_ad(n, 0.01, 1.4, 3)
    return stereo(x, 0, 0, rng)

KIT = dict(click=click, tick=tick, pop=pop, whoosh=whoosh, swish=swish, thump=thump, impact=impact,
           riser=riser, reverse=reverse, chime=chime, glitch=glitch, type=type_, sub=sub)

# ───────────── 氛围底乐（克制、只做垫底） ─────────────
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def bed(rng, dur, bpm, key, mood):
    tt = t_(dur); n = len(tt)
    root = 110 * 2 ** ((NOTE[key] - 9) / 12)
    prog = [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 5], [-2, 2, 5, 9]] if mood != 'bright' else [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]]
    bar = 4 * 60 / bpm; out = np.zeros(n)
    for b in range(int(np.ceil(dur / bar))):
        ch = prog[b % len(prog)]
        s = int(b * bar * SR); e = min(n, int((b + 1) * bar * SR + SR * 0.5))
        seg = tt[: e - s]
        env = np.minimum(1, seg / 0.6) * np.minimum(1, np.maximum(0, (len(seg) / SR - seg) / 0.8))
        for st in ch:
            f = root * 2 ** (st / 12)
            for det in (-0.12, 0.12):
                out[s:e] += 0.08 * np.sin(2 * np.pi * f * (1 + det / 100) * seg + rng.uniform(0, 6)) * env
    out = lp(out, 2400)
    if mood != 'calm':  # 轻脉冲
        spb = 60 / bpm
        for k in range(int(dur / spb)):
            s = int(k * spb * SR); k_ = thump(rng, 0)[:, 0] * (0.25 if k % 4 == 0 else 0.12)
            out[s: s + len(k_)] += k_[: max(0, n - s)]
    out = reverb(out, rng, 2.5, 0.35)[:n]
    fade = int(SR * 1.5); out[-fade:] *= np.linspace(1, 0, fade); out[: int(SR * 0.5)] *= np.linspace(0, 1, int(SR * 0.5))
    return stereo(out, 0, 2, rng)

def save(path, y):
    wavfile.write(path, SR, (np.clip(y, -1, 1) * 32767).astype(np.int16))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='sfx'); ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--variants', type=int, default=2)
    ap.add_argument('--only', default='', help='逗号分隔，只生成这些')
    ap.add_argument('--bed', type=float, default=0, help='生成底乐的时长（秒）')
    ap.add_argument('--bpm', type=float, default=96); ap.add_argument('--key', default='A')
    ap.add_argument('--mood', default='calm', choices=['calm', 'pulse', 'bright'])
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    names = [x for x in a.only.split(',') if x] or list(KIT)
    for name in names:
        for v in range(a.variants):
            rng = np.random.default_rng(a.seed * 1000 + v * 17 + zlib.crc32(name.encode()) % 997)
            save(os.path.join(a.out, f'{name}_{v + 1}.wav' if a.variants > 1 else f'{name}.wav'), norm(KIT[name](rng, v)))
    if a.bed:
        save(os.path.join(a.out, 'bed.wav'), norm(bed(np.random.default_rng(a.seed), a.bed, a.bpm, a.key, a.mood), -6))
    print(f'已生成 {len(names)} 种 × {a.variants} 个变体 → {a.out}' + ('（含 bed.wav）' if a.bed else ''))

if __name__ == '__main__':
    main()
