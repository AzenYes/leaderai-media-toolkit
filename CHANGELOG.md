# 版本记录

工具包按 Git 标签和 GitHub Release 发布；各 skill 的版本分别记录在其 `SKILL.md` 的 `metadata.version` 中。仅修改工具包文档时，不必同步提升所有 skill 的版本。

## v1.4.0 — 2026-10-20（主分支）

新增第三个 skill「Lead-知识讲解动画」**1.0.0**（`lead-knowledge-animation`）；「Lead-自媒体口播文案」**1.1.1**、「Lead-自媒体口播剪辑」**1.2.1** 无变化。

- 新增 `skills/lead-knowledge-animation/`：从一个知识选题或一句想法，做出发光线描式知识讲解动画（MP4，无配音）。包含 `SKILL.md` 工作流、10 份参考文档（风格范式、叙事与字幕、视觉系统、丰富度与设计秩序、主体与视觉想法、运动语言、工程契约、审片与修改、声音、选题配方）、15 个脚本（建工程 `new_film.mjs`、渲染 `render.mjs`、时间轴 `timeline.py`、审片包 `review_pack.py`、音效与混音 `sfx.py` / `mix.py`、质检 `qa_video.py` 等）和起手件（`motion.js`、`kit.js`、`geo.js`、`index.html`）。
- 字幕规范固定：底部居中、单行、句末无标点；按内容在 IBM Plex Sans SC 与思源宋体之间二选一；开头 5 秒大字金句。
- 字体不随仓库分发：`assets/fonts/fonts.json` 只含下载清单，首次使用时 `fonts.py --fetch` 自动下载（约 220 MB，SIL OFL 1.1）；仓库及 skill 内 `.gitignore` 均不收录字体与音频文件。
- 配套 BGM 另行分发：skill 只带 `music.json` 与 `bgm.py`；本机没有配套曲时 skill 不会向用户提这首曲子。
- 新增 `skills/lead-knowledge-animation/requirements.txt`（numpy、scipy、fonttools）。内置 Natural Earth 110m 世界地图点阵数据（公有领域），已写入 THIRD_PARTY_NOTICES。
- README 新增该 skill 的介绍、使用示例、环境要求与目录结构，并把「两个 skill」的表述更新为三个；插件清单与市场清单版本升至 1.4.0，描述加入知识讲解动画；CONTRIBUTING 补充「字体与音频不入库、首次使用时下载」的约定。

验证：已核对随附文件无作者机器绝对路径和凭据；`fonts.json` 中抽查的 IBM Plex Sans SC 与思源宋体下载地址可访问（HTTP 200）；复制时仅统一了换行符为 LF，正文与脚本内容未改，仅在 `SKILL.md` frontmatter 中补充 `license` 与 `metadata.version`。本次未重新渲染完整成片，也未在隔离环境中重新运行 `claude plugin validate`。

## v1.3.0 — 2026-10-19

改为以中文名分发，安装方式从 Skills CLI 换成 Claude Code 插件市场与手动安装。Skill 正文与脚本无变化：文案 **1.1.1**、剪辑 **1.2.1**。

- 两个 skill 的 `name` 改为中文「Lead-自媒体口播文案」「Lead-自媒体口播剪辑」，文件夹名保持 `lead-media-script` / `lead-media-edit`。
- 新增 `.claude-plugin/plugin.json` 与 `marketplace.json`：Claude Code 可用 `/plugin marketplace add AzenYes/leaderai-media-toolkit` 后安装 `leaderai-media-toolkit@leaderai`。
- README 移除 Skills CLI（`npx skills add`）安装说明：该工具按 `name` 生成安装目录，中文名会使两个 skill 装进同一目录互相覆盖。Codex 及其他 Agent 改为手动复制英文文件夹。
- CONTRIBUTING 同步命名与插件版本约定。

**不兼容提示**：`npx skills add ... --skill lead-media-script` 等命令不再可用；已用 Skills CLI 安装的用户需删除旧目录后重装。

验证：`claude plugin validate` 对插件清单、插件市场清单和两个 skill 均通过；在隔离配置中从本地路径添加插件市场并安装，两个 skill 以英文目录被识别。

## v1.2.0 — 2026-10-19

以本地最新的「Lead-自媒体口播剪辑」同步更新至 **1.2.0**；「Lead-自媒体口播文案」本地无新改动，保持 **1.1.0**。

- 剪辑新增竖版（1080×1920 设计画布，`--scale=2` 输出 2160×3840）布局：素材检查阶段按显示方向（含旋转信息）判断画幅；人物圆环放在上部一角（默认右上，可选左上），字幕底边上移到距底部约 1/3 处；底部信息区、右侧按钮列和顶部栏不放关键信息。
- 动效模板：`src/project.ts` 新增 `ORIENTATION`、`PIP_CORNER`；`theme.ts` 按画幅给出 `W/H/PIP/PIP_KEEPOUT/SUB_BAND/PLATFORM_UI`，`PIP_KEEPOUT`、`SUB_BAND` 改为矩形/区间形式；`Root.tsx`、`Presenter` 不再写死 1920×1080。「格陵兰没那么大」案例的 `project.ts` 补充横版画幅配置。
- 字幕脚本 `make_subtitles.py` 新增 `--layout landscape|vertical` 与 `--pos-y`；竖版字号 144，单行最宽 1560px。横版默认的断句、对白坐标与字号均与之前一致（仅 ASS 样式的左右边距随单行宽度计算，因字幕用 `\pos` 定位而不影响画面）。
- 同步更新 B-roll 动效设计、字幕规范与验收清单中的竖版说明。

## v1.1.0 — 2026-10-17

以本地最新的「Lead-自媒体口播文案」与「Lead-自媒体口播剪辑」同步更新，两个 skill 均为 **1.1.0**。

- 文案：每次写稿、改稿和出新版本，保存纯口播 TXT 与执行方案 MD；默认使用项目内按日期与主题组织的输出目录，同名文件另存版本，交付可点击路径。
- 剪辑：内置 IBM Plex Sans SC 全部 8 个字重、Inter Medium / SemiBold、Noto Serif SC 可变字体，共 11 个完整字体文件，并附版权声明及 OFL 1.1 完整许可。
- 剪辑脚本：字幕与最终合成默认使用内置 SemiBold；字体子集化根据动效工程 `fonts.ts` 自动从字体库取所需字体，同时保留显式指定字体的用法。
- 同步字体相关规范、安装说明及第三方声明；保留公开版英文安装标识、许可文件、依赖锁文件、TypeScript 检查命令和案例装配说明。

验证：两个 skill 格式检查、Skills CLI 发现检查、相对文档链接与 Python 语法检查均通过；本地工作流正文、脚本及资源内容核对一致，11 个字体文件的 SHA-256 与本地源一致。用合成短片验证无字体参数的字幕生成、SemiBold 实际选中、最终烧录和完整解码，并验证工程登记的 5 个字体自动子集化及可变字体轴保留。本次未重复运行原片到成片的完整剪辑或 Remotion 渲染。

## v1.0.0 — 2026-10-16

首次公开发布 **LeaderAI自媒体工具包**。

### 包含的 Skill

- **Lead-自媒体口播文案 1.0.0**（`lead-media-script`）：口播稿、开头、标题封面、平台适配与审稿参考。
- **Lead-自媒体口播剪辑 1.0.0**（`lead-media-edit`）：粗剪、转写、字幕、音频、质量检查脚本，Remotion 动效模板及地图讲解案例。

### 首版打包调整

- 从原始本地 skill 复制完整工作流和资源；原始目录保持不变。
- 保留中文展示名称，以英文小写标识作为公开版目录和 frontmatter 名称。
- 补充版本元数据、安装说明、Python 依赖清单、动效依赖锁文件及案例装配说明。
- 增加工具包总览、后续扩展约定、MIT 许可和第三方地图许可声明；独立安装的 skill 也附带所需许可文件。

发布前完成 skill 格式校验、本地文档引用检查、Python 语法检查、动效依赖安装、通用模板与装配后案例的 TypeScript 检查、Remotion 模板打包，以及 Skills CLI 对两个 skill 的发现检查。视频实际成片效果仍取决于素材、字体、环境与 Agent 执行；本次发布不包含新的原片到成片测试。
