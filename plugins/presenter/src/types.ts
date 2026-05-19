export interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ToolType = 'pen' | 'highlighter' | 'eraser';

export interface PresenterSettings {
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  highlighterOpacity: number;
  eraserSize: number;
  defaultTool: ToolType;
}

export const DEFAULT_SETTINGS: PresenterSettings = {
  penColor: '#ef4444',
  penSize: 3,
  highlighterColor: '#facc15',
  highlighterSize: 20,
  highlighterOpacity: 0.35,
  eraserSize: 20,
  defaultTool: 'pen',
};
