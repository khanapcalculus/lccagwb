const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../firebase-admin');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Log activity helper
const logActivity = async (type, userId, metadata = {}) => {
  await db.collection('activities').add({
    type,
    userId,
    metadata,
    timestamp: new Date().toISOString(),
    createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
  });
};

// GET /api/sessions — list sessions by role
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = db.collection('sessions');
    const { role, uid } = req.user;

    if (role === 'tutor') {
      query = query.where('tutorId', '==', uid);
    } else if (role === 'student') {
      query = query.where('studentId', '==', uid);
    }
    // admin sees all

    const snap = await query.orderBy('scheduledAt', 'asc').get();
    const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions — create a session (tutor or admin)
router.post('/', verifyToken, requireRole('admin', 'tutor'), async (req, res) => {
  try {
    const { studentId, studentName, title, description, scheduledAt, durationMinutes } = req.body;
    if (!studentId || !scheduledAt || !title) {
      return res.status(400).json({ error: 'studentId, title, and scheduledAt are required' });
    }

    const roomId = uuidv4();
    const session = {
      tutorId: req.user.uid,
      tutorName: req.user.displayName || req.user.email,
      studentId,
      studentName: studentName || '',
      title,
      description: description || '',
      scheduledAt,
      durationMinutes: durationMinutes || 60,
      status: 'scheduled',
      whiteboardRoomId: roomId,
      whiteboardUrl: `/whiteboard/${roomId}`,
      createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('sessions').add(session);

    // Create whiteboard room
    await db.collection('whiteboards').doc(roomId).set({
      roomId,
      sessionId: ref.id,
      tutorId: req.user.uid,
      studentId,
      canvasData: null,
      participants: [],
      createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
    });

    await logActivity('session_created', req.user.uid, { sessionId: ref.id, title });
    res.status(201).json({ id: ref.id, ...session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:id — update session
router.put('/:id', verifyToken, requireRole('admin', 'tutor'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp() };
    await db.collection('sessions').doc(id).update(updates);
    await logActivity('session_updated', req.user.uid, { sessionId: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id — cancel/delete session
router.delete('/:id', verifyToken, requireRole('admin', 'tutor'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('sessions').doc(id).update({ status: 'cancelled' });
    await logActivity('session_cancelled', req.user.uid, { sessionId: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/complete — mark complete
router.post('/:id/complete', verifyToken, requireRole('admin', 'tutor'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('sessions').doc(id).update({ status: 'completed' });
    await logActivity('session_completed', req.user.uid, { sessionId: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
