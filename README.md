# LeaderAI自媒体工具包

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/AzenYes/leaderai-media-toolkit)](https://github.com/AzenYes/leaderai-media-toolkit/releases)

**把创作经验变成 AI 可以执行的工作流，从一个想法，到一份口播稿，再到一条视频。**

LeaderAI自媒体工具包是一个面向自媒体创作者的开源 AI Skills 集合。每个 skill 包含明确的任务流程、交付标准，以及完成任务所需的参考资料、脚本或模板。你可以只安装需要的一个，也可以组合使用。

工具包从口播创作出发，现包含「口播文案」「口播剪辑」「知识讲解动画」三个 skill：前两个处理有人出镜的口播，第三个从一个选题直接做出无需配音、无需素材的讲解动画。后续会在同一个工具包中继续增加创作能力；现有 skill 保持独立，按各自版本迭代。

> 当前主分支版本：**v1.4.1**；已发布版本见 [Releases](https://github.com/AzenYes/leaderai-media-toolkit/releases)。Skill 需要由支持 `SKILL.md` 的 AI Agent 加载执行；剪辑与知识讲解动画还需要本地视频处理环境。

## 现在能做什么

| Skill | 目录 | 版本 | 输入 → 交付 |
| --- | --- | --- | --- |
| [Lead-自媒体口播文案](skills/lead-media-script/SKILL.md) | `lead-media-script` | 1.1.1 | 一句话想法、选题或素材 → 纯口播 TXT、执行方案 MD（含开头候选、标题封面、录制提示与事实待补项） |
| [Lead-自媒体口播剪辑](skills/lead-media-edit/SKILL.md) | `lead-media-edit` | 1.2.2 | 已录制口播视频，可附文案 → 粗剪、动态讲解画面、圆环人物画中画、音效、单行字幕、成片及剪辑说明；支持横版与竖版，所需字体首次使用时自动下载 |
| [Lead-知识讲解动画](skills/lead-knowledge-animation/SKILL.md) | `lead-knowledge-animation` | 1.0.0 | 一个知识选题或一句想法 → 发光线描式讲解动画 MP4（无配音，底部单行字幕即旁白，配音乐与音效）、字幕稿、分镜与出处记录、可再修改的动画工程 |

### 口播文案

支持教程、观点、测评、经验故事等内容，提供抖音、视频号、快手、小红书、B站、YouTube 等平台的适配参考。流程从受众与观看承诺出发，组织正文、开头和标题，再检查是否好念、是否兑现承诺、是否存在编造或夸大。

每次写稿、改稿或出新版本，都会保存纯口播文案 `.txt` 和执行方案 `.md`。默认放在项目的 `口播文案输出/YYYYMMDD 主题/`，同名另存新版本，用户指定路径时优先使用指定路径。

适合：有选题但不知道怎么讲、需要把长稿改成口语、只想改开头或某一段的创作者。

### 口播剪辑

使用 FFmpeg、Whisper 和 Remotion，把原始口播整理成视频。包含保留片段清单、重复起句识别、讲解分镜、动效模板、字幕断句和成片质量检查。默认采用 1920×1080 横屏设计画布，可按流程渲染 4K；竖版（1080×1920）有专门布局：人物圆环放在上部一角，字幕上移到距底部约 1/3 处，避开平台底部信息区和右侧按钮列。

适合：已录好视频，希望由具备本地文件和命令执行能力的 AI Agent 完成剪辑与包装的创作者。

### 知识讲解动画

不需要出镜、配音或任何素材：给一个选题（心理学、社会现象、物理宇宙、生物医学、数学概率、经济、历史人物、科研成果、书籍观点等），Agent 就按固定流程做出一支发光线描风格的讲解动画。

- **开头**：前 5 秒用大字金句抓人，随后是一张能当封面的发光片名卡。
- **字幕即旁白**：底部居中、永远单行、句末不带标点；理性科技类内容用 IBM Plex Sans SC，人文历史类内容用思源宋体，由 Agent 按内容选择。
- **画面**：一句一变，发光线描、粒子、体积光、玻璃质感 UI 卡片和出处小字层层叠加，结尾回到开头的画面。
- **声音**：不配音；可使用你提供的音乐，加上程序化生成的必要音效。
- **流程**：选题角度与字幕稿 → 视觉系统与代表帧 → 时间轴 → 逐句分镜 → 确定性引擎实现 → 对照风格指标审片打分 → 混音 → 成片自检。内置 `new_film.mjs`、`render.mjs`、`qa_video.py` 等脚本，画面由时间唯一决定，可逐帧复现。

与口播剪辑的分工：已有真人口播视频要包装，用「Lead-自媒体口播剪辑」；只有选题、要从零做讲解动画，用「Lead-知识讲解动画」。

字体与音乐不随仓库分发：首次使用时脚本会自动下载 IBM Plex Sans SC 与思源宋体（合计约 220 MB，均为 SIL OFL 1.1，只下一次）；配套 BGM 另行分发，没有时 Agent 不会使用，只配音效或使用你指定的曲子。

## 安装

Skill 的 `name` 使用中文（「Lead-自媒体口播文案」「Lead-自媒体口播剪辑」「Lead-知识讲解动画」），文件夹名保持英文。本项目不再通过 Skills CLI（`npx skills add`）分发：该工具会根据 `name` 生成安装目录，中文会被去掉，多个 skill 会装进同一个目录互相覆盖。

### Claude Code：通过插件市场安装（推荐）

在 Claude Code 中依次运行：

```text
/plugin marketplace add AzenYes/leaderai-media-toolkit
/plugin install leaderai-media-toolkit@leaderai
```

三个 skill 会一起安装，重启 Claude Code 后生效。以后获取新版本：

```text
/plugin marketplace update leaderai
/plugin update leaderai-media-toolkit@leaderai
```

也可以在终端里用 `claude plugin marketplace add AzenYes/leaderai-media-toolkit` 和 `claude plugin install leaderai-media-toolkit@leaderai` 完成同样的操作。

### 手动安装（Codex 及其他 Agent）

从 [Releases](https://github.com/AzenYes/leaderai-media-toolkit/releases) 下载 ZIP，或克隆仓库：

```bash
git clone https://github.com/AzenYes/leaderai-media-toolkit.git
```

将 `skills/` 下需要的**整个 skill 文件夹**复制到 Agent 支持的 skills 目录（如 Claude Code 的 `~/.claude/skills/`），**保持英文文件夹名**，并保留 `references/`、`scripts/`、`assets/`、`motion-template/` 和 `agents/`（各 skill 实际包含的目录不同）。不要只复制 `SKILL.md`，也不要将整个工具包当作一个 skill 安装。

Codex 的中文显示名由各 skill 的 `agents/openai.yaml` 提供。其他 Agent 若要求 `name` 只能使用小写英文，可能无法加载，请以该 Agent 的实际表现为准。

如果之前用 Skills CLI 安装过本工具包（目录为 `lead-media-script` / `lead-media-edit`），或装过同名的本地中文版本，请先删除旧目录再按上面的方式重装，避免重复加载。

## 开始使用

安装后，在 Agent 中明确指定 skill，或使用自然语言描述任务；是否自动触发取决于宿主。

**从想法写稿：**

```text
请用「Lead-自媒体口播文案」写一份 60–90 秒的视频号口播稿。
主题：为什么普通人第一次录教程，总是卡在开头？
受众：第一次录软件教程的人。
语气：像和朋友聊天，不编造我的经历。
```

**给已有视频剪辑：**

```text
请用「Lead-自媒体口播剪辑」剪辑我提供的口播视频。
视频路径：<你的原片绝对路径>
文案路径：<可选的文案路径>
输出目录：<你的输出目录>
请保留完整意思，去掉口误和重说，并按 skill 完成动效、字幕和自检。
```

也可以先用文案 skill 写稿，自己录制，再把视频和定稿一起交给剪辑 skill。

**从选题做讲解动画：**

```text
请用「Lead-知识讲解动画」做一支 120 秒左右的科普动画。
选题：为什么人总是高估自己明天的自制力？
画幅：16:9（竖版可说明 9:16）
音乐：只要音效 / 用我提供的 <音乐绝对路径>
输出目录：<你的输出目录>
```

不指定输出目录时，Agent 会在当前项目的 `.code/<日期 项目名>/` 下建立动画工程。

## 环境要求

文案 skill 主要依靠 AI Agent 的文本能力；需要核实时，Agent 应具备相应的信息检索能力。知识讲解动画同样要求 Agent 能查证事实与出处。

剪辑 skill 需要能够读取本地文件和运行命令的 Agent，以及：

| 依赖 | 用途 |
| --- | --- |
| Python 3.10+ | 转写、剪辑辅助、字幕、音频与质量检查脚本 |
| FFmpeg / ffprobe | 音视频处理；字幕烧录需要含 `libass` 的构建 |
| Node.js 22+ / npm | 安装和运行本版本动效模板及依赖 |
| openai-whisper、numpy、jieba、fontTools | 中文语音识别、音频处理、断句与字体子集化 |
| IBM Plex Sans SC、Noto Serif SC、Inter | Inter 与各字体许可随剪辑 skill 分发；IBM Plex、Noto Serif SC 首次使用时自动下载到 `assets/fonts/`（约 40 MB，只下一次） |
| 可用的 Chromium / Remotion 浏览器 | 动效预览与渲染；首次运行可能下载浏览器 |

安装 Python 依赖：

```bash
python -m pip install -r skills/lead-media-edit/requirements.txt
```

复制动效模板到你的工作项目后，在副本中运行 `npm ci`。字体位置、案例启用方式见 [动效模板说明](skills/lead-media-edit/motion-template/README.md)。Whisper 首次运行会下载模型；中文使用多语种模型。GPU 可加速，实际耗时与素材长度、模型、画质和硬件有关。

字幕生成与最终合成默认使用 IBM Plex Sans SC SemiBold；动效字体通过 `scripts/subset_fonts.py <动效工程目录>` 按工程登记与实际用字生成子集。字体不随仓库分发，脚本发现缺失会自动下载；也可提前运行 `python skills/lead-media-edit/scripts/fetch_fonts.py --fetch`，网络不通时的手动安装方法见 [字体说明](skills/lead-media-edit/assets/fonts/README.md)。

知识讲解动画 skill 同样需要能读写本地文件和运行命令的 Agent，以及：

| 依赖 | 用途 |
| --- | --- |
| Node.js 18+ | 运行 `new_film.mjs`、`render.mjs`、`stills.mjs` 等脚本 |
| Playwright 与 Chromium | 逐帧渲染画面；在影片目录执行 `npm i -D playwright && npx playwright install chromium`，或全局安装 |
| FFmpeg / ffprobe | 合成视频与音频、抽帧、联系表 |
| Python 3.10+、numpy、scipy、fontTools | 时间轴、音效合成、混音、质检、字体子集化 |
| IBM Plex Sans SC、思源宋体 | 字幕与屏上文字；首次使用自动下载，存到 skill 内部 `assets/fonts/`，不进 git |

```bash
python -m pip install -r skills/lead-knowledge-animation/requirements.txt
python skills/lead-knowledge-animation/scripts/fonts.py --fetch   # 可选：提前下载字体；网络不通时见 assets/fonts/README.md
```

渲染速度与分辨率、帧率、时长和硬件有关：1080p 约 25–45 帧/秒，总帧数 = 时长 × 帧率 × 子帧数，成片通常需要几分钟到几十分钟。

本仓库不附带用户原片、成片、语音模型和 `node_modules`。完成安装不等于完成视频环境配置。

## 项目结构与后续扩展

```text
leaderai-media-toolkit/
├── README.md                  工具包介绍、安装与使用
├── LICENSE                    MIT 许可
├── CHANGELOG.md               工具包与各 skill 的版本记录
├── CONTRIBUTING.md            新增与维护 skill 的约定
├── THIRD_PARTY_NOTICES.md      第三方资源说明
├── .claude-plugin/            Claude Code 插件与插件市场配置
└── skills/
    ├── lead-media-script/
    │   ├── SKILL.md
    │   └── references/
    ├── lead-media-edit/
    │   ├── SKILL.md
    │   ├── requirements.txt
    │   ├── assets/fonts/         Inter、OFL 许可与字体下载清单（IBM Plex、Noto Serif 首次使用时下载）
    │   ├── references/
    │   ├── scripts/
    │   └── motion-template/
    └── lead-knowledge-animation/
        ├── SKILL.md
        ├── requirements.txt
        ├── assets/               引擎起手件（starter）、世界地图数据；字体清单与 BGM 说明（字体、音频不入库）
        ├── references/           风格范式、字幕规范、视觉系统、工程契约等
        └── scripts/              建工程、渲染、时间轴、混音、质检脚本
```

新增能力时，在 `skills/<英文目录>/` 下加入独立的 `SKILL.md` 和所需资源，再更新上方目录、插件版本及版本记录。工具包通过 Git 标签和 Release 发布，各 skill 在 `SKILL.md` 的 `metadata.version` 中记录自身版本。扩展约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目原创文档、工作流、脚本和模板采用 [MIT License](LICENSE)，允许使用、修改和分发，包括商业用途，须保留许可与版权声明。

第三方依赖及资源遵循各自许可；本项目的 MIT 不替代 Remotion 的[许可条款](https://www.remotion.dev/docs/license)、字体许可或 FFmpeg 构建所附许可。随附地图数据、字体及字体下载清单的来源与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
