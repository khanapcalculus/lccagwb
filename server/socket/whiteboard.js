const { db } = require('../firebase-admin');

const rooms = new Map(); // roomId -> { participants, strokes }
const MAX_STROKES = 500;
const translateStroke = (stroke, dx, dy) => ({
  ...stroke,
  points: stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
});

module.exports = (io) => {
  const whiteboard = io.of('/whiteboard');

  whiteboard.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;

    // Join a whiteboard room
    socket.on('join-room', async ({ roomId, user }) => {
      currentRoom = roomId;
      currentUser = user;
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { participants: [], strokes: [] });
        // Load saved canvas from Firestore
        try {
          const doc = await db.collection('whiteboards').doc(roomId).get();
          if (doc.exists && doc.data().canvasData) {
            rooms.get(roomId).strokes = doc.data().canvasData || [];
          }
        } catch (e) { /* ignore */ }
      }

      const room = rooms.get(roomId);
      const participant = { uid: user.uid, name: user.displayName, socketId: socket.id };
      room.participants = room.participants.filter(p => p.uid !== user.uid);
      room.participants.push(participant);

      // Update Firestore participants
      db.collection('whiteboards').doc(roomId).update({
        participants: room.participants.map(p => ({ uid: p.uid, name: p.name })),
      }).catch(() => {});

      // Send current state to new joiner
      socket.emit('room-state', {
        strokes: room.strokes,
        participants: room.participants,
      });

      // Notify others
      socket.to(roomId).emit('user-joined', { participant, participants: room.participants });
      console.log(`User ${user.displayName} joined room ${roomId}`);
    });

    // Drawing events — broadcast to all in room EXCEPT sender
    socket.on('draw-start', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('draw-start', data);
    });

    socket.on('draw-move', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('draw-move', data);
    });

    socket.on('draw-end', (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room && data.stroke) {
        room.strokes.push(data.stroke);
        // Keep last 500 strokes in memory
        if (room.strokes.length > MAX_STROKES) room.strokes = room.strokes.slice(-MAX_STROKES);
      }
      socket.to(currentRoom).emit('draw-end', data);
    });

    // Clear canvas
    socket.on('clear-canvas', () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) room.strokes = [];
      db.collection('whiteboards').doc(currentRoom).update({ canvasData: [] }).catch(() => {});
      whiteboard.to(currentRoom).emit('canvas-cleared');
    });

    // Add text
    socket.on('add-text', (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room && data) {
        room.strokes.push(data);
        if (room.strokes.length > MAX_STROKES) room.strokes = room.strokes.slice(-MAX_STROKES);
      }
      socket.to(currentRoom).emit('add-text', data);
    });

    // Add shape
    socket.on('add-shape', (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room && data) {
        room.strokes.push(data);
        if (room.strokes.length > MAX_STROKES) room.strokes = room.strokes.slice(-MAX_STROKES);
      }
      socket.to(currentRoom).emit('add-shape', data);
    });

    // Undo last stroke
    socket.on('undo', ({ uid }) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        // Remove last stroke by this user
        const idx = [...room.strokes].reverse().findIndex(s => s.uid === uid);
        if (idx !== -1) {
          room.strokes.splice(room.strokes.length - 1 - idx, 1);
        }
        whiteboard.to(currentRoom).emit('canvas-redraw', { strokes: room.strokes });
      }
    });

    socket.on('delete-stroke', ({ strokeId }) => {
      if (!currentRoom || !strokeId) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.strokes = room.strokes.filter(stroke => stroke.id !== strokeId);
        whiteboard.to(currentRoom).emit('canvas-redraw', { strokes: room.strokes });
      }
    });

    socket.on('move-stroke', ({ strokeId, dx, dy }) => {
      if (!currentRoom || !strokeId || (!dx && !dy)) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.strokes = room.strokes.map((existing) => (
          existing.id === strokeId ? translateStroke(existing, dx, dy) : existing
        ));
        socket.to(currentRoom).emit('stroke-moved', { strokeId, dx, dy });
      }
    });

    // Save canvas to Firestore
    socket.on('save-canvas', async ({ canvasData }) => {
      if (!currentRoom) return;
      try {
        await db.collection('whiteboards').doc(currentRoom).update({ canvasData, lastSaved: new Date() });
        socket.emit('save-success');
      } catch (e) {
        socket.emit('save-error', { message: e.message });
      }
    });

    // Cursor position (for live cursor tracking)
    socket.on('cursor-move', (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit('cursor-move', { ...data, socketId: socket.id });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (!currentRoom || !currentUser) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.participants = room.participants.filter(p => p.socketId !== socket.id);
        whiteboard.to(currentRoom).emit('user-left', {
          uid: currentUser.uid,
          participants: room.participants,
        });
        if (room.participants.length === 0) {
          // Persist and clean up room after 5 minutes of inactivity
          setTimeout(() => {
            if (rooms.get(currentRoom)?.participants.length === 0) {
              rooms.delete(currentRoom);
            }
          }, 300000);
        }
      }
      console.log(`User ${currentUser.displayName} left room ${currentRoom}`);
    });
  });
};
