# LeaderAI自媒体工具包

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/AzenYes/leaderai-media-toolkit)](https://github.com/AzenYes/leaderai-media-toolkit/releases)

**把创作经验变成 AI 可以执行的工作流，从一个想法，到一份口播稿，再到一条视频。**

LeaderAI自媒体工具包是一个面向自媒体创作者的开源 AI Skills 集合。每个 skill 包含明确的任务流程、交付标准，以及完成任务所需的参考资料、脚本或模板。你可以只安装需要的一个，也可以组合使用。

首个版本从口播创作出发，包含「文案」和「剪辑」两个 skill。后续会在同一个工具包中继续增加创作能力；现有 skill 保持独立，按各自版本迭代。

> 当前主分支版本：**v1.1.0**；已发布版本见 [Releases](https://github.com/AzenYes/leaderai-media-toolkit/releases)。Skill 需要由支持 `SKILL.md` 的 AI Agent 加载执行；剪辑还需要本地视频处理环境。

## 现在能做什么

| Skill | 安装标识 | 版本 | 输入 → 交付 |
| --- | --- | --- | --- |
| [Lead-自媒体口播文案](skills/lead-media-script/SKILL.md) | `lead-media-script` | 1.1.0 | 一句话想法、选题或素材 → 纯口播 TXT、执行方案 MD（含开头候选、标题封面、录制提示与事实待补项） |
| [Lead-自媒体口播剪辑](skills/lead-media-edit/SKILL.md) | `lead-media-edit` | 1.1.0 | 已录制口播视频，可附文案 → 粗剪、动态讲解画面、圆环人物画中画、音效、单行字幕、成片及剪辑说明；内置所需字体 |

### 口播文案

支持教程、观点、测评、经验故事等内容，提供抖音、视频号、快手、小红书、B站、YouTube 等平台的适配参考。流程从受众与观看承诺出发，组织正文、开头和标题，再检查是否好念、是否兑现承诺、是否存在编造或夸大。

每次写稿、改稿或出新版本，都会保存纯口播文案 `.txt` 和执行方案 `.md`。默认放在项目的 `口播文案输出/YYYYMMDD 主题/`，同名另存新版本，用户指定路径时优先使用指定路径。

适合：有选题但不知道怎么讲、需要把长稿改成口语、只想改开头或某一段的创作者。

### 口播剪辑

使用 FFmpeg、Whisper 和 Remotion，把原始口播整理成视频。包含保留片段清单、重复起句识别、讲解分镜、动效模板、字幕断句和成片质量检查。默认采用 1920×1080 横屏设计画布，可按流程渲染 4K；竖屏需要相应调整布局。

适合：已录好视频，希望由具备本地文件和命令执行能力的 AI Agent 完成剪辑与包装的创作者。

## 安装

### 使用 Skills CLI

先准备 Node.js / npm。下面的命令使用 [Vercel Skills CLI](https://github.com/vercel-labs/skills)，会让你选择 skill 和目标 Agent：

```bash
npx skills add AzenYes/leaderai-media-toolkit
```

只安装其中一个：

```bash
npx skills add AzenYes/leaderai-media-toolkit --skill lead-media-script
npx skills add AzenYes/leaderai-media-toolkit --skill lead-media-edit
```

查看可用 skill（不安装）：

```bash
npx skills add AzenYes/leaderai-media-toolkit --list
```

需要固定首版时，可使用 GitHub 标签链接：

```bash
npx skills add https://github.com/AzenYes/leaderai-media-toolkit/tree/v1.0.0/skills/lead-media-script
```

### 手动安装

从 [Releases](https://github.com/AzenYes/leaderai-media-toolkit/releases) 下载 ZIP，或克隆仓库：

```bash
git clone https://github.com/AzenYes/leaderai-media-toolkit.git
```

将 `skills/` 下需要的**整个 skill 文件夹**复制到 Agent 支持的 skills 目录，保留 `references/`、`scripts/`、`assets/` 和 `motion-template/`。不要只复制 `SKILL.md`，也不要将整个工具包当作一个 skill 安装。

如果你之前安装过中文名称的本地版本，请检查是否重复加载；公开版保留中文展示名称，使用上表中的英文安装标识。原有目录不会被本项目自动覆盖。

## 开始使用

安装后，在 Agent 中明确指定 skill，或使用自然语言描述任务；是否自动触发取决于宿主。

**从想法写稿：**

```text
请用 lead-media-script 写一份 60–90 秒的视频号口播稿。
主题：为什么普通人第一次录教程，总是卡在开头？
受众：第一次录软件教程的人。
语气：像和朋友聊天，不编造我的经历。
```

**给已有视频剪辑：**

```text
请用 lead-media-edit 剪辑我提供的口播视频。
视频路径：<你的原片绝对路径>
文案路径：<可选的文案路径>
输出目录：<你的输出目录>
请保留完整意思，去掉口误和重说，并按 skill 完成动效、字幕和自检。
```

也可以先用文案 skill 写稿，自己录制，再把视频和定稿一起交给剪辑 skill。

## 环境要求

文案 skill 主要依靠 AI Agent 的文本能力；需要核实时，Agent 应具备相应的信息检索能力。

剪辑 skill 需要能够读取本地文件和运行命令的 Agent，以及：

| 依赖 | 用途 |
| --- | --- |
| Python 3.10+ | 转写、剪辑辅助、字幕、音频与质量检查脚本 |
| FFmpeg / ffprobe | 音视频处理；字幕烧录需要含 `libass` 的构建 |
| Node.js 22+ / npm | 安装和运行本版本动效模板及依赖 |
| openai-whisper、numpy、jieba、fontTools | 中文语音识别、音频处理、断句与字体子集化 |
| IBM Plex Sans SC、Noto Serif SC、Inter | 完整字体已内置于剪辑 skill 的 `assets/fonts/`，附各字体许可 |
| 可用的 Chromium / Remotion 浏览器 | 动效预览与渲染；首次运行可能下载浏览器 |

安装 Python 依赖：

```bash
python -m pip install -r skills/lead-media-edit/requirements.txt
```

复制动效模板到你的工作项目后，在副本中运行 `npm ci`。字体位置、案例启用方式见 [动效模板说明](skills/lead-media-edit/motion-template/README.md)。Whisper 首次运行会下载模型；中文使用多语种模型。GPU 可加速，实际耗时与素材长度、模型、画质和硬件有关。

字幕生成与最终合成默认使用内置 IBM Plex Sans SC SemiBold；动效字体通过 `scripts/subset_fonts.py <动效工程目录>` 按工程登记与实际用字生成子集，无需另行查找字体。完整字体共约 78 MiB，会增加仓库下载体积。

本仓库不附带用户原片、成片、语音模型和 `node_modules`。完成安装不等于完成视频环境配置。

## 项目结构与后续扩展

```text
leaderai-media-toolkit/
├── README.md                  工具包介绍、安装与使用
├── LICENSE                    MIT 许可
├── CHANGELOG.md               工具包与各 skill 的版本记录
├── CONTRIBUTING.md            新增与维护 skill 的约定
├── THIRD_PARTY_NOTICES.md      第三方资源说明
└── skills/
    ├── lead-media-script/
    │   ├── SKILL.md
    │   └── references/
    └── lead-media-edit/
        ├── SKILL.md
        ├── requirements.txt
        ├── assets/fonts/         完整字体及 OFL 许可
        ├── references/
        ├── scripts/
        └── motion-template/
```

新增能力时，在 `skills/<新标识>/` 下加入独立的 `SKILL.md` 和所需资源，再更新上方目录及版本记录。工具包通过 Git 标签和 Release 发布，各 skill 在 `SKILL.md` 的 `metadata.version` 中记录自身版本。扩展约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目原创文档、工作流、脚本和模板采用 [MIT License](LICENSE)，允许使用、修改和分发，包括商业用途，须保留许可与版权声明。

第三方依赖及资源遵循各自许可；本项目的 MIT 不替代 Remotion 的[许可条款](https://www.remotion.dev/docs/license)、字体许可或 FFmpeg 构建所附许可。随附地图数据与字体的来源及许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
