# Obsidian Presenter

**English** | [中文](README_CN.md)

A lightweight annotation plugin for [Obsidian](https://obsidian.md) — draw, highlight, and annotate directly on your notes for teaching and presentations.

![Obsidian](https://img.shields.io/badge/Obsidian-v1.0+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Pen Tool** — Freehand drawing with smooth Catmull-Rom spline interpolation
- **Highlighter Tool** — Semi-transparent highlight strokes with multiply blend mode (no opacity stacking)
- **Eraser Tool** — Click-to-erase with visual cursor indicator and bounding-box accelerated hit testing
- **Undo / Redo** — Full stroke-level undo/redo history
- **Scroll-aware** — Strokes stay anchored to document positions while scrolling
- **Zoom-aware** — Canvas auto-resizes after Ctrl+Scroll zoom
- **Custom SVG cursors** — Tool-shaped cursors for pen and highlighter; filled circle for eraser
- **Hover-safe overlay** — Transparent overlay prevents CSS hover flicker on tables, flowcharts, and code blocks
- **Compact floating toolbar** — Top-right toolbar with tool selection, undo/redo, clear, and exit
- **Keyboard shortcuts** — Full keyboard control for fast switching

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Shift+D` | Toggle annotation mode |
| `P` | Switch to Pen |
| `H` | Switch to Highlighter |
| `E` | Switch to Eraser |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Shift+C` | Clear all annotations |
| `Esc` | Exit annotation mode |

## Architecture

```
src/
├── main.ts                  # Plugin entry point, commands, ribbon icon
├── PresenterView.ts         # Core view controller (overlay, canvas, events, toolbar)
├── types.ts                 # Shared types and default settings
├── engine/
│   ├── RenderEngine.ts      # Canvas 2D rendering (strokes, cursor, scroll offset)
│   ├── SmoothCurve.ts       # Centripetal Catmull-Rom → Cubic Bezier conversion
│   └── StrokeManager.ts     # Stroke storage, undo/redo, bounding-box erase
└── tools/
    ├── BaseTool.ts          # Abstract base class for drawing tools
    ├── PenTool.ts           # Pen tool (solid strokes)
    ├── HighlighterTool.ts   # Highlighter tool (multiply blend, full redraw per frame)
    └── EraserTool.ts        # Eraser tool (config holder; logic in PresenterView)
```

### Design Decisions

- **Fixed canvas with pointer-events: none** — Canvas overlays the viewport but never blocks scrolling. Drawing events are captured at the document level.
- **Transparent overlay (z-index 9998)** — Sits between content and canvas to intercept hover events, preventing CSS `:hover` flicker on complex elements. Wheel events are forwarded to the scroll container.
- **Document coordinates** — Strokes are stored in document space (screen Y + scrollTop). On scroll, the canvas redraws with a translation offset.
- **Centripetal Catmull-Rom splines** — Produces smooth curves that pass through all control points, with `isFinite` fallback for degenerate cases (coincident points).
- **rAF-throttled redraws** — Scroll and eraser cursor redraws are batched via `requestAnimationFrame` to prevent jank.

## Installation

### From source

```bash
git clone https://github.com/cheer932041235/obsidian-presenter.git
cd obsidian-presenter
npm install
npm run build
```

Then copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/obsidian-presenter/` directory.

### Manual install

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/cheer932041235/obsidian-presenter/releases)
2. Create folder `.obsidian/plugins/obsidian-presenter/` in your vault
3. Place the three files inside
4. Restart Obsidian and enable the plugin in Settings → Community Plugins

## Development

```bash
npm install          # Install dependencies
npm run dev          # Development build (with sourcemap)
npm run build        # Production build (type-check + minified)
```

## Tech Stack

- **TypeScript** with `strict: true`
- **esbuild** for fast bundling
- **Canvas 2D API** for rendering
- **Obsidian Plugin API**

## License

[MIT](LICENSE) © 疏锦行
