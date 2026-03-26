const express = require('express');
const { db } = require('../firebase-admin');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// GET /api/analytics/overview — admin overview stats
router.get('/overview', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [usersSnap, sessionsSnap, whiteboardsSnap, activitiesSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('sessions').get(),
      db.collection('whiteboards').get(),
      db.collection('activities').orderBy('createdAt', 'desc').limit(20).get(),
    ]);

    const users = usersSnap.docs.map(d => d.data());
    const sessions = sessionsSnap.docs.map(d => d.data());

    const stats = {
      totalUsers: users.length,
      totalTutors: users.filter(u => u.role === 'tutor').length,
      totalStudents: users.filter(u => u.role === 'student').length,
      totalSessions: sessions.length,
      scheduledSessions: sessions.filter(s => s.status === 'scheduled').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      cancelledSessions: sessions.filter(s => s.status === 'cancelled').length,
      totalWhiteboards: whiteboardsSnap.size,
      recentActivities: activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/sessions-by-day — last 30 days
router.get('/sessions-by-day', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snap = await db.collection('sessions')
      .where('scheduledAt', '>=', thirtyDaysAgo.toISOString())
      .get();

    const byDay = {};
    snap.docs.forEach(doc => {
      const date = doc.data().scheduledAt?.split('T')[0];
      if (date) byDay[date] = (byDay[date] || 0) + 1;
    });

    const sorted = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    res.json({ data: sorted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/users — all users list
router.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/analytics/users/:uid/role — change user role
router.put('/users/:uid/role', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { uid } = req.params;
    const { role } = req.body;
    if (!['admin', 'tutor', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await db.collection('users').doc(uid).update({ role });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/activities — activity log
router.get('/activities', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const snap = await db.collection('activities')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
