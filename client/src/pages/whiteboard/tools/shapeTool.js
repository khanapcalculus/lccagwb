import { drawStroke } from '../utils/strokeUtils';

export const startShapeStroke = ({
  pos,
  isDrawing,
  lastPos,
  currentStroke,
  socketRef,
  color,
  strokeWidth,
  tool,
}) => {
  isDrawing.current = true;
  lastPos.current = pos;
  currentStroke.current = [pos];
  socketRef.current?.emit('draw-start', { x: pos.x, y: pos.y, color, width: strokeWidth, tool });
};

export const previewShapeStroke = ({
  pos,
  redrawAll,
  currentStroke,
  toolRef,
  colorRef,
  strokeWidthRef,
  getCtx,
  imageCache,
  redrawAllRef,
}) => {
  const ctx = getCtx();
  if (!ctx) return;

  redrawAll();
  const previewStroke = {
    tool: toolRef.current,
    color: colorRef.current,
    width: strokeWidthRef.current,
    points: [currentStroke.current[0], pos],
  };

  if (currentStroke.current.length === 1) currentStroke.current.push(pos);
  else currentStroke.current[currentStroke.current.length - 1] = pos;

  drawStroke(ctx, previewStroke, imageCache, () => redrawAllRef.current());
};

export const finishStroke = ({
  tool,
  color,
  strokeWidth,
  currentStroke,
  userUid,
  strokes,
  history,
  redrawAll,
  socketRef,
  isDrawing,
}) => {
  if (!isDrawing.current || !userUid) return null;

  isDrawing.current = false;
  const stroke = {
    tool,
    color,
    width: strokeWidth,
    points: currentStroke.current,
    uid: userUid,
    id: Date.now(),
  };

  strokes.current.push(stroke);
  history.current.push(stroke);

  if (tool === 'pen' || tool === 'eraser') {
    socketRef.current?.emit('draw-end', { stroke });
  } else {
    redrawAll();
    socketRef.current?.emit('add-shape', stroke);
  }

  currentStroke.current = [];
  return stroke;
};
