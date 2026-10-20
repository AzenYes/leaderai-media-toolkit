# 字体库

大体积字体（IBM Plex Sans SC、Noto Serif SC，合计约 80 MB）**不随 skill 分发、不进 git**，只保留下载清单 [`fonts.json`](fonts.json)，首次使用时自动下载到本目录。体积很小的 Inter（两个文件约 0.6 MB）和三份 OFL 许可原文随 skill 分发。

| 文件 | 来源 | 用途 | 获取方式 |
| --- | --- | --- | --- |
| `IBMPlexSansSC-SemiBold.otf` | IBM Plex Sans SC 1.1.0 | **字幕**（make_subtitles / final_compose 默认）+ B-roll 标题（600） | 自动下载（默认） |
| `IBMPlexSansSC-Medium.otf` | 同上 | B-roll 正文（500） | 自动下载（默认） |
| `NotoSerifSC-VF.ttf` | Noto Serif SC 2.003 可变字体（200–900） | B-roll 衬线标题 | 自动下载（默认） |
| `IBMPlexSansSC-Thin / ExtraLight / Light / Regular / Text / Bold.otf` | IBM Plex Sans SC 1.1.0 | 备用字重（100/200/300/400/450/700） | `--fetch --all` 按需下载 |
| `Inter-Medium.ttf` / `Inter-SemiBold.ttf` | Inter 3.19 | B-roll 数字与英文（500/600） | 随 skill 分发 |

```bash
python scripts/fetch_fonts.py --check                    # 哪些字体已就绪
python scripts/fetch_fonts.py --fetch                    # 下载默认需要的 3 个（约 40 MB）
python scripts/fetch_fonts.py --fetch --all              # 另加 6 个备用字重
python scripts/fetch_fonts.py --install <文件夹或zip>     # 网络不通时：手动下载后按文件名安装
```

- 不用手动执行也可以：`make_subtitles.py`、`final_compose.py`、`subset_fonts.py` 找不到需要的字体时会自己下载；下载失败会列出地址并退出，不会静默换字体。
- 查找顺序：环境变量 `LEAD_FONT_DIR` → 本目录。
- 下载地址和完整性：地址写在 `fonts.json`（IBM Plex 来自 [IBM/plex 1.1.0](https://github.com/IBM/plex/releases/tag/%40ibm%2Fplex-sans-sc%401.1.0)，Noto Serif SC 来自 [notofonts/noto-cjk 的 Serif2.003 标签](https://github.com/notofonts/noto-cjk/tree/Serif2.003/Serif/Variable/TTF/Subset)）；默认 3 个字体附 SHA-256，下载后校验是否为有效字体，哈希不同会提示但仍接受。
- 备用字重要启用时，先在动效工程 `src/engine/fonts.ts` 登记，再 `fetch_fonts.py --fetch --all`，重跑子集化。
- 不要把 B-roll 工程 `public/fonts/` 里的同名文件拷回这里：那些是子集化版本，只有几百个字形，做字幕会缺字。
- 许可：IBM Plex（© IBM Corp.）、Inter（© The Inter Project Authors）、Noto Serif SC（© Google / Adobe）都用 SIL Open Font License 1.1（https://openfontlicense.org），可以随项目分发和嵌入。完整许可与版权声明：[IBM Plex](OFL-IBM-Plex.txt)、[Inter](OFL-Inter.txt)、[Noto Serif](OFL-Noto-Serif.txt)。分发字体或子集时保留对应许可与版权声明，并遵守 Reserved Font Name 条件；字体不适用本项目的 MIT 许可。
