#!/usr/bin/env python
"""字体获取：大体积字体不随 skill 分发，首次使用时在线下载到 assets/fonts/（已被 .gitignore 忽略）。

清单：assets/fonts/fonts.json（IBM Plex Sans SC 1.1.0、Noto Serif SC 2.003，SIL OFL 1.1）。
Inter 体积小，随 skill 分发，不在清单里。

用法：
  python fetch_fonts.py --check            # 输出 JSON：哪些字体已就绪
  python fetch_fonts.py --fetch            # 下载默认需要的 3 个字体（约 40 MB）：Plex SemiBold、Plex Medium、Noto Serif SC
  python fetch_fonts.py --fetch --all      # 另加其余 6 个备用字重的 Plex（约 40 MB）
  python fetch_fonts.py --install <文件夹或zip>   # 网络不通时：手动下载后按文件名安装

其他脚本通过 ensure(文件名) 取字体：已有就直接用，缺了自动下载，下载失败会列出地址并退出。
查找顺序：环境变量 LEAD_FONT_DIR → <skill>/assets/fonts/。
"""
import glob, hashlib, json, os, shutil, sys, tempfile, time, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.normpath(os.path.join(HERE, "..", "assets", "fonts"))
MANIFEST = os.path.join(FONT_DIR, "fonts.json")


def manifest():
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def locate(name):
    for d in [os.environ.get("LEAD_FONT_DIR"), FONT_DIR]:
        if d:
            p = os.path.join(d, name)
            if os.path.isfile(p) and os.path.getsize(p) > 0:
                return p
    return None


def _valid(p, sha=None):
    from fontTools.ttLib import TTFont
    try:
        TTFont(p, lazy=True)["name"]
    except Exception:
        return False
    if sha:
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        if h.hexdigest() != sha:
            print(f"  ! {os.path.basename(p)} 的 SHA-256 与清单不同（上游可能更新过），已按有效字体接受", file=sys.stderr)
    return True


def fetch(entries):
    miss = [e for e in entries if not locate(e["file"])]
    if not miss:
        return True
    os.makedirs(FONT_DIR, exist_ok=True)
    print(f"下载 {len(miss)} 个字体到 {FONT_DIR}（只下一次）", file=sys.stderr)
    fails = []
    for i, e in enumerate(miss, 1):
        dst = os.path.join(FONT_DIR, e["file"])
        tmp = dst + ".part"
        for attempt in range(3):
            try:
                t0 = time.time()
                req = urllib.request.Request(e["url"], headers={"User-Agent": "lead-fonts"})
                with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as o:
                    shutil.copyfileobj(r, o, 1 << 20)
                if not _valid(tmp, e.get("sha256")):
                    raise ValueError("下载的文件不是有效字体")
                os.replace(tmp, dst)
                print(f"  ✓ [{i}/{len(miss)}] {e['file']}  {os.path.getsize(dst) >> 20} MB  {time.time() - t0:.0f}s", file=sys.stderr)
                break
            except Exception as ex:
                if os.path.exists(tmp):
                    os.remove(tmp)
                if attempt == 2:
                    fails.append(e)
                    print(f"  ✗ {e['file']}：{ex}", file=sys.stderr)
                else:
                    time.sleep(2)
    if fails:
        print("\n有字体没下载成功。可稍后重跑，或手动下载后用 --install 安装：", file=sys.stderr)
        for e in fails:
            print(f"  {e['url']}", file=sys.stderr)
        return False
    return True


def ensure(name):
    """返回字体绝对路径；缺失则自动下载。清单外的文件（如随 skill 分发的 Inter）只查本地。"""
    p = locate(name)
    if p:
        return p
    entry = next((e for e in manifest()["fonts"] if e["file"] == name), None)
    if entry and fetch([entry]):
        return locate(name)
    raise SystemExit(f"找不到字体 {name}：运行 python {os.path.join(HERE, 'fetch_fonts.py')} --fetch，"
                     f"或手动下载后用 --install 安装（见 assets/fonts/README.md）")


def check(m):
    have = {e["file"]: locate(e["file"]) for e in m["fonts"]}
    return {"default_ready": all(have[e["file"]] for e in m["fonts"] if e["default"]),
            "missing": [k for k, v in have.items() if not v],
            "found": {k: v for k, v in have.items() if v}, "download_dir": FONT_DIR}


def install(src, m):
    tmp = None
    if zipfile.is_zipfile(src):
        tmp = tempfile.mkdtemp()
        zipfile.ZipFile(src).extractall(tmp)
        src = tmp
    want = {e["file"] for e in m["fonts"]}
    os.makedirs(FONT_DIR, exist_ok=True)
    n = 0
    for p in glob.glob(os.path.join(src, "**", "*"), recursive=True):
        if os.path.basename(p) in want:
            shutil.copy(p, os.path.join(FONT_DIR, os.path.basename(p)))
            n += 1
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"已安装 {n} 个字体到 {FONT_DIR}")
    print(json.dumps(check(m), ensure_ascii=False, indent=1))


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--all", action="store_true", help="--fetch 时连备用字重一起下载")
    ap.add_argument("--install")
    a = ap.parse_args()
    m = manifest()
    if a.check:
        print(json.dumps(check(m), ensure_ascii=False, indent=1))
    elif a.fetch:
        sys.exit(0 if fetch([e for e in m["fonts"] if a.all or e["default"]]) else 1)
    elif a.install:
        install(a.install, m)
    else:
        ap.error("需要 --check / --fetch / --install")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
