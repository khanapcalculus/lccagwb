import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { io } from 'socket.io-client';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import './Whiteboard.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
GlobalWorkerOptions.workerSrc = pdfWorker;

const TOOLS = [
  { id: 'select', icon: '⬚', label: 'Select' },
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'eraser', icon: '⬜', label: 'Eraser' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'rect', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '◯', label: 'Circle' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'pan', icon: '✋', label: 'Pan' },
];

const COLORS = ['#00d4ff', '#ffffff', '#a78bfa', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#ec4899', '#000000'];
const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12, 18];

const WhiteboardPage = () => {
  const { roomId } = useParams();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

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
  const selectionDrag = useRef({ active: false, strokeId: null, origin: null, snapshot: null, lastDelta: { x: 0, y: 0 } });
  const viewportOffsetRef = useRef({ x: 0, y: 0 });
  const pointerClientPosRef = useRef(null);
  const autoPanRef = useRef({ rafId: null, lastTs: null, vx: 0, vy: 0 });
  const toolRef = useRef('pen');
  const colorRef = useRef('#00d4ff');
  const strokeWidthRef = useRef(2);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#00d4ff');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');
  const [cursors, setCursors] = useState({});
  const [saved, setSaved] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [theme, setTheme] = useState(() => localStorage.getItem('whiteboard-theme') || 'dark');
  const [selectedStrokeId, setSelectedStrokeId] = useState(null);
  const [activePalette, setActivePalette] = useState(null);

  // ── Canvas utils ──────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPointerClientPos = (e) => ({
    x: e.touches ? e.touches[0].clientX : e.clientX,
    y: e.touches ? e.touches[0].clientY : e.clientY,
  });

  const getInputType = (e) => {
    if ('pointerType' in e && e.pointerType) return e.pointerType;
    if ('touches' in e || 'changedTouches' in e) return 'touch';
    return 'mouse';
  };

  const isDirectTouchInput = (e) => getInputType(e) === 'touch';

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const { x: clientX, y: clientY } = getPointerClientPos(e);
    return {
      x: clientX - rect.left - viewportOffset.x,
      y: clientY - rect.top - viewportOffset.y,
    };
  };

  const getWorldPosFromClient = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left - viewportOffsetRef.current.x,
      y: clientY - rect.top - viewportOffsetRef.current.y,
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('whiteboard-theme', theme);
  }, [theme]);

  useEffect(() => {
    viewportOffsetRef.current = viewportOffset;
  }, [viewportOffset]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!toolbarRef.current?.contains(event.target)) {
        setActivePalette(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    setActivePalette(null);
  }, [tool]);

  const configureCtx = useCallback((ctx) => {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, viewportOffset.x * dpr, viewportOffset.y * dpr);
  }, [viewportOffset]);

  const applyStrokeStyle = (ctx, s) => {
    ctx.strokeStyle = s.color || '#00d4ff';
    ctx.lineWidth = s.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawSmoothPath = useCallback((ctx, points) => {
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
  }, []);

  const distanceToSegment = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
    const proj = { x: start.x + t * dx, y: start.y + t * dy };
    return Math.hypot(point.x - proj.x, point.y - proj.y);
  };

  const getStrokeBounds = useCallback((stroke) => {
    if (!stroke?.points?.length) return null;

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

    const xs = stroke.points.map((p) => p.x);
    const ys = stroke.points.map((p) => p.y);
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    };
  }, []);

  const translateStroke = useCallback((stroke, dx, dy) => ({
    ...stroke,
    points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }), []);

  const drawSelectionOutline = useCallback((ctx, stroke) => {
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
  }, [getStrokeBounds]);

  const doesStrokeHitPoint = useCallback((stroke, point) => {
    const tolerance = Math.max(10, (stroke.width || 4) * 2);
    if (!stroke?.points?.length) return false;

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      for (let i = 1; i < stroke.points.length; i += 1) {
        if (distanceToSegment(point, stroke.points[i - 1], stroke.points[i]) <= tolerance) return true;
      }
      return Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y) <= tolerance;
    }

    if (stroke.tool === 'line' && stroke.points.length >= 2) {
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

    return false;
  }, []);

  const drawStroke = useCallback((ctx, stroke) => {
    if (!stroke?.points?.length) return;
    applyStrokeStyle(ctx, stroke);

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      drawSmoothPath(ctx, stroke.points);
    } else if (stroke.tool === 'line' && stroke.points.length >= 2) {
      const [start, end] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    } else if (stroke.tool === 'rect' && stroke.points.length >= 2) {
      const [s, e] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      ctx.strokeRect(s.x, s.y, e.x - s.x, e.y - s.y);
    } else if (stroke.tool === 'circle' && stroke.points.length >= 2) {
      const [s, e] = [stroke.points[0], stroke.points[stroke.points.length - 1]];
      const rx = Math.abs(e.x - s.x) / 2, ry = Math.abs(e.y - s.y) / 2;
      ctx.beginPath(); ctx.ellipse(s.x + (e.x - s.x) / 2, s.y + (e.y - s.y) / 2, rx, ry, 0, 0, 2 * Math.PI); ctx.stroke();
    } else if (stroke.tool === 'text' && stroke.text) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = stroke.color;
      ctx.font = `${stroke.width * 4 + 12}px Inter, sans-serif`;
      ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
    } else if (stroke.tool === 'image' && stroke.src) {
      let img = imageCache.current.get(stroke.src);
      if (!img) {
        img = new Image();
        img.onload = () => redrawAllRef.current();
        img.src = stroke.src;
        imageCache.current.set(stroke.src, img);
      }
      if (img.complete) {
        ctx.drawImage(
          img,
          stroke.points[0].x,
          stroke.points[0].y,
          stroke.imageWidth || img.width,
          stroke.imageHeight || img.height
        );
      }
    }
  }, [drawSmoothPath]);

  const redrawAll = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    configureCtx(ctx);
    ctx.globalCompositeOperation = 'source-over';
    strokes.current.forEach(s => drawStroke(ctx, s));
    if (selectedStrokeId) {
      const selected = strokes.current.find((stroke) => stroke.id === selectedStrokeId);
      if (selected) drawSelectionOutline(ctx, selected);
    }
  }, [configureCtx, drawSelectionOutline, drawStroke, selectedStrokeId]);
  redrawAllRef.current = redrawAll;

  const appendStrokes = useCallback((newStrokes, socketEvent = 'add-shape') => {
    if (!newStrokes.length) return;
    strokes.current = [...strokes.current, ...newStrokes];
    history.current = [...history.current, ...newStrokes];
    redrawAll();
    newStrokes.forEach((stroke) => socketRef.current?.emit(socketEvent, stroke));
  }, [redrawAll]);

  const stopAutoPan = useCallback(() => {
    if (autoPanRef.current.rafId) {
      cancelAnimationFrame(autoPanRef.current.rafId);
    }
    autoPanRef.current = { rafId: null, lastTs: null, vx: 0, vy: 0 };
  }, []);

  useEffect(() => () => stopAutoPan(), [stopAutoPan]);

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
  }, [redrawAll, translateStroke]);

  const applyPointerInteraction = useCallback((clientPos, shouldEmit = true) => {
    if (!clientPos) return;
    const pos = getWorldPosFromClient(clientPos.x, clientPos.y);

    if (toolRef.current === 'select' && selectionDrag.current.active) {
      applySelectionDragAtPos(pos, shouldEmit);
      return;
    }

    if (!isDrawing.current) return;

    const ctx = getCtx();
    if (!ctx) return;

    if (toolRef.current === 'pen') {
      currentStroke.current.push(pos);
      lastPos.current = pos;
      redrawAll();
      applyStrokeStyle(ctx, { color: colorRef.current, width: strokeWidthRef.current, tool: toolRef.current });
      drawSmoothPath(ctx, currentStroke.current);
      if (shouldEmit) {
        socketRef.current?.emit('draw-move', {
          points: currentStroke.current.slice(-3),
          color: colorRef.current,
          width: strokeWidthRef.current,
          tool: toolRef.current,
        });
      }
      return;
    }

    redrawAll();
    const previewStroke = {
      tool: toolRef.current,
      color: colorRef.current,
      width: strokeWidthRef.current,
      points: [currentStroke.current[0], pos],
    };
    if (currentStroke.current.length === 1) currentStroke.current.push(pos);
    else currentStroke.current[currentStroke.current.length - 1] = pos;
    drawStroke(ctx, previewStroke);
  }, [applySelectionDragAtPos, drawSmoothPath, drawStroke, getWorldPosFromClient, redrawAll]);

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
    viewportOffsetRef.current = nextOffset;
    setViewportOffset(nextOffset);

    if (pointerClientPosRef.current) {
      applyPointerInteraction(pointerClientPosRef.current, true);
    }

    state.rafId = requestAnimationFrame(stepAutoPan);
  }, [applyPointerInteraction, stopAutoPan]);

  const updateAutoPanVelocity = useCallback((clientPos) => {
    const canvas = canvasRef.current;
    if (!canvas || toolRef.current === 'pan') {
      stopAutoPan();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const threshold = 72;
    const maxSpeed = 220;
    let vx = 0;
    let vy = 0;

    if (clientPos.x - rect.left < threshold) {
      const intensity = (threshold - (clientPos.x - rect.left)) / threshold;
      vx = maxSpeed * intensity * intensity;
    } else if (rect.right - clientPos.x < threshold) {
      const intensity = (threshold - (rect.right - clientPos.x)) / threshold;
      vx = -maxSpeed * intensity * intensity;
    }

    if (clientPos.y - rect.top < threshold) {
      const intensity = (threshold - (clientPos.y - rect.top)) / threshold;
      vy = maxSpeed * intensity * intensity;
    } else if (rect.bottom - clientPos.y < threshold) {
      const intensity = (threshold - (rect.bottom - clientPos.y)) / threshold;
      vy = -maxSpeed * intensity * intensity;
    }

    autoPanRef.current.vx = vx;
    autoPanRef.current.vy = vy;

    if ((vx || vy) && !autoPanRef.current.rafId) {
      autoPanRef.current.lastTs = null;
      autoPanRef.current.rafId = requestAnimationFrame(stepAutoPan);
    } else if (!vx && !vy) {
      stopAutoPan();
    }
  }, [stepAutoPan, stopAutoPan]);

  // ── Resize canvas ─────────────────────────────────────────────
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
  }, [redrawAll]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll, viewportOffset]);

  // ── Socket.io connection ──────────────────────────────────────
  useEffect(() => {
    if (!user || !roomId) return;

    const socket = io(`${SERVER_URL}/whiteboard`, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-room', { roomId, user: { uid: user.uid, displayName: userProfile?.displayName || user.email } });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('room-state', ({ strokes: savedStrokes, participants: p }) => {
      strokes.current = savedStrokes || [];
      history.current = savedStrokes || [];
      setParticipants(p || []);
      redrawAll();
    });

    socket.on('user-joined', ({ participants: p }) => setParticipants(p || []));
    socket.on('user-left', ({ participants: p }) => setParticipants(p || []));

    socket.on('draw-move', ({ points, color: c, width: w, tool: t }) => {
      const ctx = getCtx();
      if (!ctx || points.length < 2) return;
      applyStrokeStyle(ctx, { color: c, width: w, tool: t });
      ctx.beginPath();
      ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    });

    socket.on('draw-end', ({ stroke }) => {
      if (stroke) {
        strokes.current.push(stroke);
        history.current.push(stroke);
      }
    });

    socket.on('add-text', (stroke) => {
      strokes.current.push(stroke);
      history.current.push(stroke);
      redrawAll();
    });

    socket.on('add-shape', (stroke) => {
      strokes.current.push(stroke);
      history.current.push(stroke);
      redrawAll();
    });

    socket.on('canvas-cleared', () => {
      strokes.current = [];
      history.current = [];
      setSelectedStrokeId(null);
      const ctx = getCtx();
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    socket.on('canvas-redraw', ({ strokes: newStrokes }) => {
      strokes.current = newStrokes;
      history.current = newStrokes;
      redrawAll();
    });

    socket.on('stroke-moved', ({ strokeId, dx, dy }) => {
      if (!strokeId || (!dx && !dy)) return;
      strokes.current = strokes.current.map((stroke) => (
        stroke.id === strokeId ? translateStroke(stroke, dx, dy) : stroke
      ));
      history.current = strokes.current;
      redrawAll();
    });

    socket.on('cursor-move', ({ socketId, x, y, name }) => {
      setCursors(prev => ({ ...prev, [socketId]: { x, y, name } }));
    });

    socket.on('save-success', () => { setSaved(true); setTimeout(() => setSaved(false), 2000); });

    // Load Firestore room info
    const unsub = onSnapshot(doc(db, 'whiteboards', roomId), snap => {
      if (snap.exists()) setRoomInfo(snap.data());
    });

    return () => { socket.disconnect(); unsub(); };
  }, [user, roomId, redrawAll, drawStroke]);

  // ── Drawing handlers ──────────────────────────────────────────
  const startDrawing = (e) => {
    e.preventDefault();
    if (isDirectTouchInput(e) && tool !== 'pan') return;
    if ('pointerId' in e) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    pointerClientPosRef.current = getPointerClientPos(e);
    updateAutoPanVelocity(pointerClientPosRef.current);
    if (tool === 'pan') {
      isPanning.current = true;
      panState.current = {
        pointer: getPointerClientPos(e),
        offset: viewportOffset,
      };
      return;
    }
    if (tool === 'select') {
      const pos = getPos(e);
      const hitStroke = [...strokes.current].reverse().find((stroke) => doesStrokeHitPoint(stroke, pos));
      setSelectedStrokeId(hitStroke?.id || null);
      if (hitStroke) {
        selectionDrag.current = {
          active: true,
          strokeId: hitStroke.id,
          origin: pos,
          snapshot: hitStroke,
          lastDelta: { x: 0, y: 0 },
        };
      } else {
        selectionDrag.current = { active: false, strokeId: null, origin: null, snapshot: null, lastDelta: { x: 0, y: 0 } };
      }
      redrawAll();
      return;
    }
    if (tool === 'eraser') {
      const pos = getPos(e);
      const hitStroke = [...strokes.current].reverse().find(stroke => doesStrokeHitPoint(stroke, pos));
      if (hitStroke) {
        const nextStrokes = strokes.current.filter(stroke => stroke.id !== hitStroke.id);
        strokes.current = nextStrokes;
        history.current = nextStrokes;
        redrawAll();
        socketRef.current?.emit('delete-stroke', { strokeId: hitStroke.id });
      }
      return;
    }
    if (tool === 'text') {
      if (showTextInput && textValue.trim()) {
        addText();
      }
      const pos = getPos(e);
      setTextPos(pos);
      setTextValue('');
      setShowTextInput(true);
      return;
    }
    isDrawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    currentStroke.current = [pos];
    socketRef.current?.emit('draw-start', { x: pos.x, y: pos.y, color, width: strokeWidth, tool });
  };

  const draw = (e) => {
    e.preventDefault();
    const pointer = getPointerClientPos(e);
    pointerClientPosRef.current = pointer;
    updateAutoPanVelocity(pointer);
    if (isPanning.current) {
      setViewportOffset({
        x: panState.current.offset.x + (pointer.x - panState.current.pointer.x),
        y: panState.current.offset.y + (pointer.y - panState.current.pointer.y),
      });
      return;
    }
    if (tool === 'select' && selectionDrag.current.active) {
      applySelectionDragAtPos(getPos(e), true);
      return;
    }
    if (isDirectTouchInput(e)) {
      stopAutoPan();
      return;
    }
    if (!isDrawing.current) {
      // Send cursor position
      const pos = getPos(e);
      socketRef.current?.emit('cursor-move', { x: pos.x, y: pos.y, name: userProfile?.displayName });
      return;
    }
    applyPointerInteraction(pointer, true);
  };

  const stopDrawing = (e) => {
    if ('pointerId' in e) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    pointerClientPosRef.current = null;
    stopAutoPan();
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
    if (tool === 'select') {
      selectionDrag.current = { active: false, strokeId: null, origin: null, snapshot: null, lastDelta: { x: 0, y: 0 } };
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const stroke = { tool, color, width: strokeWidth, points: currentStroke.current, uid: user.uid, id: Date.now() };

    if (tool === 'pen' || tool === 'eraser') {
      strokes.current.push(stroke);
      history.current.push(stroke);
      socketRef.current?.emit('draw-end', { stroke });
    } else {
      strokes.current.push(stroke);
      history.current.push(stroke);
      redrawAll();
      socketRef.current?.emit('add-shape', stroke);
    }
    currentStroke.current = [];
  };

  const addText = useCallback(() => {
    if (!textValue.trim()) { setShowTextInput(false); return; }
    const stroke = { tool: 'text', color, width: strokeWidth, points: [textPos], text: textValue, uid: user.uid, id: Date.now() };
    strokes.current.push(stroke);
    history.current.push(stroke);
    redrawAll();
    socketRef.current?.emit('add-text', stroke);
    setTextValue('');
    setShowTextInput(false);
  }, [color, redrawAll, roomId, strokeWidth, textPos, textValue, user.uid]);

  const handleUndo = () => {
    if (!history.current.length) return;
    history.current.pop();
    strokes.current = [...history.current];
    redrawAll();
    socketRef.current?.emit('undo', { uid: user.uid });
  };

  const handleClear = () => {
    if (!confirm('Clear the entire whiteboard?')) return;
    strokes.current = [];
    history.current = [];
    getCtx()?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socketRef.current?.emit('clear-canvas');
  };

  const handleSave = () => {
    socketRef.current?.emit('save-canvas', { canvasData: strokes.current });
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const handleAssetButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleToolSelect = (nextTool) => {
    setTool(nextTool);
    setActivePalette(null);
  };

  const handleColorSelect = (nextColor) => {
    setColor(nextColor);
    setActivePalette(null);
  };

  const handleStrokeWidthSelect = (nextWidth) => {
    setStrokeWidth(nextWidth);
    setActivePalette(null);
  };

  const createImageStroke = useCallback((src, imageWidth, imageHeight, x, y, idSeed) => ({
    tool: 'image',
    src,
    imageWidth,
    imageHeight,
    points: [{ x, y }],
    uid: user.uid,
    id: idSeed,
  }), [user.uid]);

  const handleAssetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = canvasRef.current;
    const viewportWidth = canvas?.getBoundingClientRect().width || 800;
    const viewportHeight = canvas?.getBoundingClientRect().height || 600;
    const centerX = viewportWidth / 2 - viewportOffset.x;
    const startY = 48 - viewportOffset.y;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const bytes = await file.arrayBuffer();
      const pdf = await getDocument({ data: bytes }).promise;

      if (pdf.numPages > 10) {
        window.alert('PDF upload is limited to 10 pages.');
        e.target.value = '';
        return;
      }

      const strokesToAdd = [];
      let currentY = startY;
      const baseId = Date.now();

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const rawViewport = page.getViewport({ scale: 1 });
        const targetScale = Math.min((viewportWidth * 0.72) / rawViewport.width, (viewportHeight * 0.78) / rawViewport.height, 1.4);
        const pageViewport = page.getViewport({ scale: targetScale });
        const renderCanvas = document.createElement('canvas');
        const renderCtx = renderCanvas.getContext('2d');
        renderCanvas.width = pageViewport.width;
        renderCanvas.height = pageViewport.height;
        await page.render({ canvasContext: renderCtx, viewport: pageViewport }).promise;
        const src = renderCanvas.toDataURL('image/png');
        strokesToAdd.push(createImageStroke(
          src,
          pageViewport.width,
          pageViewport.height,
          centerX - pageViewport.width / 2,
          currentY,
          baseId + pageNumber
        ));
        currentY += pageViewport.height + 28;
      }

      appendStrokes(strokesToAdd);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const maxWidth = Math.min(420, viewportWidth * 0.6);
        const maxHeight = Math.min(320, viewportHeight * 0.6);
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const imageWidth = img.width * scale;
        const imageHeight = img.height * scale;
        imageCache.current.set(src, img);
        appendStrokes([
          createImageStroke(
            src,
            imageWidth,
            imageHeight,
            centerX - imageWidth / 2,
            viewportHeight / 2 - imageHeight / 2 - viewportOffset.y,
            Date.now()
          ),
        ]);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={`wb-container ${theme === 'light' ? 'light' : 'dark'}`}>
      {/* Top Bar */}
      <div className="wb-topbar">
        <div className="wb-topbar-left">
          <button className="wb-back-btn" onClick={() => navigate(-1)}>← Back</button>
          <div className="wb-room-info">
            <div className="wb-room-icon">🖊️</div>
            <div>
              <div className="wb-room-title">Whiteboard Session</div>
              <div className="wb-room-id">Room: {roomId?.slice(0, 8)}…</div>
            </div>
          </div>
        </div>

        <div className="wb-topbar-center">
          <div className={`wb-connection ${connected ? 'connected' : 'disconnected'}`}>
            <span className="wb-dot" />{connected ? 'Live' : 'Connecting…'}
          </div>
          {saved && <div className="wb-saved">✓ Saved</div>}
        </div>

        <div className="wb-topbar-right">
          <div className="wb-participants">
            {participants.slice(0, 4).map((p, i) => (
              <div key={p.uid} className="wb-avatar" title={p.name} style={{ zIndex: 10 - i }}>
                {p.name?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
            {participants.length > 4 && <div className="wb-avatar wb-avatar-more">+{participants.length - 4}</div>}
          </div>
          <button className="wb-action-btn" onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="wb-action-btn" onClick={handleAssetButtonClick} title="Upload image or PDF">📄</button>
          <button className="wb-action-btn danger" onClick={handleClear} title="Clear canvas">🗑</button>
          <button className="wb-action-btn" onClick={handleCopyLink} title="Copy link">🔗</button>
          <button className="wb-action-btn" onClick={handleSave} title="Save to cloud">💾</button>
          <button className="wb-action-btn" onClick={handleExport} title="Export PNG">⬇️</button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" style={{ display: 'none' }} onChange={handleAssetUpload} />
        </div>
      </div>

      {/* Main Area */}
      <div className="wb-main">
        {/* Canvas */}
        <div className="wb-canvas-wrap">
          <div className="wb-toolbar" ref={toolbarRef}>
            <div className="wb-tool-group">
              {TOOLS.map(t => (
                <button
                  key={t.id}
                  className={`wb-tool-btn ${tool === t.id ? 'active' : ''}`}
                  onClick={() => handleToolSelect(t.id)}
                  title={t.label}
                >
                  <span>{t.icon}</span>
                </button>
              ))}
              <div className="wb-toolbar-anchor">
                <button
                  className={`wb-tool-btn ${activePalette === 'color' ? 'active' : ''}`}
                  onClick={() => setActivePalette(prev => prev === 'color' ? null : 'color')}
                  title="Colors"
                >
                  <span className="wb-tool-swatch" style={{ background: color }} />
                </button>
                {activePalette === 'color' && (
                  <div className="wb-toolbar-popover">
                    <div className="wb-color-grid">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          className={`wb-color-btn ${color === c ? 'active' : ''}`}
                          style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
                          onClick={() => handleColorSelect(c)}
                          title={c}
                        />
                      ))}
                      <input
                        type="color"
                        className="wb-color-picker"
                        value={color}
                        onChange={e => handleColorSelect(e.target.value)}
                        title="Custom color"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="wb-toolbar-anchor">
                <button
                  className={`wb-tool-btn ${activePalette === 'size' ? 'active' : ''}`}
                  onClick={() => setActivePalette(prev => prev === 'size' ? null : 'size')}
                  title="Stroke size"
                >
                  <span className="wb-tool-size-dot" style={{ width: Math.min(Math.max(strokeWidth * 2, 4), 18), height: Math.min(Math.max(strokeWidth * 2, 4), 18), background: color }} />
                </button>
                {activePalette === 'size' && (
                  <div className="wb-toolbar-popover">
                    <div className="wb-width-grid">
                      {STROKE_WIDTHS.map(w => (
                        <button
                          key={w}
                          className={`wb-width-btn ${strokeWidth === w ? 'active' : ''}`}
                          onClick={() => handleStrokeWidthSelect(w)}
                          title={`${w}px`}
                        >
                          <div className="wb-width-dot" style={{ width: Math.min(Math.max(w * 2, 4), 18), height: Math.min(Math.max(w * 2, 4), 18), background: color }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button className="wb-action-tool" onClick={() => { handleUndo(); setActivePalette(null); }} title="Undo">↩</button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="wb-canvas"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
            onPointerCancel={stopDrawing}
            style={{ cursor: tool === 'pan' ? (isPanning.current ? 'grabbing' : 'grab') : tool === 'select' ? 'default' : tool === 'eraser' ? 'not-allowed' : tool === 'text' ? 'text' : 'crosshair' }}
          />

          {/* Live Cursors */}
          {Object.entries(cursors).map(([id, c]) => (
            <div key={id} className="wb-cursor" style={{ left: c.x + viewportOffset.x, top: c.y + viewportOffset.y }}>
              <div className="wb-cursor-dot" />
              <div className="wb-cursor-name">{c.name}</div>
            </div>
          ))}

          {/* Text Input Overlay */}
          {showTextInput && (
            <div className="wb-text-input-wrap" style={{ left: textPos.x + viewportOffset.x, top: textPos.y + viewportOffset.y }}>
              <input
                autoFocus
                className="wb-text-input"
                placeholder="Type here…"
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onBlur={addText}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addText();
                  }
                  if (e.key === 'Escape') {
                    setTextValue('');
                    setShowTextInput(false);
                  }
                }}
                style={{ color, fontSize: `${strokeWidth * 4 + 12}px` }}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default WhiteboardPage;
