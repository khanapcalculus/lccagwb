const { auth, db } = require('../firebase-admin');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;

    // Fetch user role from Firestore
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (userDoc.exists) {
      req.user.role = userDoc.data().role;
      req.user.displayName = userDoc.data().displayName;
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { verifyToken, requireRole };
