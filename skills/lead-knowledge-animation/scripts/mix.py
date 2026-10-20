#!/usr/bin/env python
"""按事件表混音：音效按“能量峰值”对齐画面时刻，音乐在人声下自动避让，最后两遍 loudnorm。

用法：
  python mix.py --cues work/cues.json --sfx-dir work/sfx --duration 15 --out work/mix.wav
               [--music music.mp3 --music-db -6 --music-start 0] [--voice vo.wav] [--duck-db 10]
               [--lufs -14 --tp -1.5]
cues.json 可以是 cues.mjs 的输出（{cues:[...]}），也可以直接是列表。每条：
  { "t": 2.35, "sfx": "impact", "gain": 0, "pan": 0, "align": "peak" }
  - sfx：kit 名（自动在 name_1/name_2… 变体间轮换）或音频文件路径
  - align：peak（默认，峰值落在 t）| start（起点落在 t）| end（结尾落在 t，riser/reverse 用）
  - gain：dB；0.15s 内扎堆的瞬态音效会自动压低（end 对齐的上升音除外），避免糊成一团
注意：电平表只能证明“不爆、不轻、对齐”，不能证明好听；交付时列出需要人耳确认的时间点。
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, json, os, subprocess, re, glob
import numpy as np
from scipy.io import wavfile

SR = 48000
END_ALIGN = {'riser', 'reverse'}

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)

def peak_index(x):
    e = np.abs(x).max(axis=1)
    w = int(SR * 0.004)
    e = np.convolve(e, np.ones(w) / w, mode='same')
    return int(np.argmax(e))

def resolve(name, sfx_dir, counters):
    if os.path.isfile(name): return name
    base = re.sub(r'\.wav$', '', name)
    vars_ = sorted(glob.glob(os.path.join(sfx_dir, base + '_*.wav'))) or glob.glob(os.path.join(sfx_dir, base + '.wav'))
    if not vars_: raise FileNotFoundError(f'找不到音效 {name}（{sfx_dir}）')
    k = counters.get(base, 0); counters[base] = k + 1
    return vars_[k % len(vars_)]

def env_follow(x, attack=0.08, release=0.25):
    m = np.abs(x).max(axis=1)
    w = int(SR * 0.02)
    m = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, mode='same'))
    out = np.zeros_like(m); g = 0.0
    a = np.exp(-1 / (SR * attack)); r = np.exp(-1 / (SR * release))
    for i in range(0, len(m), 64):  # 降采样跟随，够用且快
        v = m[i]; c = a if v > g else r; g = c * g + (1 - c) * v; out[i:i + 64] = g
    return out

def loudnorm(inp, out, lufs, tp):
    cmd = ['ffmpeg', '-hide_banner', '-i', inp, '-af', f'loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json', '-f', 'null', '-']
    err = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore').stderr
    js = json.loads(err[err.rfind('{'): err.rfind('}') + 1])
    af = (f"loudnorm=I={lufs}:TP={tp}:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', inp, '-af', af, '-ar', str(SR), out], check=True)
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True, encoding='utf-8', errors='ignore').stderr
    I = re.findall(r'\bI:\s+(-?[\d.]+) LUFS', err); P = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', err)
    return (I[-1] if I else '?'), (P[-1] if P else '?')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cues', required=True); ap.add_argument('--sfx-dir', default='sfx')
    ap.add_argument('--duration', type=float); ap.add_argument('--out', default='mix.wav')
    ap.add_argument('--music'); ap.add_argument('--music-db', type=float, default=-6); ap.add_argument('--music-start', type=float, default=0)
    ap.add_argument('--music-fade', type=float, default=1.5)
    ap.add_argument('--music-dips', default='', help='音乐按时间段压低，如 "9.3-9.9:-24,13.2-13.4:-12"（重音前让音乐收住）')
    ap.add_argument('--voice'); ap.add_argument('--duck-db', type=float, default=10)
    ap.add_argument('--sfx-db', type=float, default=0, help='音效总线增益')
    ap.add_argument('--lufs', type=float, default=-14); ap.add_argument('--tp', type=float, default=-1.5)
    a = ap.parse_args()
    data = json.load(open(a.cues, encoding='utf-8'))
    cues = data['cues'] if isinstance(data, dict) else data
    dur = a.duration or (data.get('duration') if isinstance(data, dict) else None)
    if not dur: raise SystemExit('需要 --duration')
    n = int(SR * dur)
    bus = np.zeros((n + SR * 3, 2))
    counters = {}
    cues = sorted(cues, key=lambda c: c['t'])
    log = []
    placed = []
    for i, c in enumerate(cues):
        path = resolve(c['sfx'], a.sfx_dir, counters)
        x = load(path)
        base = os.path.basename(path).split('_')[0].split('.')[0]
        align = c.get('align') or ('end' if base in END_ALIGN else 'peak')
        anchor = {'start': 0, 'peak': peak_index(x), 'end': len(x)}[align]
        g = 10 ** ((c.get('gain', 0) + a.sfx_db) / 20)
        # 扎堆压低：只在“同为瞬态”的音效 0.15s 内重叠时生效；end 对齐（riser/reverse）与重音叠在同一刻是有意设计，不压
        if align != 'end':
            crowd = sum(1 for d in placed if d[1] != 'end' and abs(c['t'] - d[0]) < 0.15)
            g *= 0.7 ** crowd
        placed.append((c['t'], align))
        pan = float(c.get('pan', 0))
        if pan:
            x = x * np.array([np.sqrt(1 - max(0, pan)), np.sqrt(1 + min(0, pan))])
        s = int(round(c['t'] * SR)) - anchor
        if s < 0: print(f"  ! {c['t']:.3f}s {os.path.basename(path)} 开头被截掉 {-s / SR:.2f}s（音效比它前面的时间还长）：换短一点的变体或推迟这个事件")
        a0, b0 = max(0, s), min(len(bus), s + len(x))
        if b0 > a0: bus[a0:b0] += g * x[a0 - s: b0 - s]
        log.append(f"  {c['t']:7.3f}s  {os.path.basename(path):<14} align={align:<5} gain={20*np.log10(g+1e-9):+.1f}dB")
    mix = bus[:n].copy()
    voice = None
    if a.voice:
        voice = load(a.voice)[:n]; voice = np.pad(voice, ((0, n - len(voice)), (0, 0)))
        mix += voice
    if a.music:
        m = load(a.music)
        s = int(a.music_start * SR); m = m[s: s + n]; m = np.pad(m, ((0, n - len(m)), (0, 0)))
        f = int(SR * a.music_fade); m[-f:] *= np.linspace(1, 0, f)[:, None]
        for part in filter(None, a.music_dips.split(',')):
            rng_, db = part.split(':'); s0, s1 = map(float, rng_.split('-'))
            env = np.ones(n); r = int(SR * 0.06)
            i0, i1 = int(s0 * SR), int(s1 * SR)
            env[i0:i1] = 10 ** (float(db) / 20)
            env = np.convolve(env, np.ones(r) / r, mode='same')  # 60ms 平滑，避免咔哒
            m *= env[:, None]
        m *= 10 ** (a.music_db / 20)
        if voice is not None:
            e = env_follow(voice); thr = np.percentile(e[e > 0], 30) if np.any(e > 0) else 1
            duck = 10 ** (-a.duck_db * np.clip(e / (thr + 1e-9), 0, 1) / 20)
            m *= duck[:, None]
        mix += m
    tmp = a.out + '.pre.wav'
    pk = np.max(np.abs(mix)) + 1e-9
    wavfile.write(tmp, SR, (mix / max(1, pk / 0.95)).astype(np.float32))
    I, P = loudnorm(tmp, a.out, a.lufs, a.tp)
    os.remove(tmp)
    print('音效摆放：\n' + '\n'.join(log))
    print(f'输出 {a.out} · {dur:.2f}s · 积分响度 {I} LUFS · 峰值 {P} dBFS（目标 {a.lufs} / {a.tp}）')

if __name__ == '__main__':
    main()
