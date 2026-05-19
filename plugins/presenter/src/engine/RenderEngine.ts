import { Stroke } from '../types';
import { SmoothCurve } from './SmoothCurve';

export class RenderEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private scrollOffset = 0;

  // Offscreen canvas cache — avoids full redraw every frame during highlighter drawing
  private cacheCanvas: HTMLCanvasElement = document.createElement('canvas');
  private cacheCtx: CanvasRenderingContext2D | null = null;
  private cacheValid = false;
  private cacheScrollOffset = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D rendering context');
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
  }

  setScrollOffset(offset: number): void {
    this.scrollOffset = offset;
  }

  /** Mark the offscreen cache as stale. Call after any stroke change (commit/undo/redo/erase/clear). */
  invalidateCache(): void {
    this.cacheValid = false;
  }

  resize(width?: number, height?: number): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = width ?? this.canvas.getBoundingClientRect().width;
    const h = height ?? this.canvas.getBoundingClientRect().height;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    // Resize cache canvas to match
    this.cacheCanvas.width = this.canvas.width;
    this.cacheCanvas.height = this.canvas.height;
    this.cacheCtx = this.cacheCanvas.getContext('2d');
    this.cacheValid = false;
  }

  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /**
   * Full redraw of all strokes. Uses offscreen cache when possible —
   * during highlighter drawing, committed strokes don't change between frames,
   * so a single drawImage replaces N individual stroke renders.
   */
  redrawAll(strokes: Stroke[]): void {
    this.clear();

    // Fast path: cache hit (same strokes, same scroll offset)
    if (this.cacheValid && this.cacheScrollOffset === this.scrollOffset) {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.drawImage(this.cacheCanvas, 0, 0);
      this.ctx.restore();
      return;
    }

    // Slow path: full redraw
    this.ctx.save();
    this.ctx.translate(0, -this.scrollOffset);
    for (const stroke of strokes) {
      this.drawStroke(stroke);
    }
    this.ctx.restore();

    // Update cache
    if (this.cacheCtx) {
      this.cacheCtx.clearRect(0, 0, this.cacheCanvas.width, this.cacheCanvas.height);
      this.cacheCtx.drawImage(this.canvas, 0, 0);
      this.cacheValid = true;
      this.cacheScrollOffset = this.scrollOffset;
    }
  }

  /**
   * Draw a single completed stroke.
   */
  drawStroke(stroke: Stroke): void {
    if (stroke.points.length === 0) return;

    this.ctx.save();

    if (stroke.tool === 'highlighter') {
      this.drawHighlighterStroke(stroke);
    } else {
      this.setupStrokeStyle(stroke);
      const curve = new SmoothCurve();
      for (const p of stroke.points) {
        curve.addPoint(p);
      }
      curve.drawSmoothed(this.ctx);
    }

    this.ctx.restore();
  }

  /**
   * Draw a live segment during active drawing (low latency).
   */
  drawLiveSegment(curve: SmoothCurve, stroke: Stroke): void {
    this.ctx.save();

    if (stroke.tool === 'highlighter') {
      // for highlighter, redraw entire current stroke each frame
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.globalAlpha = stroke.opacity;
      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = stroke.size;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      curve.drawSmoothed(this.ctx);
    } else {
      this.setupStrokeStyle(stroke);
      curve.drawLatestSegment(this.ctx);
    }

    this.ctx.restore();
  }

  private setupStrokeStyle(stroke: Stroke): void {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = stroke.opacity;
    this.ctx.strokeStyle = stroke.color;
    this.ctx.fillStyle = stroke.color;
    this.ctx.lineWidth = stroke.size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  private drawHighlighterStroke(stroke: Stroke): void {
    this.ctx.globalCompositeOperation = 'multiply';
    this.ctx.globalAlpha = stroke.opacity;
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    const curve = new SmoothCurve();
    for (const p of stroke.points) {
      curve.addPoint(p);
    }
    curve.drawSmoothed(this.ctx);
  }

}
