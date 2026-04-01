import { distanceBetween, getArcMetrics, getArrowHead, getEllipseMetrics, getPolygonBounds, isAngleBetween, pointInEllipse } from './geometry';

export const applyStrokeStyle = (ctx, stroke) => {
  ctx.strokeStyle = stroke.color || '#00d4ff';
  ctx.lineWidth = stroke.width || 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'source-over';
};

export const drawSmoothPath = (ctx, points) => {
  if (!points?.length) return;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, Math.max(ctx.lineWidth / 2, 1), 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }

  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
  ctx.stroke();
};

export const distanceToSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const proj = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - proj.x, point.y - proj.y);
};

export const getStrokeBounds = (stroke) => {
  if (!stroke?.points?.length) return null;

  if (stroke.tool === 'point') {
    const point = stroke.points[0];
    const radius = Math.max((stroke.width || 4) * 1.5, 6);
    return {
      left: point.x - radius,
      top: point.y - radius,
      right: point.x + radius,
      bottom: point.y + radius,
    };
  }

  if (stroke.tool === 'text' && stroke.text) {
    const fontSize = (stroke.width || 4) * 4 + 12;
    const textWidth = stroke.text.length * fontSize * 0.6;
    return {
      left: stroke.points[0].x,
      top: stroke.points[0].y - fontSize,
      right: stroke.points[0].x + textWidth,
      bottom: stroke.points[0].y,
    };
  }

  if (stroke.tool === 'image') {
    return {
      left: stroke.points[0].x,
      top: stroke.points[0].y,
      right: stroke.points[0].x + (stroke.imageWidth || 0),
      bottom: stroke.points[0].y + (stroke.imageHeight || 0),
    };
  }

  if (stroke.tool === 'ellipse' && stroke.points.length >= 2) {
    const { bounds } = getEllipseMetrics(stroke.points[0], stroke.points[stroke.points.length - 1]);
    return bounds;
  }

  if (stroke.tool === 'polygon' && stroke.points.length) {
    return getPolygonBounds(stroke.points);
  }

  if (stroke.tool === 'arc' && stroke.points.length >= 3) {
    const center = stroke.points[0];
    const radiusPoint = stroke.points[1];
    const { radius } = getArcMetrics(center, radiusPoint, stroke.points[2]);
    return {
      left: center.x - radius,
      top: center.y - radius,
      right: center.x + radius,
      bottom: center.y + radius,
    };
  }

  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
};

export const translateStroke = (stroke, dx, dy) => ({
  ...stroke,
  points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
});

export const drawSelectionOutline = (ctx, stroke) => {
  const bounds = getStrokeBounds(stroke);
  if (!bounds) return;

  const padding = 8;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(
    bounds.left - padding,
    bounds.top - padding,
    bounds.right - bounds.left + padding * 2,
    bounds.bottom - bounds.top + padding * 2
  );
  ctx.restore();
};

export const doesStrokeHitPoint = (stroke, point) => {
  const tolerance = Math.max(10, (stroke.width || 4) * 2);
  if (!stroke?.points?.length) return false;

  if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
    for (let i = 1; i < stroke.points.length; i += 1) {
      if (distanceToSegment(point, stroke.points[i - 1], stroke.points[i]) <= tolerance) return true;
    }
    return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= tolerance;
  }

  if ((stroke.tool === 'line' || stroke.tool === 'arrow') && stroke.points.length >= 2) {
    return distanceToSegment(point, stroke.points[0], stroke.points[stroke.points.length - 1]) <= tolerance;
  }

  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    return point.x >= left - tolerance && point.x <= right + tolerance && point.y >= top - tolerance && point.y <= bottom + tolerance;
  }

  if (stroke.tool === 'circle' && stroke.points.length >= 2) {
    const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
    const cx = start.x + (end.x - start.x) / 2;
    const cy = start.y + (end.y - start.y) / 2;
    const rx = Math.max(1, Math.abs(end.x - start.x) / 2);
    const ry = Math.max(1, Math.abs(end.y - start.y) / 2);
    const normalized = (((point.x - cx) ** 2) / (rx ** 2)) + (((point.y - cy) ** 2) / (ry ** 2));
    return normalized <= 1.15;
  }

  if (stroke.tool === 'ellipse' && stroke.points.length >= 2) {
    return pointInEllipse(point, stroke.points[0], stroke.points[stroke.points.length - 1], 0.18);
  }

  if (stroke.tool === 'arc' && stroke.points.length >= 3) {
    const center = stroke.points[0];
    const radiusPoint = stroke.points[1];
    const endPoint = stroke.points[2];
    const { radius, startAngle, endAngle } = getArcMetrics(center, radiusPoint, endPoint);
    const dist = distanceBetween(point, center);
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    return Math.abs(dist - radius) <= tolerance && isAngleBetween(angle, startAngle, endAngle);
  }

  if (stroke.tool === 'point' && stroke.points[0]) {
    return distanceBetween(point, stroke.points[0]) <= tolerance;
  }

  if (stroke.tool === 'text' && stroke.text) {
    const fontSize = (stroke.width || 4) * 4 + 12;
    const textWidth = stroke.text.length * fontSize * 0.6;
    return point.x >= stroke.points[0].x - tolerance
      && point.x <= stroke.points[0].x + textWidth + tolerance
      && point.y <= stroke.points[0].y + tolerance
      && point.y >= stroke.points[0].y - fontSize - tolerance;
  }

  if (stroke.tool === 'image' && stroke.points[0]) {
    const { x, y } = stroke.points[0];
    return point.x >= x - tolerance
      && point.x <= x + (stroke.imageWidth || 0) + tolerance
      && point.y >= y - tolerance
      && point.y <= y + (stroke.imageHeight || 0) + tolerance;
  }

  if (stroke.tool === 'polygon' && stroke.points.length >= 2) {
    for (let i = 0; i < stroke.points.length; i += 1) {
      const start = stroke.points[i];
      const end = stroke.points[(i + 1) % stroke.points.length];
      if (distanceToSegment(point, start, end) <= tolerance) return true;
    }
  }

  return false;
};

export const drawStroke = (ctx, stroke, imageCache, onImageLoad) => {
  if (!stroke?.points?.length) return;

  applyStrokeStyle(ctx, stroke);

  if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
    drawSmoothPath(ctx, stroke.points);
    return;
  }

  if (stroke.tool === 'point' && stroke.points[0]) {
    const point = stroke.points[0];
    const radius = Math.max((stroke.width || 4) * 0.9, 3);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color || '#00d4ff';
    ctx.fill();
    return;
  }

  if ((stroke.tool === 'line' || stroke.tool === 'arrow') && stroke.points.length >= 2) {
    const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    if (stroke.tool === 'arrow') {
      const [wingA, wingB] = getArrowHead(start, end, Math.max(12, (stroke.width || 4) * 3));
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(wingA.x, wingA.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(wingB.x, wingB.y);
      ctx.stroke();
    }
    return;
  }

  if (stroke.tool === 'rect' && stroke.points.length >= 2) {
    const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    return;
  }

  if (stroke.tool === 'circle' && stroke.points.length >= 2) {
    const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(start.x + (end.x - start.x) / 2, start.y + (end.y - start.y) / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'ellipse' && stroke.points.length >= 2) {
    const { cx, cy, rx, ry } = getEllipseMetrics(stroke.points[0], stroke.points[stroke.points.length - 1]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'polygon' && stroke.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    if (stroke.points.length >= 3) {
      ctx.closePath();
    }
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'arc' && stroke.points.length >= 3) {
    const center = stroke.points[0];
    const radiusPoint = stroke.points[1];
    const endPoint = stroke.points[2];
    const { radius, startAngle, endAngle } = getArcMetrics(center, radiusPoint, endPoint);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, startAngle, endAngle, false);
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'text' && stroke.text) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = stroke.color;
    ctx.font = `${stroke.width * 4 + 12}px Inter, sans-serif`;
    ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
    return;
  }

  if (stroke.tool === 'image' && stroke.src) {
    let image = imageCache.current.get(stroke.src);
    if (!image) {
      image = new Image();
      image.onload = onImageLoad;
      image.src = stroke.src;
      imageCache.current.set(stroke.src, image);
    }
    if (image.complete) {
      ctx.drawImage(
        image,
        stroke.points[0].x,
        stroke.points[0].y,
        stroke.imageWidth || image.width,
        stroke.imageHeight || image.height
      );
    }
  }
};
