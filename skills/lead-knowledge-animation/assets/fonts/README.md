# 字体（不随 skill 分发，不进 git）

skill 只带下载清单 `fonts.json`。**首次使用时自动在线下载**（`new_film.mjs` 会调用 `scripts/fonts.py --fetch`），存到
**本目录**（`.gitignore` 已忽略，不进 git；skill 升级覆盖后字体没了，下次使用会自动重新下载）。合计约 220 MB，只下一次。均为 SIL OFL 1.1，可商用、可嵌入。

| 页面里的字族名 | 字体 | 字重（CSS font-weight） | 下载地址 |
|---|---|---|---|
| `Plex` | IBM Plex Sans SC 1.1.0 | Thin 100 · ExtraLight 200 · Light 300 · Regular 400 · Text 450 · Medium 500 · SemiBold 600 · Bold 700 | `https://raw.githubusercontent.com/IBM/plex/%40ibm/plex-sans-sc%401.1.0/packages/plex-sans-sc/fonts/complete/otf/unhinted/IBMPlexSansSC-<字重>.otf`（发布页：https://github.com/IBM/plex/releases/tag/%40ibm%2Fplex-sans-sc%401.1.0） |
| `HanSerif` | 思源宋体 Source Han Serif SC 2.003R | ExtraLight 200 · Light 300 · Regular 400 · Medium 500 · SemiBold 600 · Bold 700 · Heavy 900 | `https://raw.githubusercontent.com/adobe-fonts/source-han-serif/2.003R/OTF/SimplifiedChinese/SourceHanSerifSC-<字重>.otf`（发布页：https://github.com/adobe-fonts/source-han-serif/releases/tag/2.003R ，整包 `09_SourceHanSerifSC.zip`） |

每个文件的完整地址见 `fonts.json`。

```bash
python <skill>/scripts/fonts.py --check                  # 哪些已就绪
python <skill>/scripts/fonts.py --fetch                  # 下载缺的（失败会列出地址，可重跑）
python <skill>/scripts/fonts.py --install <文件夹或zip>   # 网络不通时：手动下载后安装（按文件名识别）
```

查找顺序：`LEAD_FONT_DIR` → 本目录 → `~/.claude/skill-data/Lead-知识讲解动画/fonts/`（旧版下载位置，兼容）。手动把同名 .otf 放进本目录也能用。

注意：完整中文 OTF 直接给 Chromium 会报 `OTS parsing error: CFF`，并静默回退到系统字体。
new_film.mjs 复制时会自动用 scripts/fonts.py 按屏上用字做子集；改了文字后重跑 `fonts.py film/`。
