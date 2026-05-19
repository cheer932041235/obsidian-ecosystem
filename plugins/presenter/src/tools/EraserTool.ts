import { Stroke } from '../types';
import { BaseTool } from './BaseTool';

/**
 * EraserTool — configuration holder for eraser size.
 *
 * Note: Eraser drawing logic (erase-at-point, cursor rendering) is handled
 * directly in PresenterView because it requires scroll-offset conversion
 * that tools don't have access to. This class only stores the `size`
 * property and satisfies the BaseTool interface.
 */
export class EraserTool extends BaseTool {
  size: number = 20;

  get toolType(): Stroke['tool'] {
    return 'eraser';
  }

  protected createStroke(): Stroke {
    // Eraser doesn't create strokes — required by abstract interface only
    return this.strokeManager.createStroke('eraser', '', 0, 0);
  }
}
