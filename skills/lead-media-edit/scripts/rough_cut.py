# -*- coding: utf-8 -*-
"""按保留片段（EDL）粗剪，并把逐字时间戳映射到成片时间。

python rough_cut.py <source.mp4> <edl.json> <out_dir> [--words transcript.json] [--fade 0.012] [--encoder auto]

edl.json:
{"keep":[{"s":1.9,"e":13.1,"note":"开头到“一张纸”"}, ...],
 "removed":[{"s":13.1,"e":15.7,"reason":"“橘子皮压平”第一遍未说完，保留第二遍"}, ...]}

输出：
  rough.mp4          粗剪成片（原分辨率/帧率，高码率中间文件）
  timeline_map.json  每段 {src_s, src_e, out_s, out_e}
  words_out.json     映射到成片时间的逐字时间戳（只保留落在保留片段内的字）
"""
import argparse
import json
import os
import subprocess
import sys


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=r_frame_rate,width,height", "-of", "json", path],
                         capture_output=True, text=True).stdout
    st = json.loads(out)["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    return float(num) / float(den), st["width"], st["height"]


def has_encoder(name):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    return name in out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("edl")
    ap.add_argument("out_dir")
    ap.add_argument("--words")
    ap.add_argument("--fade", type=float, default=0.012)
    ap.add_argument("--encoder", default="auto")
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    edl = json.load(open(a.edl, encoding="utf-8"))
    fps, w, h = probe(a.source)
    fps_str = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                              "stream=r_frame_rate", "-of", "default=nw=1:nk=1", a.source],
                             capture_output=True, text=True).stdout.strip()

    # 片段边界吸附到帧，保证音视频切点一致
    segs = []
    for k in edl["keep"]:
        s = round(k["s"] * fps) / fps
        e = round(k["e"] * fps) / fps
        segs.append((s, e))

    parts, labels = [], []
    for i, (s, e) in enumerate(segs):
        d = e - s
        parts.append(f"[0:v]trim=start={s:.6f}:end={e:.6f},setpts=PTS-STARTPTS[v{i}]")
        parts.append(f"[0:a]atrim=start={s:.6f}:end={e:.6f},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:st=0:d={a.fade},afade=t=out:st={max(0, d - a.fade):.6f}:d={a.fade}[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    parts.append("".join(labels) + f"concat=n={len(segs)}:v=1:a=1[vc][a]")
    # concat 输出帧率元数据可能丢失（部分构建默认 25fps 会丢帧），显式恢复原片帧率
    parts.append(f"[vc]fps={fps_str}[v]")
    fc = ";".join(parts)

    enc = a.encoder
    if enc == "auto":
        enc = "h264_nvenc" if has_encoder("h264_nvenc") else "libx264"
    venc = (["-c:v", "h264_nvenc", "-preset", "p7", "-rc", "vbr", "-cq", "14", "-b:v", "0", "-profile:v", "high"]
            if enc == "h264_nvenc" else ["-c:v", "libx264", "-preset", "medium", "-crf", "14"])
    out_mp4 = os.path.join(a.out_dir, "rough.mp4")
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", a.source, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-dn", "-map_metadata", "-1",
           "-r", fps_str,
           *venc, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", out_mp4]
    print("encoding with", enc, flush=True)
    subprocess.run(cmd, check=True)

    tmap, t = [], 0.0
    for s, e in segs:
        tmap.append({"src_s": round(s, 4), "src_e": round(e, 4), "out_s": round(t, 4), "out_e": round(t + e - s, 4)})
        t += e - s
    json.dump({"fps": fps, "width": w, "height": h, "duration": round(t, 4), "segments": tmap},
              open(os.path.join(a.out_dir, "timeline_map.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if a.words:
        words = json.load(open(a.words, encoding="utf-8"))["words"]
        out = []
        for wd in words:
            mid = (wd["s"] + wd["e"]) / 2
            for m in tmap:
                if m["src_s"] <= mid <= m["src_e"]:
                    off = m["out_s"] - m["src_s"]
                    out.append({**wd, "s": round(max(m["out_s"], wd["s"] + off), 3),
                                "e": round(min(m["out_e"], wd["e"] + off), 3)})
                    break
        json.dump({"words": out}, open(os.path.join(a.out_dir, "words_out.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    print(f"done: {len(segs)} segments, {t:.2f}s")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
