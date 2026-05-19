# Obsidian 个人生态项目

这个仓库用于统一整理和维护我自己的 Obsidian 相关项目。

它不是一个单一插件，也不是面向所有人的完整产品，而是一个长期使用的个人项目集合：把我平时改造、开发、试验过的 Obsidian 插件、主题和工具集中放在一起，方便后续继续维护、复用和开源。

## 仓库定位

- **个人记录**：记录我做过哪些 Obsidian 相关项目，避免散落在不同文件夹和不同 GitHub 仓库里。
- **统一维护**：插件、主题、未来的工作流工具都放到同一个仓库下，便于查找和更新。
- **方便复用**：以后换电脑、重装 Obsidian、给别人演示或继续开发时，可以直接从这里找。
- **逐步开源**：当前主要为个人使用服务，后续如果某个子项目成熟，可以单独整理文档、发布 Release 或提交 Obsidian 社区。

## 当前项目

### 插件

| 项目 | 路径 | 说明 |
| --- | --- | --- |
| Edge TTS 中文朗读 | `plugins/edge-tts` | 中文化的 Obsidian 语音朗读插件，基于 Microsoft Edge Read Aloud API，重点优化中文播放面板、代理连接、语速控制和临时音频清理。 |
| Presenter | `plugins/presenter` | 面向教学、演示和讲课场景的 Obsidian 标注插件，可在笔记上进行绘制、高亮、橡皮擦等操作。 |

### 主题

| 项目 | 路径 | 说明 |
| --- | --- | --- |
| Knowledge Base | `themes/knowledge-base` | 为个人知识库设计的 Obsidian 主题，偏程序员和教学场景风格，包含深色/浅色配色与知识库阅读样式。 |

## 目录结构

```text
obsidian-ecosystem/
├── plugins/
│   ├── edge-tts/
│   └── presenter/
├── themes/
│   └── knowledge-base/
├── README.md
├── package.json
└── .gitignore
```

## 使用说明

每个子项目仍然保留自己的源码、配置和说明文件。需要开发或构建时，进入对应目录操作。

### 构建 Edge TTS 中文朗读插件

```powershell
cd plugins/edge-tts
npm install
npm run build
```

也可以在仓库根目录执行：

```powershell
npm run build:edge-tts
```

### 构建 Presenter 插件

```powershell
cd plugins/presenter
npm install
npm run build
```

也可以在仓库根目录执行：

```powershell
npm run build:presenter
```

### 使用 Knowledge Base 主题

主题不需要构建，主要文件是：

```text
themes/knowledge-base/theme.css
themes/knowledge-base/manifest.json
```

手动安装时，将 `themes/knowledge-base` 目录复制到 Obsidian Vault 的：

```text
.obsidian/themes/Knowledge Base/
```

然后在 Obsidian 的外观设置中选择 `Knowledge Base` 主题。

## 维护记录

- 已将原本分散的 Obsidian 相关项目整合到本仓库。
- 已删除旧的单独 GitHub 仓库，只保留当前统一仓库。
- 当前仓库主要作为个人长期维护入口，不追求一次性整理成正式产品文档。

## 注意事项

- 子项目可能来自不同阶段的个人开发或改造，代码风格不一定完全统一。
- 插件构建产物 `main.js` 默认不提交到仓库，通常应通过本地构建或 GitHub Release 分发。
- 如果后续要正式发布到 Obsidian 社区，需要再单独检查 manifest、版本号、README、截图和 Release 包。

## 许可

各子项目保留自己的许可证文件。复用或再发布前，以具体子目录中的 `LICENSE` 为准。
