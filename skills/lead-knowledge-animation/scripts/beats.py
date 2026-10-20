#!/usr/bin/env python
"""音乐节拍测量：输出 beats.json（bpm / offset / beats / downbeats / hits / kicks）。
画面的“踩点”要用测出来的时间，不要只按 BPM 推算——差 0.05s 耳朵就能听出来。

用法：python beats.py music.mp3 --out work/beats.json [--bpm-range 70 180] [--hits 0.35]
依赖：numpy、scipy、ffmpeg（用 ffmpeg 解码，任何格式都行）
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, json, subprocess, sys
import numpy as np
from scipy.signal import stft, find_peaks, butter, sosfilt

SR = 22050

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def onset_env(x, hop=256, band=None):
    if band:
        sos = butter(4, band if len(band) == 2 else band[0], btype='bandpass' if len(band) == 2 else 'lowpass', fs=SR, output='sos')
        x = sosfilt(sos, x)
    _, _, Z = stft(x, fs=SR, nperseg=1024, noverlap=1024 - hop, boundary=None)
    mag = np.log1p(10 * np.abs(Z))
    flux = np.maximum(0, np.diff(mag, axis=1)).sum(axis=0)
    flux = flux - np.convolve(flux, np.ones(16) / 16, mode='same')  # 去掉缓慢变化
    flux = np.maximum(flux, 0)
    return flux / (flux.max() + 1e-9), hop / SR

def tempo(env, dt, lo, hi):
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lags = np.arange(len(ac)) * dt
    bpms = 60 / np.maximum(lags, 1e-9)
    mask = (bpms >= lo) & (bpms <= hi)
    # 对数高斯先验偏向 120 附近，减少倍频/半频误判
    prior = np.exp(-0.5 * (np.log2(np.where(mask, bpms, 1) / 120) / 0.9) ** 2)
    score = np.where(mask, ac * prior, -np.inf)
    i = int(np.argmax(score))
    # 抛物线插值细化
    if 1 <= i < len(ac) - 1:
        a, b, c = ac[i - 1], ac[i], ac[i + 1]
        d = 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
        return 60 / ((i + d) * dt)
    return 60 / (i * dt)

def phase(env, dt, bpm):
    spb = 60 / bpm
    best, best_off = -1, 0
    for off in np.arange(0, spb, dt):
        idx = ((np.arange(off, len(env) * dt, spb)) / dt).astype(int)
        idx = idx[idx < len(env)]
        s = env[idx].sum()
        if s > best:
            best, best_off = s, off
    return best_off

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio'); ap.add_argument('--out', default='beats.json')
    ap.add_argument('--bpm-range', nargs=2, type=float, default=[70, 180])
    ap.add_argument('--hits', type=float, default=0.35, help='onset 峰值阈值（0–1），越高越少')
    ap.add_argument('--bar', type=int, default=4, help='每小节拍数')
    a = ap.parse_args()
    x = load(a.audio)
    dur = len(x) / SR
    env, dt = onset_env(x)
    bpm = tempo(env, dt, *a.bpm_range)
    off = phase(env, dt, bpm)
    spb = 60 / bpm
    beats = [round(float(t), 4) for t in np.arange(off, dur, spb)]
    # 小节重拍：选让低频能量最强的相位
    kenv, _ = onset_env(x, band=[150])
    kenv = kenv[:len(env)]
    bi = [min(int(t / dt), len(kenv) - 1) for t in beats]
    ph = int(np.argmax([sum(kenv[bi[j]] for j in range(p, len(bi), a.bar)) for p in range(a.bar)]))
    downbeats = beats[ph::a.bar]
    pk, _ = find_peaks(env, height=a.hits, distance=max(1, int(0.09 / dt)))
    hits = [round(float(i * dt), 4) for i in pk]
    kp, _ = find_peaks(kenv, height=0.4, distance=max(1, int(0.18 / dt)))
    kicks = [round(float(i * dt), 4) for i in kp]
    # 能量曲线（每 0.5s RMS，dB）——用来找 drop / breakdown
    w = int(SR * 0.5)
    rms = [round(float(20 * np.log10(np.sqrt(np.mean(x[i:i + w] ** 2)) + 1e-9)), 1) for i in range(0, len(x) - w, w)]
    drops = []
    for i in range(4, len(rms)):
        if rms[i] - np.mean(rms[max(0, i - 4):i]) > 6:
            drops.append(round(i * 0.5, 2))
    res = dict(file=a.audio, duration=round(dur, 3), bpm=round(float(bpm), 2), offset=round(float(off), 4),
               spb=round(spb, 5), beats=beats, downbeats=downbeats, hits=hits, kicks=kicks,
               energy_db_per_0_5s=rms, drop_candidates=drops)
    json.dump(res, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'BPM≈{bpm:.2f} 首拍 {off:.3f}s · {len(beats)} 拍 · {len(downbeats)} 重拍 · {len(hits)} 个击点 · drop 候选 {drops[:6]} → {a.out}')
    print('提示：BPM 可能被判成倍频/半频，用耳朵核对；画面事件用 beats/downbeats，音效对齐用 hits/kicks。')

if __name__ == '__main__':
    main()
