import { useCallback, useEffect, useRef, useState } from 'react';

export const useWhiteboardViewport = ({
  canvasRef,
  toolbarRef,
  tool,
  redrawAll,
  applyPointerInteraction,
}) => {
  const viewportOffsetRef = useRef({ x: 0, y: 0 });
  const pointerClientPosRef = useRef(null);
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

  const getPos = useCallback((event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerClientPos(event);
    return {
      x: clientX - rect.left - viewportOffsetRef.current.x,
      y: clientY - rect.top - viewportOffsetRef.current.y,
    };
  }, [canvasRef, getPointerClientPos]);

  const getWorldPosFromClient = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left - viewportOffsetRef.current.x,
      y: clientY - rect.top - viewportOffsetRef.current.y,
    };
  }, [canvasRef]);

  useEffect(() => {
    localStorage.setItem('whiteboard-theme', theme);
  }, [theme]);

  useEffect(() => {
    viewportOffsetRef.current = viewportOffset;
  }, [viewportOffset]);

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

  useEffect(() => () => stopAutoPan(), [stopAutoPan]);

  useEffect(() => {
    if (tool !== 'pen') {
      stopAutoPan();
    }
  }, [stopAutoPan, tool]);

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

    viewportOffsetRef.current = nextOffset;
    setViewportOffset(nextOffset);

    if (pointerClientPosRef.current) {
      applyPointerInteraction(pointerClientPosRef.current, true);
    }

    state.rafId = requestAnimationFrame(stepAutoPan);
  }, [applyPointerInteraction, stopAutoPan]);

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
      autoPanRef.current.originOffset = { ...viewportOffsetRef.current };
      autoPanRef.current.maxDx = rect.width * 0.2;
      autoPanRef.current.maxDy = rect.height * 0.3;
      autoPanRef.current.rafId = requestAnimationFrame(stepAutoPan);
    } else if (!vx && !vy) {
      stopAutoPan();
    }
  }, [canvasRef, stepAutoPan, stopAutoPan, tool]);

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
  }, [redrawAll, viewportOffset]);

  const handleTogglePalette = useCallback((palette) => {
    setActivePalette((prev) => (prev === palette ? null : palette));
  }, []);

  return {
    state: {
      viewportOffset,
      theme,
      activePalette,
    },
    refs: {
      viewportOffsetRef,
      pointerClientPosRef,
    },
    helpers: {
      getPointerClientPos,
      isDirectTouchInput,
      getPos,
      getWorldPosFromClient,
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
