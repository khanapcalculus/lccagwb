import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { io } from 'socket.io-client';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import './Whiteboard.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const TOOLS = [
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'eraser', icon: '⬜', label: 'Eraser' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'rect', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '◯', label: 'Circle' },
  { id: 'text', icon: 'T', label: 'Text' },
];

const COLORS = ['#00d4ff', '#ffffff', '#a78bfa', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#ec4899', '#000000'];
const STROKE_WIDTHS = [2, 4, 8, 14, 22];

const WhiteboardPage = () => {
  const { roomId } = useParams();
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const socketRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const currentStroke = useRef([]);
  const strokes = useRef([]);
  const history = useRef([]);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#00d4ff');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');
  const [cursors, setCursors] = useState({});
  const [saved, setSaved] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);

  // ── Canvas utils ──────────────────────────────────────────────
  const getCtx = () => canvasRef.current?.getContext('2d');

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const applyStrokeStyle = (ctx, s) => {
    ctx.strokeStyle = s.color || '#00d4ff';
    ctx.lineWidth = s.width || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  };

  const drawStroke = useCallback((ctx, stroke) => {
    if (!stroke?.points?.length) return;
    applyStrokeStyle(ctx, stroke);

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
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
    }
  }, []);

  const redrawAll = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    strokes.current.forEach(s => drawStroke(ctx, s));
  }, [drawStroke]);

  // ── Resize canvas ─────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      redrawAll();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redrawAll]);

  // ── Socket.io connection ──────────────────────────────────────
  useEffect(() => {
    if (!user || !roomId) return;

    const socket = io(`${SERVER_URL}/whiteboard`, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-room', { roomId, user: { uid: user.uid, displayName: userProfile?.displayName || user.email } });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('room-state', ({ strokes: savedStrokes, participants: p }) => {
      strokes.current = savedStrokes || [];
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
      if (stroke) { strokes.current.push(stroke); history.current.push(stroke); }
    });

    socket.on('add-text', (stroke) => {
      strokes.current.push(stroke);
      drawStroke(getCtx(), stroke);
    });

    socket.on('add-shape', (stroke) => {
      strokes.current.push(stroke);
      redrawAll();
    });

    socket.on('canvas-cleared', () => {
      strokes.current = [];
      history.current = [];
      const ctx = getCtx();
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    socket.on('canvas-redraw', ({ strokes: newStrokes }) => {
      strokes.current = newStrokes;
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
    if (tool === 'text') {
      const pos = getPos(e);
      setTextPos(pos);
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
    if (!isDrawing.current) {
      // Send cursor position
      const pos = getPos(e);
      socketRef.current?.emit('cursor-move', { x: pos.x, y: pos.y, name: userProfile?.displayName });
      return;
    }
    const pos = getPos(e);
    const ctx = getCtx();

    if (tool === 'pen' || tool === 'eraser') {
      applyStrokeStyle(ctx, { color, width: strokeWidth, tool });
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // For shapes: clear and redraw all, then draw preview
      redrawAll();
      const previewStroke = { tool, color, width: strokeWidth, points: [currentStroke.current[0], pos] };
      drawStroke(ctx, previewStroke);
    }

    currentStroke.current.push(pos);
    lastPos.current = pos;
    socketRef.current?.emit('draw-move', { points: currentStroke.current.slice(-2), color, width: strokeWidth, tool });
  };

  const stopDrawing = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const stroke = { tool, color, width: strokeWidth, points: currentStroke.current, uid: user.uid, id: Date.now() };

    if (tool === 'pen' || tool === 'eraser') {
      strokes.current.push(stroke);
      history.current.push(stroke);
      socketRef.current?.emit('draw-end', { stroke });
    } else {
      strokes.current.push(stroke);
      redrawAll();
      socketRef.current?.emit('add-shape', stroke);
    }
    currentStroke.current = [];
  };

  const addText = () => {
    if (!textValue.trim()) { setShowTextInput(false); return; }
    const stroke = { tool: 'text', color, width: strokeWidth, points: [textPos], text: textValue, uid: user.uid, id: Date.now() };
    strokes.current.push(stroke);
    drawStroke(getCtx(), stroke);
    socketRef.current?.emit('add-text', stroke);
    setTextValue('');
    setShowTextInput(false);
  };

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

  return (
    <div className="wb-container">
      {/* Top Bar */}
      <div className="wb-topbar">
        <div className="wb-topbar-left">
          <button className="wb-back-btn" onClick={() => navigate(-1)}>← Back</button>
          <div className="wb-room-info">
            <div className="wb-room-icon">🖊️</div>
            <div>
              <div className="wb-room-title">{roomInfo ? 'Whiteboard Session' : 'Loading…'}</div>
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
          <button className="wb-action-btn" onClick={handleCopyLink} title="Copy link">🔗</button>
          <button className="wb-action-btn" onClick={handleSave} title="Save to cloud">💾</button>
          <button className="wb-action-btn" onClick={handleExport} title="Export PNG">⬇️</button>
        </div>
      </div>

      {/* Main Area */}
      <div className="wb-main">
        {/* Toolbar */}
        <div className={`wb-toolbar ${toolbarCollapsed ? 'collapsed' : ''}`}>
          <button className="wb-toolbar-toggle" onClick={() => setToolbarCollapsed(!toolbarCollapsed)} title="Toggle toolbar">
            {toolbarCollapsed ? '›' : '‹'}
          </button>

          {!toolbarCollapsed && (
            <>
              {/* Tools */}
              <div className="wb-section-label">Tools</div>
              <div className="wb-tool-group">
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    className={`wb-tool-btn ${tool === t.id ? 'active' : ''}`}
                    onClick={() => setTool(t.id)}
                    title={t.label}
                  >
                    <span>{t.icon}</span>
                    <span className="wb-tool-label">{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="wb-divider" />

              {/* Colors */}
              <div className="wb-section-label">Color</div>
              <div className="wb-color-grid">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`wb-color-btn ${color === c ? 'active' : ''}`}
                    style={{ background: c, borderColor: c === color ? '#fff' : 'transparent' }}
                    onClick={() => setColor(c)}
                    title={c}
                  />
                ))}
                <input type="color" className="wb-color-picker" value={color} onChange={e => setColor(e.target.value)} title="Custom color" />
              </div>

              <div className="wb-divider" />

              {/* Stroke Width */}
              <div className="wb-section-label">Size</div>
              <div className="wb-width-group">
                {STROKE_WIDTHS.map(w => (
                  <button
                    key={w}
                    className={`wb-width-btn ${strokeWidth === w ? 'active' : ''}`}
                    onClick={() => setStrokeWidth(w)}
                    title={`${w}px`}
                  >
                    <div className="wb-width-dot" style={{ width: Math.min(w, 20), height: Math.min(w, 20), background: color }} />
                  </button>
                ))}
              </div>

              <div className="wb-divider" />

              {/* Actions */}
              <div className="wb-section-label">Actions</div>
              <div className="wb-action-group">
                <button className="wb-action-tool" onClick={handleUndo} title="Undo">↩ Undo</button>
                <button className="wb-action-tool danger" onClick={handleClear} title="Clear all">🗑 Clear</button>
              </div>
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="wb-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="wb-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair' }}
          />

          {/* Live Cursors */}
          {Object.entries(cursors).map(([id, c]) => (
            <div key={id} className="wb-cursor" style={{ left: c.x, top: c.y }}>
              <div className="wb-cursor-dot" />
              <div className="wb-cursor-name">{c.name}</div>
            </div>
          ))}

          {/* Text Input Overlay */}
          {showTextInput && (
            <div className="wb-text-input-wrap" style={{ left: textPos.x, top: textPos.y }}>
              <input
                autoFocus
                className="wb-text-input"
                placeholder="Type here…"
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addText(); if (e.key === 'Escape') setShowTextInput(false); }}
                style={{ color, fontSize: `${strokeWidth * 4 + 12}px` }}
              />
            </div>
          )}
        </div>

        {/* Participants Panel */}
        <div className="wb-participants-panel">
          <div className="wb-panel-title">👥 In Room ({participants.length})</div>
          {participants.map(p => (
            <div key={p.uid} className="wb-participant">
              <div className="wb-p-avatar">{p.name?.[0]?.toUpperCase() || '?'}</div>
              <span>{p.name}</span>
              {p.uid === user?.uid && <span className="wb-you-badge">You</span>}
            </div>
          ))}
          {!participants.length && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Connecting…</p>}
        </div>
      </div>
    </div>
  );
};

export default WhiteboardPage;
