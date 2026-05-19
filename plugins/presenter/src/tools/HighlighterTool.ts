import { Stroke, Point } from '../types';
import { BaseTool } from './BaseTool';

export class HighlighterTool extends BaseTool {
  color: string = '#facc15';
  size: number = 20;
  opacity: number = 0.35;

  get toolType(): Stroke['tool'] {
    return 'highlighter';
  }

  // onPointerDown inherited from BaseTool — identical logic

  onPointerMove(point: Point): void {
    if (!this.isActive || !this.currentStroke) return;
    this.curve.addPoint(point);
    this.strokeManager.addPoint(this.currentStroke, point);
    // Highlighter needs full redraw each frame to avoid opacity stacking
    this.engine.redrawAll(this.strokeManager.getStrokes());
    this.engine.drawLiveSegment(this.curve, this.currentStroke);
  }

  protected createStroke(): Stroke {
    return this.strokeManager.createStroke('highlighter', this.color, this.size, this.opacity);
  }
}
