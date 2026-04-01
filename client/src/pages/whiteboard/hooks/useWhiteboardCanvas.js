import { useCallback, useEffect, useRef, useState } from 'react';
import { COLORS, STROKE_WIDTHS, TOOLS } from '../config';
import { useWhiteboardBoardActions } from './useWhiteboardBoardActions';
import { useWhiteboardAdvancedShapes } from './useWhiteboardAdvancedShapes';
import { useWhiteboardSnap } from './useWhiteboardSnap';
import { useWhiteboardSocket } from './useWhiteboardSocket';
import { useWhiteboardText } from './useWhiteboardText';
import { useWhiteboardVersions } from './useWhiteboardVersions';
import { useWhiteboardViewport } from './useWhiteboardViewport';
import { eraseStrokeAtPoint } from '../tools/eraserTool';
import { updatePenStroke } from '../tools/penTool';
import { startPan, stopPan, updatePan } from '../tools/panTool';
import { startSelection, stopSelection } from '../tools/selectTool';
import { finishStroke, previewShapeStroke, startShapeStroke } from '../tools/shapeTool';
import { beginTextInput } from '../tools/textTool';
import {
  applyStrokeStyle,
  doesStrokeHitPoint,
  drawSelectionOutline,
  drawStroke,
  translateStroke,
} from '../utils/strokeUtils';

export const useWhiteboardCanvas = ({ roomId, user, userProfile }) => {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const toolbarRef = useRef(null);
  const socketRef = useRef(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const currentStroke = useRef([]);
  const strokes = useRef([]);
  const history = useRef([]);
  const panState = useRef({ pointer: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });
  const imageCache = useRef(new Map());
  const redrawAllRef = useRef(() => {});
  const viewportApiRef = useRef(null);
  const snapApiRef = useRef(null);
  const advancedShapesApiRef = useRef(null);
  const selectionDrag = useRef({ active: false, strokeId: null, origin: null, snapshot: null, lastDelta: { x: 0, y: 0 } });
  const toolRef = useRef('pen');
  const colorRef = useRef(COLORS[0]);
  const strokeWidthRef = useRef(STROKE_WIDTHS[1]);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);
  const [cursors, setCursors] = useState({});
  const [saved, setSaved] = useState(false);
  const [selectedStrokeId, setSelectedStrokeId] = useState(null);

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d'), []);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  const configureCtx = useCallback((ctx) => {
    const dpr = window.devicePixelRatio || 1;
    const viewportOffset = viewportApiRef.current?.refs.viewportOffsetRef.current || { x: 0, y: 0 };
    const zoom = viewportApiRef.current?.refs.zoomRef.current || 1;
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, viewportOffset.x * dpr, viewportOffset.y * dpr);
  }, []);

  const redrawAll = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    configureCtx(ctx);
    ctx.globalCompositeOperation = 'source-over';
    strokes.current.forEach((stroke) => drawStroke(ctx, stroke, imageCache, () => redrawAllRef.current()));
    snapApiRef.current?.drawPreview(ctx);
    advancedShapesApiRef.current?.drawPreview(ctx);
    if (selectedStrokeId) {
      const selected = strokes.current.find((stroke) => stroke.id === selectedStrokeId);
      if (selected) drawSelectionOutline(ctx, selected);
    }
  }, [configureCtx, getCtx, selectedStrokeId]);
  redrawAllRef.current = redrawAll;

  const appendStrokes = useCallback((newStrokes, socketEvent = 'add-shape') => {
    if (!newStrokes.length) return;
    strokes.current = [...strokes.current, ...newStrokes];
    history.current = [...history.current, ...newStrokes];
    redrawAll();
    newStrokes.forEach((stroke) => socketRef.current?.emit(socketEvent, stroke));
  }, [redrawAll]);

  const applySelectionDragAtPos = useCallback((pos, shouldEmit = true) => {
    const dx = pos.x - selectionDrag.current.origin.x;
    const dy = pos.y - selectionDrag.current.origin.y;
    const deltaDx = dx - selectionDrag.current.lastDelta.x;
    const deltaDy = dy - selectionDrag.current.lastDelta.y;

    strokes.current = strokes.current.map((stroke) => (
      stroke.id === selectionDrag.current.strokeId
        ? translateStroke(selectionDrag.current.snapshot, dx, dy)
        : stroke
    ));
    history.current = strokes.current;
    selectionDrag.current.lastDelta = { x: dx, y: dy };
    redrawAll();

    if (shouldEmit && (deltaDx || deltaDy)) {
      socketRef.current?.emit('move-stroke', {
        strokeId: selectionDrag.current.strokeId,
        dx: deltaDx,
        dy: deltaDy,
      });
    }
  }, [redrawAll]);

  const applyPointerInteraction = useCallback((clientPos, shouldEmit = true) => {
    if (!clientPos) return;
    const viewportApi = viewportApiRef.current;
    const snapApi = snapApiRef.current;
    if (!viewportApi) return;

    const rawPos = viewportApi.helpers.getWorldPosFromClient(clientPos.x, clientPos.y);
    const pos = toolRef.current === 'pen'
      ? rawPos
      : (snapApi?.actions.getSnappedPos(rawPos) || rawPos);

    if (toolRef.current === 'select' && selectionDrag.current.active) {
      applySelectionDragAtPos(pos, shouldEmit);
      return;
    }

    if (!isDrawing.current) return;

    if (toolRef.current === 'pen') {
      updatePenStroke({
        pos,
        currentStroke,
        lastPos,
        redrawAll,
        getCtx,
        colorRef,
        strokeWidthRef,
        toolRef,
        socketRef,
        shouldEmit,
      });
      return;
    }

    previewShapeStroke({
      pos,
      redrawAll,
      currentStroke,
      toolRef,
      colorRef,
      strokeWidthRef,
      getCtx,
      imageCache,
      redrawAllRef,
    });
  }, [applySelectionDragAtPos, getCtx, redrawAll]);

  const viewport = useWhiteboardViewport({
    canvasRef,
    toolbarRef,
    tool,
    redrawAll,
    applyPointerInteraction,
  });

  const text = useWhiteboardText({
    color,
    strokeWidth,
    user,
    strokes,
    history,
    redrawAll,
    socketRef,
  });

  const boardActions = useWhiteboardBoardActions({
    roomId,
    user,
    fileInputRef,
    canvasRef,
    viewportOffsetRef: viewport.refs.viewportOffsetRef,
    strokes,
    history,
    appendStrokes,
    redrawAll,
    socketRef,
    getCtx,
    setSelectedStrokeId,
  });

  const snap = useWhiteboardSnap({ strokes });

  const advancedShapes = useWhiteboardAdvancedShapes({
    tool,
    color,
    strokeWidth,
    user,
    appendStrokes,
    redrawAll,
  });

  viewportApiRef.current = viewport;
  snapApiRef.current = snap;
  advancedShapesApiRef.current = advancedShapes;

  const versions = useWhiteboardVersions({
    roomId,
    socketRef,
  });

  useEffect(() => {
    redrawAll();
  }, [
    advancedShapes.state.arcDraft,
    advancedShapes.state.polygonHoverPoint,
    advancedShapes.state.polygonPoints,
    snap.state.previewSnapPoint,
    redrawAll,
  ]);

  useWhiteboardSocket({
    roomId,
    user,
    userProfile,
    setConnected,
    setParticipants,
    setCursors,
    setSaved,
    setSelectedStrokeId,
    strokesRef: strokes,
    historyRef: history,
    socketRef,
    canvasRef,
    redrawAllRef,
    getCtx,
    applyStrokeStyle,
    translateStroke,
  });

  const handleToolSelect = useCallback((nextTool) => {
    setTool(nextTool);
    viewport.actions.setActivePalette(null);
  }, [viewport.actions]);

  const handleColorSelect = useCallback((nextColor) => {
    setColor(nextColor);
    viewport.actions.setActivePalette(null);
  }, [viewport.actions]);

  const handleStrokeWidthSelect = useCallback((nextWidth) => {
    setStrokeWidth(nextWidth);
    viewport.actions.setActivePalette(null);
  }, [viewport.actions]);

  const startDrawing = useCallback((event) => {
    event.preventDefault();
    if (viewport.helpers.handleTouchGestureStart(event)) return;
    if (viewport.helpers.isDirectTouchInput(event) && tool !== 'pan') return;

    if ('pointerId' in event) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    viewport.refs.pointerClientPosRef.current = viewport.helpers.getPointerClientPos(event);
    if (tool === 'pen') {
      viewport.helpers.beginAutoPanSession();
    }
    viewport.helpers.updateAutoPanVelocity(viewport.refs.pointerClientPosRef.current);

    if (tool === 'pan') {
      startPan({
        event,
        getPointerClientPos: viewport.helpers.getPointerClientPos,
        viewportOffsetRef: viewport.refs.viewportOffsetRef,
        panState,
        isPanning,
      });
      return;
    }

    if (tool === 'select') {
      startSelection({
        pos: viewport.helpers.getPos(event),
        strokes,
        doesStrokeHitPoint,
        setSelectedStrokeId,
        selectionDrag,
        redrawAll,
      });
      return;
    }

    if (tool === 'eraser') {
      eraseStrokeAtPoint({
        pos: viewport.helpers.getPos(event),
        strokes,
        history,
        doesStrokeHitPoint,
        redrawAll,
        socketRef,
      });
      return;
    }

    if (tool === 'text') {
      beginTextInput({
        pos: viewport.helpers.getPos(event),
        showTextInput: text.state.showTextInput,
        textValue: text.state.textValue,
        addText: text.actions.addText,
        setTextPos: text.actions.setTextPos,
        setTextValue: text.actions.setTextValue,
        setShowTextInput: text.actions.setShowTextInput,
      });
      return;
    }

    const snappedPos = snap.actions.getSnappedPos(viewport.helpers.getPos(event));

    if (advancedShapes.actions.handlePointerDown(snappedPos)) {
      redrawAll();
      return;
    }

    startShapeStroke({
      pos: snappedPos,
      isDrawing,
      lastPos,
      currentStroke,
      socketRef,
      color,
      strokeWidth,
      tool,
    });
  }, [color, redrawAll, snap.actions, strokeWidth, text.actions, text.state.showTextInput, text.state.textValue, tool, viewport.helpers, viewport.refs]);

  const draw = useCallback((event) => {
    event.preventDefault();
    if (viewport.helpers.handleTouchGestureMove(event)) return;
    const pointer = viewport.helpers.getPointerClientPos(event);
    viewport.refs.pointerClientPosRef.current = pointer;
    viewport.helpers.updateAutoPanVelocity(pointer);

    if (isPanning.current) {
      updatePan({
        pointer,
        panState,
        setViewportOffset: viewport.actions.setViewportOffset,
      });
      return;
    }

    if (tool === 'select' && selectionDrag.current.active) {
      applySelectionDragAtPos(viewport.helpers.getPos(event), true);
      return;
    }

    if (viewport.helpers.isDirectTouchInput(event)) {
      snap.actions.clearPreview();
      viewport.helpers.stopAutoPan();
      return;
    }

    const rawPos = viewport.helpers.getPos(event);
    const shouldSnap = tool !== 'pen' && tool !== 'eraser' && tool !== 'select' && tool !== 'pan' && tool !== 'text';
    if (shouldSnap) {
      snap.actions.updatePreview(rawPos);
    } else {
      snap.actions.clearPreview();
    }
    const advancedPos = shouldSnap ? snap.actions.getSnappedPos(rawPos) : rawPos;
    const previewChanged = advancedShapes.actions.handlePointerMove(advancedPos);
    if (previewChanged) {
      redrawAll();
    }

    if (!isDrawing.current) {
      const pos = advancedPos;
      socketRef.current?.emit('cursor-move', { x: pos.x, y: pos.y, name: userProfile?.displayName });
      return;
    }

    if (tool === 'pen') {
      const nativeEvent = event.nativeEvent || event;
      const samples = typeof nativeEvent.getCoalescedEvents === 'function'
        ? nativeEvent.getCoalescedEvents()
        : [nativeEvent];
      const sampledPoints = samples
        .map((sample) => viewport.helpers.getWorldPosFromClient(sample.clientX, sample.clientY))
        .filter((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y));

      updatePenStroke({
        points: sampledPoints.length ? sampledPoints : [advancedPos],
        currentStroke,
        lastPos,
        redrawAll,
        getCtx,
        colorRef,
        strokeWidthRef,
        toolRef,
        socketRef,
        shouldEmit: true,
      });
      return;
    }

    applyPointerInteraction(pointer, true);
  }, [advancedShapes.actions, applyPointerInteraction, applySelectionDragAtPos, redrawAll, snap.actions, tool, userProfile?.displayName, viewport.actions, viewport.helpers, viewport.refs]);

  const stopDrawing = useCallback((event) => {
    if (viewport.helpers.handleTouchGestureEnd(event)) return;
    if ('pointerId' in event) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    viewport.refs.pointerClientPosRef.current = null;
    snap.actions.clearPreview();
    viewport.helpers.endAutoPanSession();

    if (stopPan({ isPanning })) return;

    if (tool === 'select') {
      stopSelection({ selectionDrag });
      return;
    }

    finishStroke({
      tool,
      color,
      strokeWidth,
      currentStroke,
      userUid: user?.uid,
      strokes,
      history,
      redrawAll,
      socketRef,
      isDrawing,
    });
  }, [color, redrawAll, snap.actions, strokeWidth, tool, user?.uid, viewport.helpers, viewport.refs]);

  return {
    constants: {
      tools: TOOLS,
      colors: COLORS,
      strokeWidths: STROKE_WIDTHS,
    },
    refs: {
      canvasRef,
      fileInputRef,
      toolbarRef,
    },
    state: {
      tool,
      color,
      strokeWidth,
      participants,
      connected,
      showTextInput: text.state.showTextInput,
      textPos: text.state.textPos,
      textValue: text.state.textValue,
      cursors,
      saved,
      viewportOffset: viewport.state.viewportOffset,
      zoom: viewport.state.zoom,
      theme: viewport.state.theme,
      activePalette: viewport.state.activePalette,
      snapEnabled: snap.state.snapEnabled,
      versions: versions.state.versions,
      historyOpen: versions.state.historyOpen,
    },
    derived: {
      isPanning: isPanning.current,
    },
    actions: {
      setTheme: viewport.actions.setTheme,
      setSnapEnabled: snap.actions.setSnapEnabled,
      setHistoryOpen: versions.actions.setHistoryOpen,
      setTextValue: text.actions.setTextValue,
      dismissTextInput: text.actions.dismissTextInput,
      handleAssetButtonClick: boardActions.handleAssetButtonClick,
      handleAssetUpload: boardActions.handleAssetUpload,
      handleClear: boardActions.handleClear,
      handleCopyLink: boardActions.handleCopyLink,
      handleExport: boardActions.handleExport,
      handleSave: boardActions.handleSave,
      handleToolSelect,
      handleTogglePalette: viewport.actions.handleTogglePalette,
      handleColorSelect,
      handleStrokeWidthSelect,
      handleUndo: boardActions.handleUndo,
      loadVersion: versions.actions.loadVersion,
      addText: text.actions.addText,
      startDrawing,
      draw,
      stopDrawing,
    },
  };
};
