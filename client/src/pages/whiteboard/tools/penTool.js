import { applyStrokeStyle, drawSmoothPath } from '../utils/strokeUtils';

export const updatePenStroke = ({
  pos,
  points,
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

  const incomingPoints = Array.isArray(points) && points.length ? points : (pos ? [pos] : []);
  if (!incomingPoints.length) return;

  const dedupedPoints = incomingPoints.filter((point, index) => {
    const previous = index === 0
      ? currentStroke.current[currentStroke.current.length - 1]
      : incomingPoints[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });

  if (!dedupedPoints.length) return;

  const previousPoint = currentStroke.current[currentStroke.current.length - 1] || null;
  currentStroke.current.push(...dedupedPoints);
  lastPos.current = dedupedPoints[dedupedPoints.length - 1];
  redrawAll();
  applyStrokeStyle(ctx, {
    color: colorRef.current,
    width: strokeWidthRef.current,
    tool: toolRef.current,
  });
  drawSmoothPath(ctx, currentStroke.current);

  if (shouldEmit) {
    const segmentPoints = previousPoint ? [previousPoint, ...dedupedPoints] : dedupedPoints;
    socketRef.current?.emit('draw-move', {
      points: segmentPoints,
      color: colorRef.current,
      width: strokeWidthRef.current,
      tool: toolRef.current,
    });
  }
};
