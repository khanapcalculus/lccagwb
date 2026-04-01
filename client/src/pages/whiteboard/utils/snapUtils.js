import { getArcMetrics, getEllipseMetrics, getPolygonBounds, normalizeRect } from './geometry';
import { getLineIntersectionSnapPoints } from './intersections';

const midpoint = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const getStrokeSnapPoints = (stroke) => {
  if (!stroke?.points?.length) return [];

  if (stroke.tool === 'point') {
    return [{ x: stroke.points[0].x, y: stroke.points[0].y, type: 'point', strokeId: stroke.id }];
  }

  if ((stroke.tool === 'line' || stroke.tool === 'arrow') && stroke.points.length >= 2) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    return [
      { x: start.x, y: start.y, type: 'endpoint', strokeId: stroke.id },
      { x: end.x, y: end.y, type: 'endpoint', strokeId: stroke.id },
      { ...midpoint(start, end), type: 'midpoint', strokeId: stroke.id },
    ];
  }

  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const bounds = normalizeRect(stroke.points[0], stroke.points[stroke.points.length - 1]);
    return [
      { x: bounds.left, y: bounds.top, type: 'corner', strokeId: stroke.id },
      { x: bounds.right, y: bounds.top, type: 'corner', strokeId: stroke.id },
      { x: bounds.left, y: bounds.bottom, type: 'corner', strokeId: stroke.id },
      { x: bounds.right, y: bounds.bottom, type: 'corner', strokeId: stroke.id },
      { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2, type: 'center', strokeId: stroke.id },
    ];
  }

  if (stroke.tool === 'circle' && stroke.points.length >= 2) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    return [{
      x: start.x + (end.x - start.x) / 2,
      y: start.y + (end.y - start.y) / 2,
      type: 'center',
      strokeId: stroke.id,
    }];
  }

  if (stroke.tool === 'ellipse' && stroke.points.length >= 2) {
    const { cx, cy } = getEllipseMetrics(stroke.points[0], stroke.points[stroke.points.length - 1]);
    return [{ x: cx, y: cy, type: 'center', strokeId: stroke.id }];
  }

  if (stroke.tool === 'polygon' && stroke.points.length) {
    const points = stroke.points.map((point, index) => ({
      x: point.x,
      y: point.y,
      type: 'vertex',
      strokeId: stroke.id,
      vertexIndex: index,
    }));
    const bounds = getPolygonBounds(stroke.points);
    if (bounds) {
      points.push({
        x: (bounds.left + bounds.right) / 2,
        y: (bounds.top + bounds.bottom) / 2,
        type: 'center',
        strokeId: stroke.id,
      });
    }
    return points;
  }

  if (stroke.tool === 'arc' && stroke.points.length >= 3) {
    const center = stroke.points[0];
    const radiusPoint = stroke.points[1];
    const endPoint = stroke.points[2];
    const { radius, startAngle, endAngle } = getArcMetrics(center, radiusPoint, endPoint);
    return [
      { x: center.x, y: center.y, type: 'center', strokeId: stroke.id },
      { x: center.x + radius * Math.cos(startAngle), y: center.y + radius * Math.sin(startAngle), type: 'endpoint', strokeId: stroke.id },
      { x: center.x + radius * Math.cos(endAngle), y: center.y + radius * Math.sin(endAngle), type: 'endpoint', strokeId: stroke.id },
    ];
  }

  return [];
};

export const getAllSnapPoints = (strokes) => {
  const basePoints = strokes.flatMap((stroke) => getStrokeSnapPoints(stroke));
  const intersections = getLineIntersectionSnapPoints(strokes);
  return [...basePoints, ...intersections];
};

export const findClosestSnapPoint = (pos, snapPoints, threshold = 16) => {
  let closest = null;
  let minDistance = threshold;

  for (const point of snapPoints) {
    const distance = Math.hypot(pos.x - point.x, pos.y - point.y);
    if (distance < minDistance) {
      minDistance = distance;
      closest = point;
    }
  }

  return closest;
};
