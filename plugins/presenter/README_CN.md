# Obsidian Presenter

一款轻量级 Obsidian 标注插件 —— 直接在笔记上绘制、高亮、批注，专为教学演示场景设计。

[English](README.md) | **中文**

![Obsidian](https://img.shields.io/badge/Obsidian-v1.0+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

- **画笔工具** — 自由绘制，Catmull-Rom 样条曲线平滑插值
- **荧光笔工具** — 半透明高亮笔触，multiply 混合模式（无透明度叠加）
- **橡皮擦工具** — 点击擦除，可视化光标指示器，包围盒加速碰撞检测
- **撤销 / 重做** — 完整的笔画级撤销重做历史
- **滚动跟随** — 笔迹锚定在文档位置，滚动时自动跟随
- **缩放适配** — Ctrl+滚轮缩放后画布自动重新同步
- **自定义 SVG 光标** — 画笔和荧光笔使用工具形状光标，橡皮擦使用实心圆
- **悬停安全遮罩** — 透明遮罩层阻止表格、流程图、代码块的 CSS hover 闪烁
- **浮动工具栏** — 右上角紧凑型工具栏，集成工具切换、撤销重做、清除、退出
- **快捷键支持** — 全键盘操控，快速切换

## 快捷键

| 按键 | 功能 |
|------|------|
| `Ctrl+Shift+D` | 开启/关闭标注模式 |
| `P` | 切换画笔 |
| `H` | 切换荧光笔 |
| `E` | 切换橡皮擦 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Ctrl+Shift+C` | 清除所有标注 |
| `Esc` | 退出标注模式 |

## 架构

```
src/
├── main.ts                  # 插件入口，命令注册，Ribbon 图标
├── PresenterView.ts         # 核心视图控制器（遮罩层、画布、事件、工具栏）
├── types.ts                 # 共享类型定义和默认设置
├── engine/
│   ├── RenderEngine.ts      # Canvas 2D 渲染（笔画、光标、滚动偏移、离屏缓存）
│   ├── SmoothCurve.ts       # 向心 Catmull-Rom → 三次贝塞尔曲线转换
│   └── StrokeManager.ts     # 笔画存储、撤销/重做、包围盒擦除
└── tools/
    ├── BaseTool.ts          # 绘图工具抽象基类
    ├── PenTool.ts           # 画笔工具（实色笔触）
    ├── HighlighterTool.ts   # 荧光笔工具（multiply 混合，逐帧全量重绘）
    └── EraserTool.ts        # 橡皮擦工具（配置持有者，逻辑在 PresenterView）
```

### 设计决策

- **固定画布 + pointer-events: none** — 画布覆盖视口但不阻止滚动，绘图事件在 document 级别捕获。
- **透明遮罩层（z-index 9998）** — 位于内容和画布之间，拦截 hover 事件，防止复杂元素的 CSS `:hover` 闪烁。滚轮事件转发给滚动容器。
- **文档坐标系** — 笔画以文档空间坐标存储（屏幕 Y + scrollTop）。滚动时画布通过平移偏移重绘。
- **向心 Catmull-Rom 样条** — 生成经过所有控制点的平滑曲线，`isFinite` 回退处理退化情况（重合点）。
- **rAF 节流重绘** — 滚动和橡皮擦光标重绘通过 `requestAnimationFrame` 批处理，防止卡顿。
- **离屏画布缓存** — 荧光笔绘制期间，已提交笔画从 O(N) 每帧降为 O(1) drawImage，显著提升性能。

## 安装

### 从源码构建

```bash
git clone https://github.com/cheer932041235/obsidian-presenter.git
cd obsidian-presenter
npm install
npm run build
```

然后将 `main.js`、`styles.css` 和 `manifest.json` 复制到 Vault 的 `.obsidian/plugins/obsidian-presenter/` 目录。

### 手动安装

1. 从 [最新 Release](https://github.com/cheer932041235/obsidian-presenter/releases) 下载 `main.js`、`styles.css` 和 `manifest.json`
2. 在 Vault 中创建文件夹 `.obsidian/plugins/obsidian-presenter/`
3. 将三个文件放入其中
4. 重启 Obsidian，在 设置 → 第三方插件 中启用

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 开发构建（含 sourcemap）
npm run build        # 生产构建（类型检查 + 压缩）
```

## 技术栈

- **TypeScript** `strict: true` 严格模式
- **esbuild** 快速打包
- **Canvas 2D API** 渲染引擎
- **Obsidian Plugin API**

## 许可证

[MIT](LICENSE) © 疏锦行
