# 口播动效模板

这是剪辑 skill 的 Remotion 工程模板。先将整个目录复制到工作项目的 `.code/<项目名>/motion/`，在副本中编辑，避免把用户素材提交到工具包。

## 通用模板

- `src/engine/`：人物全屏与圆环切换、缓动、字体加载、配色、颗粒及音效类型。
- `src/project.ts`：视频文件名、帧率、时长、人物位置与人物状态切换时间。
- `src/scenes/`：当前视频的讲解场景；`Example.tsx` 为最小示例。
- `src/sfx.json`：音效时间表。最终音频按 skill 的 Python 脚本离线混合。

环境：Node.js 22+、npm，以及可用于 Remotion 的 Chromium。安装并检查：

```bash
npm ci
npm run typecheck
```

在 `public/` 放入 `rough.mp4`。还需准备以下字体，由 skill 的 `scripts/subset_fonts.py` 按当前工程用字生成到 `public/fonts/`：

```text
NotoSerifSC-VF.ttf
IBMPlexSansSC-Medium.otf
IBMPlexSansSC-SemiBold.otf
Inter-Medium.ttf
Inter-SemiBold.ttf
```

官方来源：[IBM Plex](https://github.com/IBM/plex)、[Noto CJK](https://github.com/notofonts/noto-cjk)、[Inter](https://github.com/rsms/inter)。字体不在仓库内；下载或子集化后按字体许可保留声明。若下载文件名不同，需同步调整 `src/engine/fonts.ts`。缺少字体会中止渲染，不会静默换字体。

修改 `src/project.ts` 和场景后，可运行 `npm run studio` 预览。仍需先准备视频与字体。实际视频制作、静帧检查、音效混合与最终导出按上一级 `SKILL.md` 执行。

## 启用「格陵兰没那么大」案例

案例包含地图投影、三维地球与持续镜头场景，是代码示例；口播视频、字体和最终成片需自行提供。地图与示例数字在制作真实内容时仍应核实。

在**工作副本**中按此映射复制并覆盖模板文件：

| 案例源文件 | 工作副本目标 |
| --- | --- |
| `examples/格陵兰没那么大/Story.tsx` | `src/Story.tsx` |
| `examples/格陵兰没那么大/project.ts` | `src/project.ts` |
| `examples/格陵兰没那么大/sfx.json` | `src/sfx.json` |
| `examples/格陵兰没那么大/scenes/` 中全部文件 | `src/scenes/` |
| `examples/格陵兰没那么大/world.json` | `src/data/world.json` |

案例代码与模板共用 `src/engine/`。复制后重新运行 `npm run typecheck`，并按自己原片调整时长、帧率、人物位置和切换时间。示例地图来源与许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
