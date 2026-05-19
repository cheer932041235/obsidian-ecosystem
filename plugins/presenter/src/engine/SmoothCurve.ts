import { Point } from '../types';

/**
 * Catmull-Rom spline → Cubic Bezier conversion
 * Produces smooth curves that pass through all control points
 */
export class SmoothCurve {
  private points: Point[] = [];
  private alpha = 0.5; // centripetal Catmull-Rom (0.5 = centripetal, 0 = uniform, 1 = chordal)

  reset(): void {
    this.points = [];
  }

  addPoint(p: Point): void {
    this.points.push(p);
  }

  /**
   * Draw the smoothed curve onto a canvas context.
   * Uses Catmull-Rom → Bezier conversion for segments with 4+ points,
   * falls back to quadratic/linear for fewer points.
   */
  drawSmoothed(ctx: CanvasRenderingContext2D): void {
    const pts = this.points;
    const n = pts.length;

    if (n === 0) return;

    if (n === 1) {
      // single dot
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (n === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (n === 3) {
      // quadratic through midpoint
      ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      ctx.stroke();
      return;
    }

    // Catmull-Rom → Bezier for each segment
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[Math.min(i + 1, n - 1)];
      const p3 = pts[Math.min(i + 2, n - 1)];

      const cp = this.catmullRomToBezier(p0, p1, p2, p3);
      ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
    }

    ctx.stroke();
  }

  /**
   * Draw only the latest segment (incremental rendering).
   * Call this during pointermove for low-latency feedback.
   */
  drawLatestSegment(ctx: CanvasRenderingContext2D): void {
    const pts = this.points;
    const n = pts.length;

    if (n < 2) return;

    if (n === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
      return;
    }

    const i = n - 2; // draw segment from pts[i] to pts[i+1]
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, n - 1)];

    const cp = this.catmullRomToBezier(p0, p1, p2, p3);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
    ctx.stroke();
  }

  /**
   * Convert Catmull-Rom segment (p0,p1,p2,p3) to cubic Bezier control points.
   * The curve goes from p1 to p2.
   */
  private catmullRomToBezier(
    p0: Point, p1: Point, p2: Point, p3: Point
  ): { cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
    const alpha = this.alpha;

    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const d3 = Math.hypot(p3.x - p2.x, p3.y - p2.y);

    const d1a = Math.pow(d1, alpha);
    const d2a = Math.pow(d2, alpha);
    const d3a = Math.pow(d3, alpha);

    // avoid division by zero
    const d1a2 = Math.pow(d1, 2 * alpha) || 1e-6;
    const d2a2 = Math.pow(d2, 2 * alpha) || 1e-6;
    const d3a2 = Math.pow(d3, 2 * alpha) || 1e-6;

    // Control point 1
    const cp1x = (d1a2 * p2.x - d2a2 * p0.x + (2 * d1a2 + 3 * d1a * d2a + d2a2) * p1.x)
      / (3 * d1a * (d1a + d2a));
    const cp1y = (d1a2 * p2.y - d2a2 * p0.y + (2 * d1a2 + 3 * d1a * d2a + d2a2) * p1.y)
      / (3 * d1a * (d1a + d2a));

    // Control point 2
    const cp2x = (d3a2 * p1.x - d2a2 * p3.x + (2 * d3a2 + 3 * d3a * d2a + d2a2) * p2.x)
      / (3 * d3a * (d3a + d2a));
    const cp2y = (d3a2 * p1.y - d2a2 * p3.y + (2 * d3a2 + 3 * d3a * d2a + d2a2) * p2.y)
      / (3 * d3a * (d3a + d2a));

    return {
      cp1x: isFinite(cp1x) ? cp1x : p1.x,
      cp1y: isFinite(cp1y) ? cp1y : p1.y,
      cp2x: isFinite(cp2x) ? cp2x : p2.x,
      cp2y: isFinite(cp2y) ? cp2y : p2.y,
    };
  }
}
