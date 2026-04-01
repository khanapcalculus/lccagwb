import { distanceBetween } from '../utils/geometry';

export const buildPolygonStroke = ({ points, color, strokeWidth, userUid }) => ({
  tool: 'polygon',
  color,
  width: strokeWidth,
  points,
  uid: userUid,
  id: Date.now(),
});

export const shouldClosePolygon = (points, nextPoint, threshold = 18) => (
  points.length >= 3 && distanceBetween(points[0], nextPoint) <= threshold
);

export const drawPolygonPreview = ({ ctx, points, hoverPoint, color, strokeWidth }) => {
  if (!points.length) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.setLineDash([6, 4]);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  if (points.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(points[0].x, points[0].y);
    ctx.strokeStyle = '#4caf50';
    ctx.stroke();
  }

  if (hoverPoint) {
    ctx.beginPath();
    ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(hoverPoint.x, hoverPoint.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
  }

  ctx.setLineDash([]);
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? '#4caf50' : color;
    ctx.fill();
  });
  ctx.restore();
};
