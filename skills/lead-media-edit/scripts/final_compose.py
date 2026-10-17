# -*- coding: utf-8 -*-
"""最终合成：在 B-roll 母版上烧录 ASS 字幕 + 整体响度标准化，导出发布用 MP4。

python final_compose.py --video broll_master.mp4 --audio mix.wav --ass 字幕.ass --out 成片.mp4
    [--fonts-dir fonts]
    [--I -16] [--TP -1.5] [--encoder auto]

--fonts-dir 可选：默认只用本 skill assets/fonts/ 里的 IBMPlexSansSC-SemiBold.otf（不把整个字体库拷进临时目录）。
--audio 可选：给出时用它（mix_audio.py 的混音结果）替换母版里的音轨。

- 为避免中文路径/冒号在滤镜里转义出错，把 ASS 和字体复制到临时 ASCII 目录再烧录。
- 从 libass 的 fontselect 日志确认实际选中的字体，打印出来；没有选中目标字体时报错退出。
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

DEFAULT_FONTS_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "fonts"))


def probe_fps(path):
    return subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                           "-of", "default=nw=1:nk=1", path], capture_output=True, text=True).stdout.strip()


def measure_loudness(path, I, TP):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vn", "-af",
                        f"loudnorm=I={I}:TP={TP}:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr).group(0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--audio")
    ap.add_argument("--ass", required=True)
    ap.add_argument("--fonts-dir", default=DEFAULT_FONTS_DIR)
    ap.add_argument("--out", required=True)
    ap.add_argument("--I", type=float, default=-16)
    ap.add_argument("--TP", type=float, default=-1.5)
    ap.add_argument("--encoder", default="auto")
    ap.add_argument("--expect-font", default="SmBld")
    a = ap.parse_args()

    video = os.path.abspath(a.video)
    out = os.path.abspath(a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fps = probe_fps(video)
    audio = os.path.abspath(a.audio) if a.audio else video
    d = measure_loudness(audio, a.I, a.TP)
    af = (f"loudnorm=I={a.I}:TP={a.TP}:LRA=11:measured_I={d['input_i']}:measured_TP={d['input_tp']}"
          f":measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true")

    encs = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    enc = a.encoder if a.encoder != "auto" else ("h264_nvenc" if "h264_nvenc" in encs else "libx264")
    venc = (["-c:v", "h264_nvenc", "-preset", "p7", "-tune", "hq", "-rc", "vbr", "-cq", "18", "-b:v", "50M",
             "-maxrate", "90M", "-bufsize", "120M", "-profile:v", "high"]
            if enc == "h264_nvenc" else ["-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high"])

    tmp = tempfile.mkdtemp(prefix="koubo_")
    try:
        shutil.copy(a.ass, os.path.join(tmp, "sub.ass"))
        if os.path.normpath(a.fonts_dir) == DEFAULT_FONTS_DIR:
            os.makedirs(os.path.join(tmp, "fonts"))
            shutil.copy(os.path.join(DEFAULT_FONTS_DIR, "IBMPlexSansSC-SemiBold.otf"), os.path.join(tmp, "fonts"))
        else:
            shutil.copytree(a.fonts_dir, os.path.join(tmp, "fonts"), ignore=shutil.ignore_patterns("*.txt", "*.md"))
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "verbose", "-i", video, "-i", audio,
               "-map", "0:v:0", "-map", "1:a:0", "-shortest",
               "-vf", "ass=sub.ass:fontsdir=fonts", "-af", af,
               *venc, "-pix_fmt", "yuv420p", "-r", fps,
               "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
               "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", out]
        print("encoding with", enc, flush=True)
        r = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            print(r.stderr[-3000:])
            raise SystemExit("ffmpeg 失败")
        sel = sorted(set(re.findall(r"fontselect: \((.*?)\) -> (.*)", r.stderr)))
        for s in sel:
            print("fontselect:", s[0], "->", s[1])
        if not sel or not all(a.expect_font in s[1] or a.expect_font.lower() in s[1].lower() for s in sel):
            raise SystemExit(f"字幕字体没有选中 {a.expect_font}，请检查 fonts 目录（不允许静默回退）")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("done:", out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
