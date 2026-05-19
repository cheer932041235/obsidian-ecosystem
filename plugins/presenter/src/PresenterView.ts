import { Point, ToolType, PresenterSettings } from './types';
import { RenderEngine } from './engine/RenderEngine';
import { StrokeManager } from './engine/StrokeManager';
import { BaseTool } from './tools/BaseTool';
import { PenTool } from './tools/PenTool';
import { HighlighterTool } from './tools/HighlighterTool';
import { EraserTool } from './tools/EraserTool';

/**
 * Architecture v3:
 * - Canvas is FIXED over the viewport, pointer-events: none (scrolling works freely)
 * - Drawing uses document-level pointerdown/move/up listeners
 * - Strokes are stored in DOCUMENT coordinates (screen Y + scrollTop)
 * - On scroll, canvas redraws with current scroll offset
 * - This decouples drawing from scrolling entirely
 */
export class PresenterView {
  private canvas: HTMLCanvasElement;
  private engine: RenderEngine;
  private strokeManager: StrokeManager;
  private tools: Map<ToolType, BaseTool>;
  private currentTool: BaseTool;
  private currentToolType: ToolType;
  private active = false;
  private drawing = false;
  private scrollContainer: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private eraserCursorEl: HTMLElement | null = null;

  constructor(private settings: PresenterSettings) {
    this.strokeManager = new StrokeManager();

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'presenter-canvas';
    this.engine = new RenderEngine(this.canvas);

    const pen = new PenTool(this.engine, this.strokeManager);
    pen.color = settings.penColor;
    pen.size = settings.penSize;

    const highlighter = new HighlighterTool(this.engine, this.strokeManager);
    highlighter.color = settings.highlighterColor;
    highlighter.size = settings.highlighterSize;
    highlighter.opacity = settings.highlighterOpacity;

    const eraser = new EraserTool(this.engine, this.strokeManager);
    eraser.size = settings.eraserSize;

    this.tools = new Map<ToolType, BaseTool>([
      ['pen', pen],
      ['highlighter', highlighter],
      ['eraser', eraser],
    ]);

    this.currentToolType = settings.defaultTool;
    this.currentTool = this.tools.get(this.currentToolType)!;
  }

  isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    // Find the scroll container for scroll-following
    this.scrollContainer = this.findScrollContainer();

    // Transparent overlay blocks hover effects on underlying content
    this.overlay = document.createElement('div');
    this.overlay.className = 'presenter-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.inset = '0';
    this.overlay.style.zIndex = '9998';
    this.overlay.style.pointerEvents = 'auto';
    this.overlay.style.background = 'transparent';
    // Forward wheel events to scroll container so scrolling still works
    this.overlay.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey) return; // let Ctrl+Wheel zoom pass to Electron
      if (this.scrollContainer) {
        this.scrollContainer.scrollBy({ left: e.deltaX, top: e.deltaY });
      }
    }, { passive: true });
    document.body.appendChild(this.overlay);

    // Canvas is FIXED over viewport, above overlay
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';  // drawing handled by overlay + document capture
    this.canvas.style.zIndex = '9999';
    document.body.appendChild(this.canvas);
    this.engine.resize();
    this.updateClipPath();

    // Use document-level listeners with capture to get events before Obsidian
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    document.addEventListener('pointermove', this.handlePointerMove, true);
    document.addEventListener('pointerup', this.handlePointerUp, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('resize', this.handleResize);

    // Listen for scroll to redraw strokes at correct position
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
    }

    // Set cursor for drawing mode
    document.body.classList.add('presenter-active');
    this.applyToolClass(this.currentToolType);

    // Eraser cursor DOM element (not drawn on canvas — avoids clipPath clipping)
    this.eraserCursorEl = document.createElement('div');
    this.eraserCursorEl.className = 'presenter-eraser-cursor';
    const eraserSize = (this.tools.get('eraser') as EraserTool).size;
    this.eraserCursorEl.style.width = `${eraserSize * 2}px`;
    this.eraserCursorEl.style.height = `${eraserSize * 2}px`;
    this.eraserCursorEl.style.display = this.currentToolType === 'eraser' ? 'block' : 'none';
    document.body.appendChild(this.eraserCursorEl);

    // Create toolbar
    this.toolbar = this.createToolbar();
    document.body.appendChild(this.toolbar);

    // Also listen on window scroll as fallback
    window.addEventListener('scroll', this.handleScroll, true);

    // Listen for Ctrl+Wheel zoom — let it pass through, then re-sync canvas
    window.addEventListener('wheel', this.handleWheel, { passive: true });

    this.redrawWithScroll();
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.drawing = false;

    // Cancel any pending animation frames / timers
    if (this.scrollRAF !== null) { cancelAnimationFrame(this.scrollRAF); this.scrollRAF = null; }
    if (this.eraserRAF !== null) { cancelAnimationFrame(this.eraserRAF); this.eraserRAF = null; }
    if (this.zoomTimer) { clearTimeout(this.zoomTimer); this.zoomTimer = null; }

    this.currentTool.cancel();

    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    document.removeEventListener('pointermove', this.handlePointerMove, true);
    document.removeEventListener('pointerup', this.handlePointerUp, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('resize', this.handleResize);

    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    }
    window.removeEventListener('scroll', this.handleScroll, true);
    window.removeEventListener('wheel', this.handleWheel);

    document.body.style.cursor = '';
    document.body.classList.remove('presenter-active');
    this.removeToolClasses();

    // Remove toolbar, overlay, and eraser cursor
    if (this.toolbar) { this.toolbar.remove(); this.toolbar = null; }
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    if (this.eraserCursorEl) { this.eraserCursorEl.remove(); this.eraserCursorEl = null; }

    // Always clear all annotations and remove canvas on exit
    this.strokeManager.clearAll();
    this.engine.clear();
    this.canvas.remove();
  }

  destroy(): void {
    this.deactivate();
    this.strokeManager.clearAll();
    this.canvas.remove();
  }

  setTool(type: ToolType): void {
    this.currentTool.cancel();
    this.currentToolType = type;
    this.currentTool = this.tools.get(type)!;
    this.applyToolClass(type);
    this.updateToolbarActive(type);
    // Show/hide eraser cursor element based on tool
    if (this.eraserCursorEl) {
      this.eraserCursorEl.style.display = type === 'eraser' ? 'block' : 'none';
    }
    // Redraw with scroll offset to prevent wrong positions / ghost strokes
    this.redrawWithScroll();
  }

  undo(): void {
    this.strokeManager.undo();
    this.engine.invalidateCache();
    this.redrawWithScroll();
  }

  redo(): void {
    this.strokeManager.redo();
    this.engine.invalidateCache();
    this.redrawWithScroll();
  }

  clearAll(): void {
    this.strokeManager.clearAll();
    this.engine.invalidateCache();
    this.engine.clear();
    if (!this.active) {
      this.canvas.remove();
    }
  }

  updateSettings(settings: PresenterSettings): void {
    const pen = this.tools.get('pen') as PenTool;
    pen.color = settings.penColor;
    pen.size = settings.penSize;
    const hl = this.tools.get('highlighter') as HighlighterTool;
    hl.color = settings.highlighterColor;
    hl.size = settings.highlighterSize;
    hl.opacity = settings.highlighterOpacity;
    const eraser = this.tools.get('eraser') as EraserTool;
    eraser.size = settings.eraserSize;
  }

  // ─── Event handlers ───

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.active) return;
    if (e.button !== 0) return;

    // Ignore Obsidian UI chrome
    const target = e.target as HTMLElement;
    if (target.closest('.workspace-ribbon, .mod-left-split, .mod-right-split, .workspace-tab-header-container, .titlebar, .status-bar, .modal-container, .side-dock, .presenter-toolbar')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    this.drawing = true;

    if (this.currentToolType === 'eraser') {
      // Eraser: handle entirely here — bypass tool (it doesn't know about scroll offset)
      const screen = this.getScreenPoint(e);
      const scrollTop = this.getScrollTop();
      const eraserSize = (this.tools.get('eraser') as EraserTool).size;
      this.strokeManager.eraseAt(screen.x, screen.y + scrollTop, eraserSize);
      this.engine.invalidateCache();
      this.redrawWithScroll();
      this.updateEraserCursorPosition(screen.x, screen.y);
    } else {
      const point = this.getScreenPoint(e);
      this.currentTool.onPointerDown(point);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.active) return;

    // Don't draw tool cursors when hovering over toolbar
    const target = e.target as HTMLElement;
    const overToolbar = target.closest('.presenter-toolbar') !== null;

    const screen = this.getScreenPoint(e);

    if (this.drawing) {
      e.preventDefault();
      e.stopPropagation();

      if (this.currentToolType === 'eraser') {
        // Eraser: erase immediately, but batch the redraw
        const scrollTop = this.getScrollTop();
        const eraserSize = (this.tools.get('eraser') as EraserTool).size;
        this.strokeManager.eraseAt(screen.x, screen.y + scrollTop, eraserSize);
        this.engine.invalidateCache();
        this.scheduleEraserStrokeRedraw();
        if (!overToolbar) {
          this.updateEraserCursorPosition(screen.x, screen.y);
        }
      } else {
        // Pen/Highlighter: draw live at screen coords
        // Keep engine scroll offset in sync so HighlighterTool's internal redrawAll works correctly
        this.engine.setScrollOffset(this.getScrollTop());
        this.currentTool.onPointerMove(screen);
      }
      return;
    }

    // Hover: update eraser cursor position (DOM element — no canvas redraw needed)
    if (this.currentToolType === 'eraser') {
      if (overToolbar) {
        this.hideEraserCursor();
      } else {
        this.updateEraserCursorPosition(screen.x, screen.y);
      }
    }
  };

  private handlePointerUp = (_e: PointerEvent): void => {
    if (!this.active || !this.drawing) return;
    this.drawing = false;

    if (this.currentToolType === 'eraser') {
      // Eraser was handled directly, just redraw
      this.redrawWithScroll();
    } else {
      // Pen/Highlighter: convert screen coords → document coords before commit
      const scrollTop = this.getScrollTop();
      const currentStroke = this.currentTool.getCurrentStroke();
      if (currentStroke && scrollTop !== 0) {
        for (const p of currentStroke.points) {
          p.y += scrollTop;
        }
        currentStroke.boundingBox.minY += scrollTop;
        currentStroke.boundingBox.maxY += scrollTop;
      }
      this.currentTool.onPointerUp();
      this.engine.invalidateCache();
      this.redrawWithScroll();
    }
  };

  private handleScroll = (): void => {
    this.scheduleScrollRedraw();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.active) return;

    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Stop propagation for all handled keys to prevent Obsidian from receiving them
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); e.stopPropagation(); this.setTool('pen'); return; }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); e.stopPropagation(); this.setTool('highlighter'); return; }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); e.stopPropagation(); this.setTool('eraser'); return; }

    if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
      e.preventDefault(); e.stopPropagation();
      this.redo(); return;
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault(); e.stopPropagation();
      this.undo(); return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault(); e.stopPropagation();
      this.clearAll(); return;
    }
    if (e.key === 'Escape') {
      this.deactivate(); return;
    }
  };

  private handleResize = (): void => {
    if (!this.active) return;
    this.engine.resize();
    this.updateClipPath();
    this.redrawWithScroll();
  };

  private zoomTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ctrl+Wheel = Obsidian zoom. Let it happen, then re-sync canvas after zoom settles. */
  private handleWheel = (e: WheelEvent): void => {
    if (!this.active || !e.ctrlKey) return;
    if (this.zoomTimer) clearTimeout(this.zoomTimer);
    this.zoomTimer = setTimeout(() => {
      this.zoomTimer = null;
      this.engine.resize();
      this.updateClipPath();
      this.redrawWithScroll();
    }, 150);
  };

  // ─── Coordinate helpers ───

  /** Get scroll offset of the content area */
  private getScrollTop(): number {
    return this.scrollContainer ? this.scrollContainer.scrollTop : 0;
  }

  /** Get SCREEN coordinates from pointer event (no scroll offset) */
  private getScreenPoint(e: PointerEvent): Point {
    return {
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure || 0.5,
      timestamp: Date.now(),
    };
  }

  private scrollRAF: number | null = null;
  private eraserRAF: number | null = null;

  /** Redraw all strokes with scroll offset. Also updates engine.scrollOffset so
   *  any tool calling engine.redrawAll() internally also gets correct offset. */
  private redrawWithScroll(): void {
    this.engine.setScrollOffset(this.getScrollTop());
    this.engine.redrawAll(this.strokeManager.getStrokes());
  }

  /** Throttled scroll handler using requestAnimationFrame */
  private scheduleScrollRedraw(): void {
    if (this.scrollRAF !== null) return;
    this.scrollRAF = requestAnimationFrame(() => {
      this.scrollRAF = null;
      this.redrawWithScroll();
      // If actively drawing pen/highlighter, redraw the live stroke
      // (redrawAll clears the canvas, wiping incremental pen rendering)
      if (this.drawing && this.currentToolType !== 'eraser') {
        const stroke = this.currentTool.getCurrentStroke();
        if (stroke && stroke.points.length > 0) {
          this.engine.drawStroke(stroke);
        }
      }
    });
  }

  /** Throttled stroke redraw during eraser dragging */
  private scheduleEraserStrokeRedraw(): void {
    if (this.eraserRAF !== null) return;
    this.eraserRAF = requestAnimationFrame(() => {
      this.eraserRAF = null;
      this.redrawWithScroll();
    });
  }

  /** Position the eraser cursor DOM element at screen coordinates */
  private updateEraserCursorPosition(x: number, y: number): void {
    if (!this.eraserCursorEl) return;
    const eraserSize = (this.tools.get('eraser') as EraserTool).size;
    this.eraserCursorEl.style.left = `${x - eraserSize}px`;
    this.eraserCursorEl.style.top = `${y - eraserSize}px`;
    this.eraserCursorEl.style.display = 'block';
  }

  /** Hide eraser cursor (e.g. when hovering over toolbar) */
  private hideEraserCursor(): void {
    if (this.eraserCursorEl) this.eraserCursorEl.style.display = 'none';
  }

  /** Clip canvas and overlay to the editor content area so they don't cover tab bar, titlebar, sidebar */
  private updateClipPath(): void {
    const contentEl = document.querySelector('.workspace-leaf.mod-active .view-content') as HTMLElement;
    if (contentEl) {
      const r = contentEl.getBoundingClientRect();
      const clip = `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px)`;
      this.canvas.style.clipPath = clip;
      if (this.overlay) this.overlay.style.clipPath = clip;
    }
  }

  // ─── Toolbar ───

  private static readonly TOOL_CLASSES = ['presenter-tool-pen', 'presenter-tool-highlighter', 'presenter-tool-eraser'];

  private applyToolClass(type: ToolType): void {
    this.removeToolClasses();
    document.body.classList.add(`presenter-tool-${type}`);
  }

  private removeToolClasses(): void {
    for (const cls of PresenterView.TOOL_CLASSES) {
      document.body.classList.remove(cls);
    }
  }

  private updateToolbarActive(type: ToolType): void {
    if (!this.toolbar) return;
    this.toolbar.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === type);
    });
  }

  private createToolbar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'presenter-toolbar';

    const toolButtons: { tool: ToolType; icon: string; label: string; key: string }[] = [
      { tool: 'pen', icon: this.svgPen(), label: 'Pen', key: 'P' },
      { tool: 'highlighter', icon: this.svgHighlighter(), label: 'Highlighter', key: 'H' },
      { tool: 'eraser', icon: this.svgEraser(), label: 'Eraser', key: 'E' },
    ];

    for (const { tool, icon, label, key } of toolButtons) {
      const btn = document.createElement('button');
      btn.className = 'presenter-tool-btn' + (tool === this.currentToolType ? ' active' : '');
      btn.setAttribute('data-tool', tool);
      btn.title = `${label} (${key})`;
      btn.innerHTML = icon;
      // Color indicator dot for pen and highlighter
      if (tool === 'pen' || tool === 'highlighter') {
        const dot = document.createElement('span');
        dot.className = 'presenter-color-dot';
        const t = this.tools.get(tool) as PenTool | HighlighterTool;
        dot.style.background = t.color;
        btn.style.position = 'relative';
        btn.appendChild(dot);
      }
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.setTool(tool); });
      bar.appendChild(btn);
    }

    bar.appendChild(this.createSep());

    const actionButtons: { action: string; icon: string; label: string; handler: () => void }[] = [
      { action: 'undo', icon: this.svgUndo(), label: 'Undo (Ctrl+Z)', handler: () => this.undo() },
      { action: 'redo', icon: this.svgRedo(), label: 'Redo (Ctrl+Shift+Z)', handler: () => this.redo() },
      { action: 'clear', icon: this.svgClear(), label: 'Clear All (Ctrl+Shift+C)', handler: () => this.clearAll() },
    ];

    for (const { action, icon, label, handler } of actionButtons) {
      const btn = document.createElement('button');
      btn.className = 'presenter-tool-btn';
      btn.setAttribute('data-action', action);
      btn.title = label;
      btn.innerHTML = icon;
      btn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
      bar.appendChild(btn);
    }

    bar.appendChild(this.createSep());

    const exitBtn = document.createElement('button');
    exitBtn.className = 'presenter-tool-btn presenter-close-btn';
    exitBtn.title = 'Exit (Esc)';
    exitBtn.innerHTML = this.svgClose();
    exitBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deactivate(); });
    bar.appendChild(exitBtn);

    return bar;
  }

  private createSep(): HTMLElement {
    const sep = document.createElement('div');
    sep.className = 'presenter-toolbar-sep';
    return sep;
  }

  // ─── SVG Icons (Lucide-style, 20×20 viewBox 24) ───

  private svgPen(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
  }
  private svgHighlighter(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;
  }
  private svgEraser(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`;
  }
  private svgUndo(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
  }
  private svgRedo(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>`;
  }
  private svgClear(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
  }
  private svgClose(): string {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  }

  // ─── Helpers ───

  private findScrollContainer(): HTMLElement | null {
    // Strategy: find the active leaf, then search ALL descendants for the one that actually scrolls
    const leaf = document.querySelector('.workspace-leaf.mod-active') as HTMLElement;
    if (!leaf) return null;

    const allElements = leaf.querySelectorAll('*');
    let bestScrollable: HTMLElement | null = null;
    let bestScrollHeight = 0;

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as HTMLElement;
      if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 100) {
        const overflowY = getComputedStyle(el).overflowY;
        if (overflowY !== 'visible' && el.scrollHeight > bestScrollHeight) {
          bestScrollable = el;
          bestScrollHeight = el.scrollHeight;
        }
      }
    }

    if (bestScrollable) {
      return bestScrollable;
    }

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as HTMLElement;
      if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 100) {
        return el;
      }
    }
    return null;
  }

}
