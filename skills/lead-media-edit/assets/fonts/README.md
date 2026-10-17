# 字体库（完整版，未子集化）

本 skill 用到的全部字体都放在这里，脚本默认从这里取，不用每次搜索字体位置。

| 文件 | 内部名 | 用途 |
| --- | --- | --- |
| `IBMPlexSansSC-Thin.otf` | IBM Plex Sans SC Thin | 备用字重（100） |
| `IBMPlexSansSC-ExtraLight.otf` | IBM Plex Sans SC ExtLt | 备用字重（200） |
| `IBMPlexSansSC-Light.otf` | IBM Plex Sans SC Light | 备用字重（300） |
| `IBMPlexSansSC-Regular.otf` | IBM Plex Sans SC | 备用字重（400） |
| `IBMPlexSansSC-Text.otf` | IBM Plex Sans SC Text | 备用字重（450） |
| `IBMPlexSansSC-Medium.otf` | IBM Plex Sans SC Medm | B-roll 正文（500） |
| `IBMPlexSansSC-SemiBold.otf` | IBM Plex Sans SC SmBld | **字幕**（make_subtitles / final_compose 默认）+ B-roll 标题（600） |
| `IBMPlexSansSC-Bold.otf` | IBM Plex Sans SC Bold | 备用字重（700） |
| `Inter-Medium.ttf` / `Inter-SemiBold.ttf` | Inter Medium / SemiBold | B-roll 数字与英文（500/600） |
| `NotoSerifSC-VF.ttf` | Noto Serif SC（可变字体 200–900） | B-roll 衬线标题 |

- IBM Plex Sans SC 每个字重约 7 MB、29562 字形；Noto Serif SC 可变字体约 24 MB。
- B-roll 用法：`python scripts/subset_fonts.py <motion目录>` 会按 `src/engine/fonts.ts` 登记的文件名从这里取字体，按用字子集化后放到 `<motion目录>/public/fonts/`。要用备用字重时，先在 `fonts.ts` 登记，再重跑子集化。
- 不要把 B-roll 工程 `public/fonts/` 里的同名文件拷回这里：那些是子集化版本，只有几百个字形，做字幕会缺字。
- 许可：IBM Plex（https://github.com/IBM/plex，© IBM Corp.）、Inter（https://github.com/rsms/inter，© The Inter Project Authors）、Noto Serif SC（https://github.com/notofonts/noto-cjk，© Google / Adobe）都用 SIL Open Font License 1.1（https://openfontlicense.org），可以随项目分发和嵌入。

随附完整许可与字体版权声明：[IBM Plex](OFL-IBM-Plex.txt)、[Inter](OFL-Inter.txt)、[Noto Serif](OFL-Noto-Serif.txt)。分发字体或子集时保留对应许可与版权声明，并遵守许可中的 Reserved Font Name 条件；字体不适用本项目的 MIT 许可。
