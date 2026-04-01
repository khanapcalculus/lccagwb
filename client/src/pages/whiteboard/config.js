export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export const TOOLS = [
  { id: 'point', icon: '•', label: 'Point' },
  { id: 'select', icon: '⬚', label: 'Select' },
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'eraser', icon: '⬜', label: 'Eraser' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'arrow', icon: '➜', label: 'Arrow' },
  { id: 'rect', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '◯', label: 'Circle' },
  { id: 'ellipse', icon: '⬭', label: 'Ellipse' },
  { id: 'polygon', icon: '⬠', label: 'Polygon' },
  { id: 'arc', icon: '◜', label: 'Arc' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'pan', icon: '✋', label: 'Pan' },
];

export const COLORS = ['#00d4ff', '#ffffff', '#a78bfa', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#ec4899', '#000000'];

export const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12, 18];
