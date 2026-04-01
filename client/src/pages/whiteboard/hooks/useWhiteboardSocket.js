import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../config';
import { drawSmoothPath } from '../utils/strokeUtils';

export const useWhiteboardSocket = ({
  roomId,
  user,
  userProfile,
  setConnected,
  setParticipants,
  setCursors,
  setSaved,
  setSelectedStrokeId,
  strokesRef,
  historyRef,
  socketRef,
  canvasRef,
  redrawAllRef,
  getCtx,
  applyStrokeStyle,
  translateStroke,
}) => {
  useEffect(() => {
    if (!user || !roomId) return undefined;

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
      socket.emit('join-room', {
        roomId,
        user: { uid: user.uid, displayName: userProfile?.displayName || user.email },
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setCursors({});
    });

    socket.on('room-state', ({ strokes: savedStrokes, participants }) => {
      strokesRef.current = savedStrokes || [];
      historyRef.current = savedStrokes || [];
      setParticipants(participants || []);
      setCursors({});
      setSelectedStrokeId(null);
      redrawAllRef.current();
    });

    socket.on('user-joined', ({ participants }) => setParticipants(participants || []));

    socket.on('user-left', ({ participants, socketId }) => {
      setParticipants(participants || []);
      if (socketId) {
        setCursors((prev) => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      }
    });

    socket.on('draw-move', ({ points, color, width, tool }) => {
      const ctx = getCtx();
      if (!ctx || !points?.length) return;
      applyStrokeStyle(ctx, { color, width, tool });
      drawSmoothPath(ctx, points);
    });

    socket.on('draw-end', ({ stroke }) => {
      if (stroke) {
        strokesRef.current.push(stroke);
        historyRef.current.push(stroke);
      }
    });

    socket.on('add-text', (stroke) => {
      strokesRef.current.push(stroke);
      historyRef.current.push(stroke);
      redrawAllRef.current();
    });

    socket.on('add-shape', (stroke) => {
      strokesRef.current.push(stroke);
      historyRef.current.push(stroke);
      redrawAllRef.current();
    });

    socket.on('canvas-cleared', () => {
      strokesRef.current = [];
      historyRef.current = [];
      setSelectedStrokeId(null);
      const ctx = getCtx();
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    socket.on('canvas-redraw', ({ strokes }) => {
      strokesRef.current = strokes;
      historyRef.current = strokes;
      redrawAllRef.current();
    });

    socket.on('stroke-moved', ({ strokeId, dx, dy }) => {
      if (!strokeId || (!dx && !dy)) return;
      strokesRef.current = strokesRef.current.map((stroke) => (
        stroke.id === strokeId ? translateStroke(stroke, dx, dy) : stroke
      ));
      historyRef.current = strokesRef.current;
      redrawAllRef.current();
    });

    socket.on('cursor-move', ({ socketId, uid, x, y, name }) => {
      setCursors((prev) => {
        const next = { ...prev };
        if (uid) {
          Object.entries(next).forEach(([id, cursor]) => {
            if (cursor.uid === uid && id !== socketId) delete next[id];
          });
        }
        next[socketId] = { x, y, name, uid };
        return next;
      });
    });

    socket.on('save-success', () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

    return () => {
      socket.disconnect();
    };
  }, [
    roomId,
    user,
    user?.email,
    userProfile?.displayName,
    setConnected,
    setCursors,
    setParticipants,
    setSaved,
    setSelectedStrokeId,
    strokesRef,
    historyRef,
    socketRef,
    canvasRef,
    redrawAllRef,
    getCtx,
    applyStrokeStyle,
    translateStroke,
  ]);
};
