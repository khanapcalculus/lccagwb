import { useCallback, useState } from 'react';
import { findClosestSnapPoint, getAllSnapPoints } from '../utils/snapUtils';

export const useWhiteboardSnap = ({ strokes }) => {
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [previewSnapPoint, setPreviewSnapPoint] = useState(null);

  const getSnappedPos = useCallback((pos) => {
    if (!snapEnabled) return pos;
    const snapPoints = getAllSnapPoints(strokes.current || []);
    const closest = findClosestSnapPoint(pos, snapPoints, 18);
    return closest ? { x: closest.x, y: closest.y } : pos;
  }, [snapEnabled, strokes]);

  const updatePreview = useCallback((pos) => {
    if (!snapEnabled) {
      setPreviewSnapPoint(null);
      return false;
    }
    const snapPoints = getAllSnapPoints(strokes.current || []);
    const closest = findClosestSnapPoint(pos, snapPoints, 18);
    setPreviewSnapPoint(closest);
    return Boolean(closest);
  }, [snapEnabled, strokes]);

  const clearPreview = useCallback(() => {
    setPreviewSnapPoint(null);
  }, []);

  const drawPreview = useCallback((ctx) => {
    if (!previewSnapPoint) return;
    ctx.save();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(previewSnapPoint.x, previewSnapPoint.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(previewSnapPoint.x - 10, previewSnapPoint.y);
    ctx.lineTo(previewSnapPoint.x + 10, previewSnapPoint.y);
    ctx.moveTo(previewSnapPoint.x, previewSnapPoint.y - 10);
    ctx.lineTo(previewSnapPoint.x, previewSnapPoint.y + 10);
    ctx.stroke();
    ctx.restore();
  }, [previewSnapPoint]);

  return {
    state: {
      snapEnabled,
      previewSnapPoint,
    },
    actions: {
      setSnapEnabled,
      getSnappedPos,
      updatePreview,
      clearPreview,
    },
    drawPreview,
  };
};
