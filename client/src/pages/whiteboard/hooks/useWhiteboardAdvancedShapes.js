import { useCallback, useEffect, useRef, useState } from 'react';
import { buildArcStroke, drawArcPreview } from '../tools/arcTool';
import { buildPolygonStroke, drawPolygonPreview, shouldClosePolygon } from '../tools/polygonTool';

export const useWhiteboardAdvancedShapes = ({
  tool,
  color,
  strokeWidth,
  user,
  appendStrokes,
  redrawAll,
}) => {
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [polygonHoverPoint, setPolygonHoverPoint] = useState(null);
  const polygonPointsRef = useRef([]);

  const [arcDraft, setArcDraft] = useState({
    phase: 'idle',
    center: null,
    radiusPoint: null,
    currentPoint: null,
  });
  const arcDraftRef = useRef(arcDraft);

  useEffect(() => {
    polygonPointsRef.current = polygonPoints;
  }, [polygonPoints]);

  useEffect(() => {
    arcDraftRef.current = arcDraft;
  }, [arcDraft]);

  const resetPolygon = useCallback(() => {
    setPolygonPoints([]);
    setPolygonHoverPoint(null);
  }, []);

  const resetArc = useCallback(() => {
    setArcDraft({
      phase: 'idle',
      center: null,
      radiusPoint: null,
      currentPoint: null,
    });
  }, []);

  useEffect(() => {
    if (tool !== 'polygon') resetPolygon();
    if (tool !== 'arc') resetArc();
  }, [resetArc, resetPolygon, tool]);

  const handlePointerDown = useCallback((pos) => {
    if (!user?.uid) return false;

    if (tool === 'point') {
      appendStrokes([{
        tool: 'point',
        color,
        width: strokeWidth,
        points: [pos],
        uid: user.uid,
        id: Date.now(),
      }]);
      return true;
    }

    if (tool === 'polygon') {
      const existing = polygonPointsRef.current;
      if (shouldClosePolygon(existing, pos)) {
        appendStrokes([buildPolygonStroke({
          points: existing,
          color,
          strokeWidth,
          userUid: user.uid,
        })]);
        resetPolygon();
        redrawAll();
        return true;
      }
      setPolygonPoints([...existing, pos]);
      return true;
    }

    if (tool === 'arc') {
      const draft = arcDraftRef.current;
      if (draft.phase === 'idle') {
        setArcDraft({
          phase: 'radius',
          center: pos,
          radiusPoint: null,
          currentPoint: pos,
        });
        return true;
      }

      if (draft.phase === 'radius') {
        setArcDraft({
          phase: 'sweep',
          center: draft.center,
          radiusPoint: pos,
          currentPoint: pos,
        });
        return true;
      }

      if (draft.phase === 'sweep') {
        const stroke = buildArcStroke({
          center: draft.center,
          radiusPoint: draft.radiusPoint,
          endPoint: pos,
          color,
          strokeWidth,
          userUid: user.uid,
        });
        if (stroke) {
          appendStrokes([stroke]);
        }
        resetArc();
        redrawAll();
        return true;
      }
    }

    return false;
  }, [appendStrokes, color, redrawAll, resetArc, resetPolygon, strokeWidth, tool, user?.uid]);

  const handlePointerMove = useCallback((pos) => {
    if (tool === 'polygon' && polygonPointsRef.current.length) {
      setPolygonHoverPoint(pos);
      return true;
    }

    if (tool === 'arc' && arcDraftRef.current.phase !== 'idle') {
      setArcDraft((prev) => ({ ...prev, currentPoint: pos }));
      return true;
    }

    return false;
  }, [tool]);

  const drawPreview = useCallback((ctx) => {
    if (tool === 'polygon' && polygonPointsRef.current.length) {
      drawPolygonPreview({
        ctx,
        points: polygonPointsRef.current,
        hoverPoint: polygonHoverPoint,
        color,
        strokeWidth,
      });
    }

    if (tool === 'arc' && arcDraftRef.current.phase !== 'idle') {
      drawArcPreview({
        ctx,
        draft: arcDraftRef.current,
        color,
        strokeWidth,
      });
    }
  }, [color, polygonHoverPoint, strokeWidth, tool]);

  return {
    actions: {
      handlePointerDown,
      handlePointerMove,
      resetPolygon,
      resetArc,
    },
    drawPreview,
    state: {
      polygonPoints,
      polygonHoverPoint,
      arcDraft,
    },
  };
};
