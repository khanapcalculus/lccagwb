const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../firebase-admin');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const getWhiteboardByRoomId = async (roomId) => {
  const canonical = await db.collection('whiteboards').doc(roomId).get();
  if (canonical.exists) return canonical;

  const fallback = await db.collection('whiteboards').where('roomId', '==', roomId).limit(1).get();
  if (fallback.empty) return null;

  const legacyDoc = fallback.docs[0];
  await db.collection('whiteboards').doc(roomId).set({
    ...legacyDoc.data(),
    roomId,
    migratedFrom: legacyDoc.id,
    updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return db.collection('whiteboards').doc(roomId).get();
};

// GET /api/whiteboard/:roomId — get whiteboard state
router.get('/:roomId', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const doc = await getWhiteboardByRoomId(roomId);
    if (!doc || !doc.exists) return res.status(404).json({ error: 'Whiteboard not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whiteboard/generate — standalone whiteboard (no session)
router.post('/generate', verifyToken, async (req, res) => {
  try {
    const roomId = uuidv4();
    await db.collection('whiteboards').doc(roomId).set({
      roomId,
      sessionId: null,
      createdBy: req.user.uid,
      canvasData: null,
      participants: [],
      createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ roomId, url: `/whiteboard/${roomId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whiteboard/:roomId/save — save canvas snapshot
router.post('/:roomId/save', verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { canvasData } = req.body;
    await db.collection('whiteboards').doc(roomId).set({
      roomId,
      canvasData,
      strokeCount: canvasData?.length || 0,
      lastSaved: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
      updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
