# 贡献与扩展

工具包中的每个 skill 应能单独安装。新增 skill 不需要修改其他 skill 的工作流。

## 新增一个 Skill

1. 在 `skills/` 下建立目录，使用小写英文、数字和连字符，例如 `lead-media-cover`。
2. 创建 `SKILL.md`，frontmatter 中的 `name` 使用中文展示名（如 `Lead-自媒体封面`），与 `metadata.display-name` 一致；目录名保持英文，不要求与 `name` 相同。再添加 `agents/openai.yaml` 提供 Codex 中文显示名。
3. 声明明确的用途、触发场景、输入、执行流程和可检查的交付物。仅添加实际需要的参考资料、脚本和模板。
4. 资源引用使用相对路径。不要依赖作者机器的绝对路径，也不要附带账号凭据或用户素材。
5. 在 README 的 skill 目录中增加一行，在 CHANGELOG 记录新增项。
6. 检查引用完整性；新增或修改脚本时，验证实际受影响的行为。剪辑能力变更应另用合适的测试素材验证。

Frontmatter 示例：

```yaml
---
name: Lead-自媒体封面
description: 清楚说明该能力处理什么任务，以及何时使用。
license: MIT
metadata:
  version: "1.0.0"
  display-name: "Lead-自媒体封面"
---
```

此处只是命名示例；首版尚不包含封面 skill。

## 字体、音频等大体积资源

- 大体积字体（单个数 MB 以上）不入库：只提交下载清单，让脚本在首次使用时下载（如知识讲解动画和口播剪辑的 `assets/fonts/fonts.json`）。须在 `.gitignore` 中排除字体文件（体积很小、必须随 skill 分发的字体可用 `!` 单独放行），并写清下载地址、体积和失败时的手动安装方法。依赖这些字体的脚本应在缺失时自动下载，失败要报错，不要静默换字体。
- 仓库历史已包含过去提交的字体文件，删除不会缩小 `git clone` 体积；不要改写已发布标签。
- 配套音乐等授权不明或体积大的音频不入库；skill 只提供检测与安装脚本，并在找不到时自动降级，不要要求用户必须有这些文件。
- 新增不随仓库分发的第三方资源时，同样更新 `THIRD_PARTY_NOTICES.md`。

## 版本管理

- 工具包版本：使用 `v主版本.次版本.修订版本` 的 Git 标签，并创建对应 GitHub Release。
- Skill 版本：在各自的 `metadata.version` 中独立记录。新增 skill 可从 `1.0.0` 开始。
- 不兼容的调用或交付变更提升主版本；兼容的新能力提升次版本；问题修复提升修订版本。
- 发布工具包新版本时，同步更新 `.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json` 中的 `version`，并用 `claude plugin validate` 检查。
- 在 CHANGELOG 标明本次发布包含哪些 skill 版本。不要覆盖已经发布的标签。
- 维护动效依赖时同步提交 `package.json` 和 `package-lock.json`，用 `npm ci` 检查可安装性。

## 提交范围

通过 Issue 描述问题或提交 Pull Request。修改说明应写清使用场景、前后行为和实际做过的验证。

原创贡献采用本仓库 MIT 许可；引入第三方代码或资源时保留其许可证，并更新 `THIRD_PARTY_NOTICES.md`。不要提交原片、转写中的私人内容、模型、依赖目录或生成的成片。
