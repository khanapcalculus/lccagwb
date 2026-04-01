import { applyStrokeStyle, drawSmoothPath } from '../utils/strokeUtils';

export const updatePenStroke = ({
  pos,
  currentStroke,
  lastPos,
  redrawAll,
  getCtx,
  colorRef,
  strokeWidthRef,
  toolRef,
  socketRef,
  shouldEmit,
}) => {
  const ctx = getCtx();
  if (!ctx) return;

  currentStroke.current.push(pos);
  lastPos.current = pos;
  redrawAll();
  applyStrokeStyle(ctx, {
    color: colorRef.current,
    width: strokeWidthRef.current,
    tool: toolRef.current,
  });
  drawSmoothPath(ctx, currentStroke.current);

  if (shouldEmit) {
    socketRef.current?.emit('draw-move', {
      points: currentStroke.current.slice(-3),
      color: colorRef.current,
      width: strokeWidthRef.current,
      tool: toolRef.current,
    });
  }
};
