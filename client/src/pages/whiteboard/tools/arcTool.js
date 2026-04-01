import { getArcMetrics } from '../utils/geometry';

export const buildArcStroke = ({ center, radiusPoint, endPoint, color, strokeWidth, userUid }) => {
  if (!center || !radiusPoint || !endPoint) return null;
  const { radius, startAngle, endAngle } = getArcMetrics(center, radiusPoint, endPoint);
  return {
    tool: 'arc',
    color,
    width: strokeWidth,
    points: [center, radiusPoint, endPoint],
    radius,
    startAngle,
    endAngle,
    uid: userUid,
    id: Date.now(),
  };
};

export const drawArcPreview = ({ ctx, draft, color, strokeWidth }) => {
  if (!draft?.center) return;

  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(draft.center.x, draft.center.y, 4, 0, Math.PI * 2);
  ctx.fill();

  if (draft.phase === 'radius' && draft.currentPoint) {
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(draft.center.x, draft.center.y);
    ctx.lineTo(draft.currentPoint.x, draft.currentPoint.y);
    ctx.stroke();
  }

  if (draft.phase === 'sweep' && draft.radiusPoint && draft.currentPoint) {
    const { radius, startAngle, endAngle } = getArcMetrics(draft.center, draft.radiusPoint, draft.currentPoint);
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(draft.center.x, draft.center.y);
    ctx.lineTo(draft.radiusPoint.x, draft.radiusPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(draft.center.x, draft.center.y, radius, startAngle, endAngle, false);
    ctx.stroke();
  }

  ctx.restore();
};
