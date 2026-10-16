# -*- coding: utf-8 -*-
"""成片全盘自检。

python qa_check.py --video 成片.mp4 --text subtitle_text.txt --work 工作素材 [--no-asr]

检查：流信息与时长、完整解码、黑帧、响度、每 2 秒联系表（contact_*.jpg）、
成片音轨重新转写 → 与字幕文本比对 + 重复短语扫描（抓残留的重说）。
结果写入 <work>/qa_report.txt。
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys

PUNCT = re.compile(r"[\s，。！？；：、,.!?;:…“”\"'‘’（）()《》—]")


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--text")
    ap.add_argument("--work", required=True)
    ap.add_argument("--no-asr", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    rep = []

    info = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
                           "stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames,sample_rate:format=duration",
                           "-of", "json", a.video]).stdout)
    rep.append("== 流信息 ==")
    durs = {}
    for s in info["streams"]:
        rep.append(json.dumps(s, ensure_ascii=False))
        durs[s["codec_type"]] = float(s.get("duration", 0))
    if "video" in durs and "audio" in durs:
        diff = abs(durs["video"] - durs["audio"])
        rep.append(f"音视频时长差：{diff * 1000:.1f} ms {'OK' if diff < 0.05 else '⚠ 偏大'}")

    dec = run(["ffmpeg", "-v", "error", "-i", a.video, "-f", "null", "-"])
    errs = [l for l in dec.stderr.splitlines() if l.strip()]
    rep.append(f"\n== 完整解码 ==\n错误行数：{len(errs)}" + ("" if not errs else "\n" + "\n".join(errs[:10])))

    bd = run(["ffmpeg", "-hide_banner", "-i", a.video, "-vf", "scale=480:-2,blackdetect=d=0.08:pix_th=0.06",
              "-an", "-f", "null", "-"])
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd.stderr)
    rep.append("\n== 黑帧 ==\n" + ("无" if not blacks else "\n".join(f"{s}–{e}" for s, e in blacks)))

    lo = run(["ffmpeg", "-hide_banner", "-i", a.video, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"])
    m_i = re.findall(r"I:[ 	]+(-?[0-9.]+) LUFS", lo.stderr.split("Summary")[-1])
    m_p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", lo.stderr)
    rep.append(f"\n== 响度 ==\n整体 {m_i[-1] if m_i else '?'} LUFS，真峰值 {m_p[-1] if m_p else '?'} dBFS")

    dur = float(info["format"]["duration"])
    sheet = os.path.join(a.work, "contact_%02d.jpg")
    run(["ffmpeg", "-y", "-v", "error", "-i", a.video, "-vf", "fps=1/2,scale=640:-2,tile=4x4:padding=6:color=white",
         "-q:v", "3", sheet])
    rep.append(f"\n== 联系表 ==\n{os.path.join(a.work, 'contact_XX.jpg')}（每 2 秒一帧，共 {int(dur // 2) + 1} 帧）")

    if not a.no_asr:
        import whisper
        wav = os.path.join(a.work, "qa_final16k.wav")
        run(["ffmpeg", "-y", "-v", "error", "-i", a.video, "-ac", "1", "-ar", "16000", wav])
        model = whisper.load_model("large-v3-turbo")
        r = model.transcribe(wav, language="zh", condition_on_previous_text=False, temperature=0.0,
                             initial_prompt="以下是普通话口播，使用简体中文。")
        asr = "".join(s["text"] for s in r["segments"])
        rep.append("\n== 成片转写 ==\n" + "\n".join(f"[{s['start']:6.2f}] {s['text'].strip()}" for s in r["segments"]))
        flat = PUNCT.sub("", asr)
        # 重复短语扫描：同一 5 字片段在 10 秒内出现两次 → 可能是残留重说
        seg_text = [(s["start"], PUNCT.sub("", s["text"])) for s in r["segments"]]
        hits = set()
        for i, (t0, s0) in enumerate(seg_text):
            for j in range(i, len(seg_text)):
                t1, s1 = seg_text[j]
                if t1 - t0 > 10:
                    break
                for k in range(len(s0) - 4):
                    g = s0[k:k + 5]
                    start = s1.find(g, k + 5 if i == j else 0)
                    if start >= 0:
                        hits.add(g)
        if a.text:
            txt = PUNCT.sub("", open(a.text, encoding="utf-8").read())
            hits = {h for h in hits if txt.count(h) < 2}
            ratio = difflib.SequenceMatcher(None, txt, flat, autojunk=False).ratio()
            rep.append(f"\n与字幕文本相似度：{ratio:.1%}（识别错字会拉低该值，<85% 需人工核对）")
        rep.append("疑似残留重复：" + ("无" if not hits else "、".join(sorted(hits))))
        # 短孤立段：一个很短的片段，且是下一段的开头（如“俄罗斯 / 俄罗斯也一样”）→ 典型的残留重复起句
        orphans = []
        for (t0, s0), (t1, s1) in zip(seg_text, seg_text[1:]):
            if 0 < len(s0) <= 6 and s1.startswith(s0[:2]):
                orphans.append(f"{t0:.2f}s “{s0}” → “{s1[:10]}”")
        rep.append("疑似残留起句：" + ("无" if not orphans else "；".join(orphans)))

    out = os.path.join(a.work, "qa_report.txt")
    open(out, "w", encoding="utf-8").write("\n".join(rep))
    print("\n".join(rep))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
