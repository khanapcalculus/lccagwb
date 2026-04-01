import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export const useWhiteboardViewport = ({
  canvasRef,
  toolbarRef,
  tool,
  redrawAll,
  applyPointerInteraction,
}) => {
  const viewportOffsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const pointerClientPosRef = useRef(null);
  const autoPanSessionOriginRef = useRef(null);
  const touchPointersRef = useRef(new Map());
  const pinchStateRef = useRef({ active: false, lastDistance: 0 });
  const autoPanRef = useRef({
    rafId: null,
    lastTs: null,
    vx: 0,
    vy: 0,
    originOffset: null,
    maxDx: 0,
    maxDy: 0,
  });

  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [theme, setTheme] = useState(() => localStorage.getItem('whiteboard-theme') || 'dark');
  const [activePalette, setActivePalette] = useState(null);

  const getPointerClientPos = useCallback((event) => ({
    x: event.touches ? event.touches[0].clientX : event.clientX,
    y: event.touches ? event.touches[0].clientY : event.clientY,
  }), []);

  const getInputType = useCallback((event) => {
    if ('pointerType' in event && event.pointerType) return event.pointerType;
    if ('touches' in event || 'changedTouches' in event) return 'touch';
    return 'mouse';
  }, []);

  const isDirectTouchInput = useCallback((event) => getInputType(event) === 'touch', [getInputType]);

  const clampZoom = useCallback((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)), []);

  const setViewportOffsetState = useCallback((nextOffset) => {
    viewportOffsetRef.current = nextOffset;
    setViewportOffset(nextOffset);
  }, []);

  const setZoomState = useCallback((nextZoom) => {
    const clamped = clampZoom(nextZoom);
    zoomRef.current = clamped;
    setZoom(clamped);
    return clamped;
  }, [clampZoom]);

  const getPos = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerClientPos(event);
    return {
      x: (clientX - rect.left - viewportOffsetRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - viewportOffsetRef.current.y) / zoomRef.current,
    };
  }, [canvasRef, getPointerClientPos]);

  const getWorldPosFromClient = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewportOffsetRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - viewportOffsetRef.current.y) / zoomRef.current,
    };
  }, [canvasRef]);

  useEffect(() => {
    localStorage.setItem('whiteboard-theme', theme);
  }, [theme]);

  useEffect(() => {
    viewportOffsetRef.current = viewportOffset;
  }, [viewportOffset]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!toolbarRef.current?.contains(event.target)) {
        setActivePalette(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [toolbarRef]);

  useEffect(() => {
    setActivePalette(null);
  }, [tool]);

  const stopAutoPan = useCallback(() => {
    if (autoPanRef.current.rafId) {
      cancelAnimationFrame(autoPanRef.current.rafId);
    }
    autoPanRef.current = {
      rafId: null,
      lastTs: null,
      vx: 0,
      vy: 0,
      originOffset: null,
      maxDx: 0,
      maxDy: 0,
    };
  }, []);

  const beginAutoPanSession = useCallback(() => {
    autoPanSessionOriginRef.current = { ...viewportOffsetRef.current };
  }, []);

  const endAutoPanSession = useCallback(() => {
    autoPanSessionOriginRef.current = null;
    stopAutoPan();
  }, [stopAutoPan]);

  useEffect(() => () => endAutoPanSession(), [endAutoPanSession]);

  useEffect(() => {
    if (tool !== 'pen') {
      endAutoPanSession();
    }
  }, [endAutoPanSession, tool]);

  const applyZoomAtClientPoint = useCallback((clientX, clientY, nextZoom) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentZoom = zoomRef.current;
    const clampedZoom = clampZoom(nextZoom);
    if (Math.abs(clampedZoom - currentZoom) < 0.001) return;

    const worldX = (clientX - rect.left - viewportOffsetRef.current.x) / currentZoom;
    const worldY = (clientY - rect.top - viewportOffsetRef.current.y) / currentZoom;
    const nextOffset = {
      x: clientX - rect.left - worldX * clampedZoom,
      y: clientY - rect.top - worldY * clampedZoom,
    };

    setZoomState(clampedZoom);
    setViewportOffsetState(nextOffset);
  }, [canvasRef, clampZoom, setViewportOffsetState, setZoomState]);

  const getTouchPoints = useCallback(() => Array.from(touchPointersRef.current.values()), []);

  const getTouchDistance = useCallback((points) => {
    if (points.length < 2) return 0;
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }, []);

  const getTouchMidpoint = useCallback((points) => {
    if (points.length < 2) return null;
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }, []);

  const handleTouchGestureStart = useCallback((event) => {
    if (getInputType(event) !== 'touch') return false;

    touchPointersRef.current.set(event.pointerId, getPointerClientPos(event));
    const points = getTouchPoints();
    if (points.length === 2) {
      pinchStateRef.current = {
        active: true,
        lastDistance: getTouchDistance(points),
      };
      stopAutoPan();
      return true;
    }
    return false;
  }, [getInputType, getPointerClientPos, getTouchDistance, getTouchPoints, stopAutoPan]);

  const handleTouchGestureMove = useCallback((event) => {
    if (getInputType(event) !== 'touch') return false;
    if (!touchPointersRef.current.has(event.pointerId)) return false;

    touchPointersRef.current.set(event.pointerId, getPointerClientPos(event));
    const points = getTouchPoints();
    if (!pinchStateRef.current.active || points.length < 2) return false;

    const distance = getTouchDistance(points);
    const midpoint = getTouchMidpoint(points);
    if (!distance || !midpoint) return true;

    const scaleFactor = pinchStateRef.current.lastDistance
      ? distance / pinchStateRef.current.lastDistance
      : 1;

    if (Number.isFinite(scaleFactor) && scaleFactor > 0) {
      applyZoomAtClientPoint(midpoint.x, midpoint.y, zoomRef.current * scaleFactor);
      pinchStateRef.current.lastDistance = distance;
    }

    return true;
  }, [applyZoomAtClientPoint, getInputType, getPointerClientPos, getTouchDistance, getTouchMidpoint, getTouchPoints]);

  const handleTouchGestureEnd = useCallback((event) => {
    if (getInputType(event) !== 'touch') return false;

    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size < 2) {
      const wasActive = pinchStateRef.current.active;
      pinchStateRef.current = { active: false, lastDistance: 0 };
      return wasActive;
    }
    return false;
  }, [getInputType]);

  const stepAutoPan = useCallback((timestamp) => {
    const state = autoPanRef.current;
    if (!state.rafId) return;

    if (state.lastTs == null) {
      state.lastTs = timestamp;
      state.rafId = requestAnimationFrame(stepAutoPan);
      return;
    }

    const dt = Math.min((timestamp - state.lastTs) / 1000, 0.032);
    state.lastTs = timestamp;

    if (!state.vx && !state.vy) {
      stopAutoPan();
      return;
    }

    const nextOffset = {
      x: viewportOffsetRef.current.x + state.vx * dt,
      y: viewportOffsetRef.current.y + state.vy * dt,
    };

    if (state.originOffset) {
      const minX = state.originOffset.x - state.maxDx;
      const maxX = state.originOffset.x + state.maxDx;
      const minY = state.originOffset.y - state.maxDy;
      const maxY = state.originOffset.y + state.maxDy;
      nextOffset.x = Math.min(maxX, Math.max(minX, nextOffset.x));
      nextOffset.y = Math.min(maxY, Math.max(minY, nextOffset.y));

      if ((nextOffset.x === minX || nextOffset.x === maxX) && state.vx) state.vx = 0;
      if ((nextOffset.y === minY || nextOffset.y === maxY) && state.vy) state.vy = 0;
    }

    if (!state.vx && !state.vy) {
      stopAutoPan();
      return;
    }

    setViewportOffsetState(nextOffset);

    if (pointerClientPosRef.current) {
      applyPointerInteraction(pointerClientPosRef.current, true);
    }

    state.rafId = requestAnimationFrame(stepAutoPan);
  }, [applyPointerInteraction, setViewportOffsetState, stopAutoPan]);

  const updateAutoPanVelocity = useCallback((clientPos) => {
    const canvas = canvasRef.current;
    if (!canvas || tool !== 'pen') {
      stopAutoPan();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const effectiveLeft = Math.max(rect.left, 0);
    const effectiveTop = Math.max(rect.top, 0);
    const effectiveRight = Math.min(rect.right, viewportWidth);
    const effectiveBottom = Math.min(rect.bottom, viewportHeight);
    const threshold = 72;
    const maxSpeed = 220;
    let vx = 0;
    let vy = 0;

    if (clientPos.x - effectiveLeft < threshold) {
      const intensity = (threshold - (clientPos.x - effectiveLeft)) / threshold;
      vx = maxSpeed * intensity * intensity;
    } else if (effectiveRight - clientPos.x < threshold) {
      const intensity = (threshold - (effectiveRight - clientPos.x)) / threshold;
      vx = -maxSpeed * intensity * intensity;
    }

    if (clientPos.y - effectiveTop < threshold) {
      const intensity = (threshold - (clientPos.y - effectiveTop)) / threshold;
      vy = maxSpeed * intensity * intensity;
    } else if (effectiveBottom - clientPos.y < threshold) {
      const intensity = (threshold - (effectiveBottom - clientPos.y)) / threshold;
      vy = -maxSpeed * intensity * intensity;
    }

    autoPanRef.current.vx = vx;
    autoPanRef.current.vy = vy;

    if ((vx || vy) && !autoPanRef.current.rafId) {
      autoPanRef.current.lastTs = null;
      autoPanRef.current.originOffset = autoPanSessionOriginRef.current || { ...viewportOffsetRef.current };
      autoPanRef.current.maxDx = rect.width * 0.3;
      autoPanRef.current.maxDy = rect.height * 0.3;
      autoPanRef.current.rafId = requestAnimationFrame(stepAutoPan);
    } else if (!vx && !vy) {
      stopAutoPan();
    }
  }, [canvasRef, stepAutoPan, stopAutoPan, tool]);

  const handleWheelZoom = useCallback((event) => {
    if (!canvasRef.current) return;
    event.preventDefault();
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    applyZoomAtClientPoint(event.clientX, event.clientY, zoomRef.current * zoomFactor);
  }, [applyZoomAtClientPoint, canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelZoom);
  }, [canvasRef, handleWheelZoom]);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      redrawAll();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef, redrawAll]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll, viewportOffset, zoom]);

  const handleTogglePalette = useCallback((palette) => {
    setActivePalette((prev) => (prev === palette ? null : palette));
  }, []);

  return {
    state: {
      viewportOffset,
      zoom,
      theme,
      activePalette,
    },
    refs: {
      viewportOffsetRef,
      zoomRef,
      pointerClientPosRef,
    },
    helpers: {
      getPointerClientPos,
      isDirectTouchInput,
      getPos,
      getWorldPosFromClient,
      handleTouchGestureStart,
      handleTouchGestureMove,
      handleTouchGestureEnd,
      beginAutoPanSession,
      endAutoPanSession,
      stopAutoPan,
      updateAutoPanVelocity,
    },
    actions: {
      setTheme,
      setActivePalette,
      handleTogglePalette,
      setViewportOffset,
    },
  };
};
