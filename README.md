# Obsidian Ecosystem

A personal collection of Obsidian plugins and themes by [@cheer932041235](https://github.com/cheer932041235).

这个仓库用于统一维护个人 Obsidian 生态项目，包括插件、主题，以及未来可能新增的工作流工具。

## Projects

### Plugins

| Project | Path | Description |
| --- | --- | --- |
| Edge TTS 中文朗读 | `plugins/edge-tts` | 中文化的 Obsidian 语音朗读面板，使用 Microsoft Edge Read Aloud API。 |
| Presenter | `plugins/presenter` | Teaching annotation plugin for drawing, highlighting, and presenting in Obsidian. |

### Themes

| Project | Path | Description |
| --- | --- | --- |
| Knowledge Base | `themes/knowledge-base` | Developer-friendly Obsidian theme with indigo-purple accents and knowledge-base styling. |

## Repository Structure

```text
obsidian-ecosystem/
├── plugins/
│   ├── edge-tts/
│   └── presenter/
└── themes/
    └── knowledge-base/
```

## Development

Each subproject keeps its own build files and README. Enter a subproject directory before running its commands.

```powershell
cd plugins/edge-tts
npm install
npm run build
```

```powershell
cd plugins/presenter
npm install
npm run build
```

The theme under `themes/knowledge-base` is CSS-based and does not require a build step.

## License

Each subproject keeps its original license file. Check the individual project directory before reuse or redistribution.
