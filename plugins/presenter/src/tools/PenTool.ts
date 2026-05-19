import { Stroke } from '../types';
import { BaseTool } from './BaseTool';

export class PenTool extends BaseTool {
  color: string = '#ef4444';
  size: number = 3;

  get toolType(): Stroke['tool'] {
    return 'pen';
  }

  protected createStroke(): Stroke {
    return this.strokeManager.createStroke('pen', this.color, this.size, 1);
  }
}
