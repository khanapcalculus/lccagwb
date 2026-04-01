export const normalizeRect = (start, end) => ({
  left: Math.min(start.x, end.x),
  right: Math.max(start.x, end.x),
  top: Math.min(start.y, end.y),
  bottom: Math.max(start.y, end.y),
});

export const getEllipseMetrics = (start, end) => {
  const bounds = normalizeRect(start, end);
  return {
    cx: (bounds.left + bounds.right) / 2,
    cy: (bounds.top + bounds.bottom) / 2,
    rx: Math.max(1, (bounds.right - bounds.left) / 2),
    ry: Math.max(1, (bounds.bottom - bounds.top) / 2),
    bounds,
  };
};

export const pointInEllipse = (point, start, end, tolerance = 0.15) => {
  const { cx, cy, rx, ry } = getEllipseMetrics(start, end);
  const normalized = (((point.x - cx) ** 2) / (rx ** 2)) + (((point.y - cy) ** 2) / (ry ** 2));
  return normalized <= 1 + tolerance;
};

export const getPolygonBounds = (points = []) => {
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
};

export const getArrowHead = (start, end, size = 14) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const wing = Math.PI / 7;
  return [
    {
      x: end.x - size * Math.cos(angle - wing),
      y: end.y - size * Math.sin(angle - wing),
    },
    {
      x: end.x - size * Math.cos(angle + wing),
      y: end.y - size * Math.sin(angle + wing),
    },
  ];
};

export const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const normalizeAngle = (angle) => {
  let value = angle;
  while (value < 0) value += Math.PI * 2;
  while (value >= Math.PI * 2) value -= Math.PI * 2;
  return value;
};

export const angleBetweenPoints = (center, point) => normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x));

export const getArcMetrics = (center, radiusPoint, endPoint) => {
  const radius = Math.max(1, distanceBetween(center, radiusPoint));
  const startAngle = angleBetweenPoints(center, radiusPoint);
  const endAngle = angleBetweenPoints(center, endPoint);
  return { radius, startAngle, endAngle };
};

export const isAngleBetween = (value, start, end) => {
  const a = normalizeAngle(start);
  const b = normalizeAngle(end);
  const v = normalizeAngle(value);
  if (a <= b) return v >= a && v <= b;
  return v >= a || v <= b;
};
