import { Stroke, Point } from '../types';

export class StrokeManager {
  private strokes: Stroke[] = [];
  private undoStack: Stroke[] = [];
  private idCounter = 0;

  createStroke(tool: Stroke['tool'], color: string, size: number, opacity: number): Stroke {
    return {
      id: `stroke-${++this.idCounter}`,
      tool,
      color,
      size,
      opacity,
      points: [],
      boundingBox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    };
  }

  addPoint(stroke: Stroke, point: Point): void {
    stroke.points.push(point);
    // update bounding box
    const bb = stroke.boundingBox;
    const pad = stroke.size / 2 + 2;
    bb.minX = Math.min(bb.minX, point.x - pad);
    bb.minY = Math.min(bb.minY, point.y - pad);
    bb.maxX = Math.max(bb.maxX, point.x + pad);
    bb.maxY = Math.max(bb.maxY, point.y + pad);
  }

  commitStroke(stroke: Stroke): void {
    if (stroke.points.length > 0) {
      this.strokes.push(stroke);
      this.undoStack = []; // clear redo on new stroke
    }
  }

  getStrokes(): Stroke[] {
    return this.strokes;
  }

  undo(): Stroke | null {
    const stroke = this.strokes.pop();
    if (stroke) {
      this.undoStack.push(stroke);
      return stroke;
    }
    return null;
  }

  redo(): Stroke | null {
    const stroke = this.undoStack.pop();
    if (stroke) {
      this.strokes.push(stroke);
      return stroke;
    }
    return null;
  }

  clearAll(): void {
    this.strokes = [];
    this.undoStack = [];
  }

  /**
   * Eraser: find and remove strokes that intersect with the given point.
   * Returns removed strokes (for undo support).
   */
  eraseAt(x: number, y: number, radius: number): Stroke[] {
    const removed: Stroke[] = [];
    this.strokes = this.strokes.filter(stroke => {
      if (this.strokeIntersectsPoint(stroke, x, y, radius)) {
        removed.push(stroke);
        return false;
      }
      return true;
    });
    return removed;
  }

  private strokeIntersectsPoint(stroke: Stroke, x: number, y: number, radius: number): boolean {
    // quick bounding box check
    const bb = stroke.boundingBox;
    if (x + radius < bb.minX || x - radius > bb.maxX ||
        y + radius < bb.minY || y - radius > bb.maxY) {
      return false;
    }
    // detailed point-level check
    const r2 = (radius + stroke.size / 2) * (radius + stroke.size / 2);
    for (const p of stroke.points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < r2) {
        return true;
      }
    }
    return false;
  }

}
