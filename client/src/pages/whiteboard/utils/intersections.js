import { getArcMetrics, getEllipseMetrics, normalizeRect } from './geometry';

const approximateEllipseSegments = (start, end, steps = 32) => {
  const { cx, cy, rx, ry } = getEllipseMetrics(start, end);
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return { x1: point.x, y1: point.y, x2: next.x, y2: next.y };
  });
};

const approximateArcSegments = (stroke, steps = 24) => {
  if (!stroke?.points || stroke.points.length < 3) return [];
  const center = stroke.points[0];
  const radiusPoint = stroke.points[1];
  const endPoint = stroke.points[2];
  const { radius, startAngle, endAngle } = getArcMetrics(center, radiusPoint, endPoint);

  let span = endAngle - startAngle;
  if (span <= 0) span += Math.PI * 2;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = startAngle + (span * i) / steps;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  const segments = [];
  for (let i = 1; i < points.length; i += 1) {
    segments.push({
      x1: points[i - 1].x,
      y1: points[i - 1].y,
      x2: points[i].x,
      y2: points[i].y,
    });
  }
  return segments;
};

export const lineLineIntersection = (lineA, lineB) => {
  const { x1, y1, x2, y2 } = lineA;
  const { x1: x3, y1: y3, x2: x4, y2: y4 } = lineB;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
};

export const getLineSegments = (stroke) => {
  if (!stroke?.points?.length) return [];

  if ((stroke.tool === 'line' || stroke.tool === 'arrow') && stroke.points.length >= 2) {
    return [{
      x1: stroke.points[0].x,
      y1: stroke.points[0].y,
      x2: stroke.points[stroke.points.length - 1].x,
      y2: stroke.points[stroke.points.length - 1].y,
    }];
  }

  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const bounds = normalizeRect(stroke.points[0], stroke.points[stroke.points.length - 1]);
    return [
      { x1: bounds.left, y1: bounds.top, x2: bounds.right, y2: bounds.top },
      { x1: bounds.right, y1: bounds.top, x2: bounds.right, y2: bounds.bottom },
      { x1: bounds.right, y1: bounds.bottom, x2: bounds.left, y2: bounds.bottom },
      { x1: bounds.left, y1: bounds.bottom, x2: bounds.left, y2: bounds.top },
    ];
  }

  if (stroke.tool === 'polygon' && stroke.points.length >= 2) {
    return stroke.points.map((point, index) => {
      const next = stroke.points[(index + 1) % stroke.points.length];
      return {
        x1: point.x,
        y1: point.y,
        x2: next.x,
        y2: next.y,
      };
    });
  }

  if ((stroke.tool === 'circle' || stroke.tool === 'ellipse') && stroke.points.length >= 2) {
    return approximateEllipseSegments(stroke.points[0], stroke.points[stroke.points.length - 1]);
  }

  if (stroke.tool === 'arc') {
    return approximateArcSegments(stroke);
  }

  return [];
};

export const getLineIntersectionSnapPoints = (strokes) => {
  const segments = strokes.flatMap((stroke) => (
    getLineSegments(stroke).map((segment) => ({ ...segment, strokeId: stroke.id }))
  ));

  const intersections = [];
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (segments[i].strokeId === segments[j].strokeId) continue;
      const point = lineLineIntersection(segments[i], segments[j]);
      if (!point) continue;
      intersections.push({
        x: point.x,
        y: point.y,
        type: 'intersection',
      });
    }
  }

  const deduped = [];
  intersections.forEach((point) => {
    const exists = deduped.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 6);
    if (!exists) deduped.push(point);
  });
  return deduped;
};
