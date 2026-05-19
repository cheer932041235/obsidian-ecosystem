import { Point, Stroke } from '../types';
import { RenderEngine } from '../engine/RenderEngine';
import { StrokeManager } from '../engine/StrokeManager';
import { SmoothCurve } from '../engine/SmoothCurve';

export abstract class BaseTool {
  protected engine: RenderEngine;
  protected strokeManager: StrokeManager;
  protected currentStroke: Stroke | null = null;
  protected curve: SmoothCurve = new SmoothCurve();
  protected isActive = false;

  constructor(engine: RenderEngine, strokeManager: StrokeManager) {
    this.engine = engine;
    this.strokeManager = strokeManager;
  }

  abstract get toolType(): Stroke['tool'];

  onPointerDown(point: Point): void {
    this.isActive = true;
    this.curve.reset();
    this.currentStroke = this.createStroke();
    this.curve.addPoint(point);
    this.strokeManager.addPoint(this.currentStroke, point);
  }

  onPointerMove(point: Point): void {
    if (!this.isActive || !this.currentStroke) return;
    this.curve.addPoint(point);
    this.strokeManager.addPoint(this.currentStroke, point);
    this.engine.drawLiveSegment(this.curve, this.currentStroke);
  }

  onPointerUp(): void {
    if (!this.isActive || !this.currentStroke) return;
    this.isActive = false;
    this.strokeManager.commitStroke(this.currentStroke);
    this.currentStroke = null;
    this.curve.reset();
    // Note: caller (PresenterView) is responsible for redrawing with correct scroll offset
  }

  getCurrentStroke(): Stroke | null {
    return this.currentStroke;
  }

  cancel(): void {
    this.isActive = false;
    this.currentStroke = null;
    this.curve.reset();
    // Note: caller (PresenterView) is responsible for redrawing with correct scroll offset
  }

  protected abstract createStroke(): Stroke;
}
