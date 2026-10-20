# 版本记录

工具包按 Git 标签和 GitHub Release 发布；各 skill 的版本分别记录在其 `SKILL.md` 的 `metadata.version` 中。仅修改工具包文档时，不必同步提升所有 skill 的版本。

## v1.6.0 — 2026-10-20（主分支）

「Lead-知识讲解动画」**1.1.0**：主体不再默认用全身小人，材质球边缘改为连续辉光。「Lead-自媒体口播文案」**1.1.1**、「Lead-自媒体口播剪辑」**1.2.2**、「LeaderAI自媒体工具包一键更新」**1.0.0** 无变化。

- 主体选择：全身线描小人（`K.figure`）不再是默认主体。SKILL、风格范式、主体与视觉想法、选题配方改为“按每句文案选最能说明它的东西”——人的故事画他手里的物、看的屏幕、眼睛或手；冷开场要“一个人的痕迹”。`K.figure` 仍保留，工程契约中标注为可选。
- `K.orb` 边缘：去掉膜上一圈零碎亮点（画面里读起来像毛刺），新增 `atmo` 大气辉光（默认 .6，贴着球缘一圈连续柔光）；`membrane` 改为一条连续的细亮膜线；`rim` 默认值 .8 → .6。丰富度与设计秩序新增“轮廓要干净”。
- 美学底线新增两条不合格信号：主体边缘撒满零碎亮点 / 毛刺；用全身小人代替文案里真正的信息。
- 起手件 `index.html` 的布线示例由三个人形改为三个材质球。
- 插件清单与市场清单版本升至 1.6.0。

验证：仓库内容与作者本机正在使用的 skill 逐文件比对一致（字体、音频等不入库文件除外）。本次未重新渲染完整成片。

## v1.5.0 — 2026-10-20

新增第四个 skill「LeaderAI自媒体工具包一键更新」**1.0.0**（`leaderai-toolkit-update`）；「Lead-自媒体口播文案」**1.1.1**、「Lead-自媒体口播剪辑」**1.2.2**、「Lead-知识讲解动画」**1.0.0** 无变化。

- 新增 `skills/leaderai-toolkit-update/`：只做一件事，把已安装的工具包更新到 GitHub 上最新的发布版本。先查最新 Release，再识别安装方式（Claude Code 插件、Git 克隆、手动复制的 skill 文件夹），按方式更新并重新核对版本，最后报告新旧版本、更新内容与是否需要重启。
- 安全边界：只认已发布的 Release，不用主分支和预发布；下载内容只读取、复制，不运行其中脚本；手动复制采用覆盖而非先删除，保留各 skill 首次使用时下载的字体与音乐，并先备份被覆盖的旧文件夹；Git 克隆有未提交修改时停止；不安装本机原本没有的 skill，也不安装依赖。
- 仅含 `SKILL.md`、`agents/openai.yaml` 与 `LICENSE`，无脚本和依赖。
- README 目录、安装与更新说明、项目结构同步；插件清单与市场清单版本升至 1.5.0，描述加入一键更新。

验证：`claude plugin validate` 对插件清单与市场清单通过；已检查 frontmatter 格式、中文名与 `metadata.display-name` 一致，以及 README 中的链接目标；查询最新发布版本的 GitHub API 与 `git ls-remote` 标签两条路径对本仓库均实际可用（当前最新为 v1.4.1）。本次未在真实的旧版本安装上完整跑一遍更新流程，该 skill 尚未经过真实更新演练。

## v1.4.1 — 2026-10-20

「Lead-自媒体口播剪辑」**1.2.2**：字体改为首次使用时在线下载，skill 目录从约 79 MB 缩到约 1.8 MB。「Lead-自媒体口播文案」**1.1.1**、「Lead-知识讲解动画」**1.0.0** 无变化。

- 从仓库移除 IBM Plex Sans SC 的 8 个 OTF 和 Noto Serif SC 可变字体（约 80 MB）；保留体积很小的 Inter（约 0.6 MB）和三份 OFL 许可原文。
- 新增 `assets/fonts/fonts.json`（下载清单）和 `scripts/fetch_fonts.py`（`--check` / `--fetch` / `--fetch --all` / `--install`）。IBM Plex Sans SC 固定为 1.1.0，Noto Serif SC 固定为 notofonts/noto-cjk 的 Serif2.003 标签；默认只下载 3 个必需字体（SemiBold、Medium、Noto Serif SC，约 40 MB），6 个备用字重用 `--all` 按需下载。
- `make_subtitles.py`、`final_compose.py`、`subset_fonts.py` 在字体缺失时自动下载；下载失败会列出地址并退出，不会静默换字体。`--font` / `--fonts-dir` 显式指定的用法不变。
- 字体来源变化：Noto Serif SC 原随附的是 2.02 构建，下载的是上游 Serif2.003 标签的同名可变字体（同为 200–900 字重轴、31058 个字形），但构建版本不同、文件哈希不同；IBM Plex 的 SemiBold 与 Medium 哈希与原随附文件一致。
- 同步更新 SKILL、字幕规范、动效模板 README、字体说明、两份 THIRD_PARTY_NOTICES、README 与 CONTRIBUTING；插件清单版本升至 1.4.1。

**注意**：已有提交历史仍含这些字体文件，所以 `git clone` 的体积不会因此变小，变小的是 skill 目录（插件安装与手动复制得到的内容）。没有改写历史，已发布的标签保持不变。使用前需要能访问 GitHub；网络不通时按 `assets/fonts/README.md` 手动安装。

验证：在清空字体的状态下运行 `make_subtitles.py`，自动下载 SemiBold 并成功生成字幕；运行 `subset_fonts.py` 自动下载 Medium 与 Noto Serif SC 并完成 5 个字体的子集化；`fetch_fonts.py --check` 输出正常；全部 Python 脚本语法检查通过。本次未重新运行原片到成片的完整剪辑，也未运行 Remotion 渲染与 `final_compose.py` 烧录（该脚本使用同一个 `ensure()`，改动同 `make_subtitles.py`）。

## v1.4.0 — 2026-10-20

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
