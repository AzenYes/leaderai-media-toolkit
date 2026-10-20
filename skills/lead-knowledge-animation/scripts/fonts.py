#!/usr/bin/env python
"""字体：在线获取（首次使用）+ 子集化。

字体不随 skill 分发（不进 git）。下载地址写在 assets/fonts/fonts.json：
  IBM Plex Sans SC 1.1.0 全部 8 个字重（Thin/ExtraLight/Light/Regular/Text/Medium/SemiBold/Bold）
  思源宋体 Source Han Serif SC 2.003R 全部 7 个字重（ExtraLight/Light/Regular/Medium/SemiBold/Bold/Heavy）
均为 SIL OFL 1.1，可商用、可嵌入。合计约 220 MB，只下载一次。

用法：
  python fonts.py --check                 # 输出 JSON：哪些字体已就绪、存放目录
  python fonts.py --fetch                 # 下载缺的字体（new_film.mjs 首次使用时会自动调用）
  python fonts.py --install <文件夹或zip>  # 网络不通时：把手动下载的 .otf 装进 <skill>/assets/fonts/
  python fonts.py film/                   # 子集化：改了屏上文字后重跑一次
  python fonts.py film/ --extra "0123456789:%+-.,·×"   # 运行时才生成的字（数字滚动等）

下载到 skill 内部的 <skill>/assets/fonts/（已被 .gitignore 忽略，不进 git）。skill 升级覆盖后字体没了也没关系：下次使用会自动重新下载。
查找顺序：环境变量 LEAD_FONT_DIR → <skill>/assets/fonts/ → ~/.claude/skill-data/Lead-知识讲解动画/fonts/（旧版下载位置，兼容）

为什么必须子集化：完整的中文 CFF/OTF 字体在 Chromium 中会触发
`OTS parsing error: CFF : Failed validating CharStrings INDEX`，页面静默回退到系统字体。
子集化（并去掉 CFF 子程序）后体积小、加载快、渲染一致。子集化会读取 film/ 下所有
.html/.js/.json/.md 里的字符（含 JS 字符串），加上 ASCII 与常用标点，为 film/fonts/ 里每个
能找到原字体的文件生成子集（原文件名不变，@font-face 无需修改）。
"""
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse, os, glob, json, logging, shutil, tempfile, time, urllib.request, zipfile
logging.getLogger('fontTools').setLevel(logging.ERROR)

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, '..'))
MANIFEST = os.path.join(SKILL, 'assets', 'fonts', 'fonts.json')
FONT_DIR = os.path.join(SKILL, 'assets', 'fonts')   # 下载 / 安装目标
LEGACY_DIR = os.path.join(os.path.expanduser('~'), '.claude', 'skill-data', 'Lead-知识讲解动画', 'fonts')
BASE = ''.join(chr(c) for c in range(0x20, 0x7f)) + '，。、：；！？「」『』（）《》〈〉【】—…·～“”‘’％＋－×÷→←↑↓●○■□▲△★☆✓✗'

def manifest():
    return json.load(open(MANIFEST, encoding='utf-8'))

def dirs():
    d = []
    if os.environ.get('LEAD_FONT_DIR'): d.append(os.environ['LEAD_FONT_DIR'])
    return d + [FONT_DIR, LEGACY_DIR]

def locate(name):
    for d in dirs():
        p = os.path.join(d, name)
        if os.path.isfile(p) and os.path.getsize(p) > 0: return p
    return None

def check(m):
    have = {f['file']: locate(f['file']) for f in m['fonts']}
    return {'ready': all(have.values()), 'missing': [k for k, v in have.items() if not v],
            'found': {k: v for k, v in have.items() if v}, 'download_dir': FONT_DIR}

def valid(p):
    from fontTools.ttLib import TTFont
    try: TTFont(p, lazy=True)['name']; return True
    except Exception: return False

def fetch(m):
    miss = [f for f in m['fonts'] if not locate(f['file'])]
    if not miss: print('字体已就绪，无需下载。'); return True
    os.makedirs(FONT_DIR, exist_ok=True)
    print(f'首次使用：下载 {len(miss)} 个字体到 {FONT_DIR}（约 220 MB，只下一次）')
    fails = []
    for i, f in enumerate(miss, 1):
        dst = os.path.join(FONT_DIR, f['file']); tmp = dst + '.part'
        for attempt in range(3):
            try:
                t0 = time.time()
                with urllib.request.urlopen(urllib.request.Request(f['url'], headers={'User-Agent': 'lead-fonts'}), timeout=60) as r, open(tmp, 'wb') as o:
                    shutil.copyfileobj(r, o, 1 << 20)
                if not valid(tmp): raise ValueError('下载的文件不是有效字体')
                os.replace(tmp, dst)
                print(f'  ✓ [{i}/{len(miss)}] {f["file"]}  {os.path.getsize(dst) >> 20} MB  {time.time() - t0:.0f}s'); break
            except Exception as e:
                if os.path.exists(tmp): os.remove(tmp)
                if attempt == 2: fails.append(f); print(f'  ✗ {f["file"]}：{e}')
                else: time.sleep(2)
    if fails:
        print('\n有字体没下载成功。可以稍后重跑 fonts.py --fetch，或手动下载后用 --install 安装：')
        for f in fails: print(f'  {f["url"]}')
        for k, v in m['families'].items(): print(f'  整包发布页（{v["name"]}）：{v["release"]}')
        return False
    return True

def install(src, m):
    tmp = None
    if zipfile.is_zipfile(src): tmp = tempfile.mkdtemp(); zipfile.ZipFile(src).extractall(tmp); src = tmp
    want = {f['file'] for f in m['fonts']}; os.makedirs(FONT_DIR, exist_ok=True); n = 0
    for p in glob.glob(os.path.join(src, '**', '*.otf'), recursive=True):
        if os.path.basename(p) in want: shutil.copy(p, os.path.join(FONT_DIR, os.path.basename(p))); n += 1
    if tmp: shutil.rmtree(tmp, ignore_errors=True)
    print(f'已安装 {n} 个字体到 {FONT_DIR}'); print(json.dumps(check(m), ensure_ascii=False, indent=1))

def subset_film(film, extra):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    text = set(BASE + extra + '0123456789')
    for f in glob.glob(os.path.join(film, '**', '*'), recursive=True):
        if os.path.splitext(f)[1].lower() in ('.html', '.js', '.json', '.md', '.txt') and os.path.isfile(f) and 'fonts' not in f:
            if os.path.basename(f) == 'motion.js': continue
            text |= set(open(f, encoding='utf-8', errors='ignore').read())
    text = ''.join(sorted(c for c in text if ord(c) >= 0x20))
    fdir = os.path.join(film, 'fonts')
    done = 0
    for f in sorted(os.listdir(fdir)) if os.path.isdir(fdir) else []:
        if not f.lower().endswith(('.otf', '.ttf')): continue
        src = locate(f)
        if not src:
            print(f'  · 跳过 {f}（找不到原字体：先跑 fonts.py --fetch；不是 skill 字体的请自行确认它能在 Chromium 加载）'); continue
        opt = subset.Options()
        opt.desubroutinize = True; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True
        opt.hinting = False; opt.glyph_names = False
        font = TTFont(src)
        sub = subset.Subsetter(opt); sub.populate(text=text); sub.subset(font)
        font.save(os.path.join(fdir, f))
        done += 1
        print(f'  ✓ {f}  {os.path.getsize(os.path.join(fdir, f)) // 1024} KB')
    print(f'已子集化 {done} 个字体，覆盖 {len(text)} 个字符。改了屏上文字后要重跑。')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('film', nargs='?'); ap.add_argument('--extra', default='')
    ap.add_argument('--check', action='store_true'); ap.add_argument('--fetch', action='store_true'); ap.add_argument('--install')
    a = ap.parse_args(); m = manifest()
    if a.check: print(json.dumps(check(m), ensure_ascii=False, indent=1)); return
    if a.fetch: _sys.exit(0 if fetch(m) else 1)
    if a.install: install(a.install, m); return
    if not a.film: ap.error('需要 film 目录，或 --check / --fetch / --install')
    subset_film(a.film, a.extra)

if __name__ == '__main__':
    main()
