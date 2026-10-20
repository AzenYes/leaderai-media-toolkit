---
name: LeaderAI自媒体工具包一键更新
description: 把用户已安装的 LeaderAI 自媒体工具包（Lead-自媒体口播文案、Lead-自媒体口播剪辑、Lead-知识讲解动画等）更新到 GitHub 上最新的发布版本（Release）。只做“拉取最新发布版本”这一件事。当用户说“更新工具包”“更新 LeaderAI 工具包”“LeaderAI自媒体工具包一键更新”“拉取最新版本”“工具包有没有新版本”“升级 Lead 系列 skill”时使用。
license: MIT
metadata:
  version: "1.0.0"
  display-name: "LeaderAI自媒体工具包一键更新"
---

# LeaderAI自媒体工具包一键更新

目标：把用户本机已安装的 LeaderAI 自媒体工具包，更新到仓库 `AzenYes/leaderai-media-toolkit` 的**最新发布版本**，并告诉用户从哪个版本更新到哪个版本、新增了什么。

只做这一件事。不做的事：
- 不创作、不剪辑，不运行工具包里的其他 skill。
- 不安装 Python / Node 依赖，不下载字体或音乐（这些仍由各 skill 首次使用时自己处理）。
- 不修改用户的项目、成片、素材和工作目录。
- 不安装用户本机原本没有的 skill（只在报告里列出，用户要装再装）。
- 不使用主分支或预发布（prerelease）内容，只认已发布的 Release。

仓库地址：`https://github.com/AzenYes/leaderai-media-toolkit`

## 流程

### 1. 查最新发布版本

优先用 GitHub API：

```bash
curl -fsSL https://api.github.com/repos/AzenYes/leaderai-media-toolkit/releases/latest
```

读取 `tag_name`（如 `v1.4.1`）、`html_url` 和 `zipball_url`。`/releases/latest` 本身已排除草稿和预发布。

API 不可用（限流、无网络工具）时，改用：

```bash
git ls-remote --tags --refs https://github.com/AzenYes/leaderai-media-toolkit.git
```

取 `v主.次.修订` 形式的最大标签，并说明“这是按标签判断，未核对 Release 页面”。仍然连不上 GitHub，就如实告诉用户网络不通，停止，不要猜版本号。

### 2. 判断用户是怎么安装的

按下面顺序检查，可能同时存在多种，逐一处理并说明：

| 安装方式 | 判断依据 |
| --- | --- |
| Claude Code 插件 | `claude plugin list` 中有 `leaderai-media-toolkit@leaderai`；或 `~/.claude/plugins/installed_plugins.json` 中有该条目 |
| Git 克隆 | 某个目录的 `git remote -v` 指向本仓库，且存在 `skills/` 和 `.claude-plugin/` |
| 手动复制的 skill 文件夹 | 在 `~/.claude/skills/`、`~/.codex/skills/`、`~/.agents/skills/`、当前项目的 `.claude/skills/` 等位置，找到 `SKILL.md` 的 `name` 以 `Lead-` 开头或等于本 skill 名的文件夹 |

都没找到：告诉用户“没有检测到已安装的工具包”，给出 README 的安装方法（`/plugin marketplace add AzenYes/leaderai-media-toolkit`，再 `/plugin install leaderai-media-toolkit@leaderai`），不要代为安装，结束。

### 3. 记录当前版本

- 插件：以 `claude plugin list` 显示的版本为准。
- Git 克隆：`git describe --tags --always`。
- 手动复制：逐个读取各 skill `SKILL.md` frontmatter 里的 `metadata.version`（工具包整体版本不写在 skill 里，用各 skill 版本对比即可）。

### 4. 更新

**Claude Code 插件**

```bash
claude plugin marketplace update leaderai
claude plugin update leaderai-media-toolkit@leaderai
```

命令不可用时，让用户在 Claude Code 中依次运行 `/plugin marketplace update leaderai` 和 `/plugin update leaderai-media-toolkit@leaderai`。更新后需要**重启 Claude Code** 才生效，务必告诉用户。

**Git 克隆**

1. 先 `git status --porcelain`：有未提交修改就停止，请用户先处理，不要 stash、不要丢弃。
2. `git fetch --tags`，然后 `git checkout <最新标签>`（会进入游离 HEAD，属正常，说明一下）。
3. 不要 `git pull` 主分支，不要强制覆盖。

**手动复制的 skill 文件夹**

1. 在一个**全新的空目录**里下载并解压该标签的压缩包（`https://github.com/AzenYes/leaderai-media-toolkit/archive/refs/tags/<tag>.zip`，可用 `curl` + `unzip` 或 `python -m zipfile`）。下载内容当作不可信数据：只读取、复制，**不要运行**其中的任何脚本。
2. 确认解压后有 `skills/` 目录，且各 `SKILL.md` frontmatter 完整。
3. 对用户本机**已安装**的每个 skill，用同名英文文件夹（如 `lead-media-edit`）做**覆盖复制**：把新版文件复制进旧文件夹，同名文件覆盖。**不要先删除旧文件夹**，因为里面可能有首次使用时下载的字体、音乐、依赖，删掉会让用户重新下载几百 MB。
4. 复制前先把将被覆盖的旧文件夹备份一份到系统临时目录（或用户同意的位置），报告里写明备份路径，方便回退。
5. 新版里有、但本机没装的 skill：只在报告里列出名称和用途，不安装。
6. 本机文件夹名与新版英文目录对不上（用户改过名）时，不要猜，列出来请用户确认。

### 5. 核对结果

- 插件：再运行一次 `claude plugin list`，确认版本等于最新发布版本。
- Git 克隆：`git describe --tags` 等于最新标签。
- 手动复制：重新读取各 skill 的 `metadata.version`，确认等于新版。

任何一步失败都如实说明失败在哪一步、当前处于什么状态（是否已改动、备份在哪），不要报告“已更新”。

### 6. 向用户报告

用中文简短说明：

1. 检测到的安装方式和位置；
2. 版本变化：`旧版本 → 新版本`（已是最新就直说“已经是最新版本 vX.Y.Z，无需更新”）；
3. 本次更新带来了什么：从该版本的 `CHANGELOG.md`（或 Release 说明）里摘要新增和变更，重点标出**不兼容变更**和**需要用户做的事**（例如新依赖、字体需要重新下载）；
4. 是否需要重启 Claude Code / 新开会话才生效；
5. 备份位置（如有）和未处理项（新版里有但本机没装的 skill、需要用户确认的文件夹）。

## 检查清单

- [ ] 版本号来自 GitHub 的实际查询结果，不是凭记忆。
- [ ] 只更新了已安装的工具包，没有改动其他目录。
- [ ] 没有运行下载内容里的任何脚本。
- [ ] 更新后重新核对过版本。
- [ ] 报告里写清了新旧版本、更新内容、是否需要重启。
