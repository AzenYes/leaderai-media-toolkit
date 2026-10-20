#!/usr/bin/env python
"""内置 BGM 检测 / 获取（曲子不随 skill 分发，是单独的配套包）。

用法：
  python bgm.py --check            # 输出 JSON：{"available": bool, "mp3": 路径, "beats": 路径, ...}
  python bgm.py --fetch            # 本机没有时，按 assets/music/music.json 里的 url 下载并校验 sha256
  python bgm.py --install <文件夹或zip>   # 把配套包装到用户数据目录

查找顺序：环境变量 LEAD_BGM_DIR → ~/.claude/skill-data/Lead-知识讲解动画/music/ → <skill>/assets/music/
装在用户数据目录里，skill 升级覆盖时曲子不会丢。
"""
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import argparse, hashlib, json, os, shutil, tempfile, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, '..'))
MANIFEST = os.path.join(SKILL, 'assets', 'music', 'music.json')
USER_DIR = os.path.join(os.path.expanduser('~'), '.claude', 'skill-data', 'Lead-知识讲解动画', 'music')

def manifest():
    return json.load(open(MANIFEST, encoding='utf-8'))

def dirs():
    d = []
    if os.environ.get('LEAD_BGM_DIR'): d.append(os.environ['LEAD_BGM_DIR'])
    d += [USER_DIR, os.path.join(SKILL, 'assets', 'music')]
    return d

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()

def find(m):
    for d in dirs():
        mp3 = os.path.join(d, m['file'])
        if os.path.isfile(mp3):
            beats = os.path.join(d, m['beats'])
            return {'available': True, 'mp3': mp3, 'beats': beats if os.path.isfile(beats) else None,
                    'sha256_ok': sha(mp3) == m['sha256'], 'name': m['name'], 'duration_s': m['duration_s']}
    return {'available': False, 'name': m['name'], 'searched': dirs(), 'url_configured': bool(m.get('url'))}

def put(src_mp3, src_beats, m):
    os.makedirs(USER_DIR, exist_ok=True)
    shutil.copy(src_mp3, os.path.join(USER_DIR, m['file']))
    if src_beats and os.path.isfile(src_beats): shutil.copy(src_beats, os.path.join(USER_DIR, m['beats']))

def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--check', action='store_true'); g.add_argument('--fetch', action='store_true'); g.add_argument('--install')
    a = ap.parse_args(); m = manifest()
    if a.check:
        print(json.dumps(find(m), ensure_ascii=False, indent=1)); return
    if a.install:
        src = a.install; tmp = None
        if zipfile.is_zipfile(src):
            tmp = tempfile.mkdtemp(); zipfile.ZipFile(src).extractall(tmp); src = tmp
        mp3 = next((os.path.join(r, m['file']) for r, _, fs in os.walk(src) if m['file'] in fs), None)
        if not mp3: sys.exit(f"没找到 {m['file']}")
        if sha(mp3) != m['sha256']: sys.exit('校验失败：这不是配套包里的那首曲子')
        put(mp3, os.path.join(os.path.dirname(mp3), m['beats']), m)
        print('已安装到', USER_DIR); return
    cur = find(m)
    if cur['available']: print('本机已有：', cur['mp3']); return
    if not m.get('url'): sys.exit('未配置下载地址：请向 skill 作者获取配套包，再运行 --install')
    tmp = os.path.join(tempfile.mkdtemp(), m['file'])
    urllib.request.urlretrieve(m['url'], tmp)
    if sha(tmp) != m['sha256']: sys.exit('下载文件校验失败（sha256 不符），已丢弃')
    put(tmp, None, m); print('已下载到', USER_DIR, '（节拍表需随配套包安装；缺省时用 beats.py 现测）')

if __name__ == '__main__':
    main()
