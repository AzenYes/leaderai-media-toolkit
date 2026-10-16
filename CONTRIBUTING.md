# 贡献与扩展

工具包中的每个 skill 应能单独安装。新增 skill 不需要修改其他 skill 的工作流。

## 新增一个 Skill

1. 在 `skills/` 下建立目录，使用小写英文、数字和连字符，例如 `lead-media-cover`。
2. 创建 `SKILL.md`，使 frontmatter 中的 `name` 与目录名一致；正文标题可以使用中文。
3. 声明明确的用途、触发场景、输入、执行流程和可检查的交付物。仅添加实际需要的参考资料、脚本和模板。
4. 资源引用使用相对路径。不要依赖作者机器的绝对路径，也不要附带账号凭据或用户素材。
5. 在 README 的 skill 目录中增加一行，在 CHANGELOG 记录新增项。
6. 检查引用完整性；新增或修改脚本时，验证实际受影响的行为。剪辑能力变更应另用合适的测试素材验证。

Frontmatter 示例：

```yaml
---
name: lead-media-cover
description: 清楚说明该能力处理什么任务，以及何时使用。
license: MIT
metadata:
  version: "1.0.0"
  display-name: "Lead-自媒体封面"
---
```

此处只是命名示例；首版尚不包含封面 skill。

## 版本管理

- 工具包版本：使用 `v主版本.次版本.修订版本` 的 Git 标签，并创建对应 GitHub Release。
- Skill 版本：在各自的 `metadata.version` 中独立记录。新增 skill 可从 `1.0.0` 开始。
- 不兼容的调用或交付变更提升主版本；兼容的新能力提升次版本；问题修复提升修订版本。
- 在 CHANGELOG 标明本次发布包含哪些 skill 版本。不要覆盖已经发布的标签。
- 维护动效依赖时同步提交 `package.json` 和 `package-lock.json`，用 `npm ci` 检查可安装性。

## 提交范围

通过 Issue 描述问题或提交 Pull Request。修改说明应写清使用场景、前后行为和实际做过的验证。

原创贡献采用本仓库 MIT 许可；引入第三方代码或资源时保留其许可证，并更新 `THIRD_PARTY_NOTICES.md`。不要提交原片、转写中的私人内容、模型、依赖目录或生成的成片。
