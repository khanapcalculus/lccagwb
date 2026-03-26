require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const sessionsRouter = require('./routes/sessions');
const analyticsRouter = require('./routes/analytics');
const whiteboardRouter = require('./routes/whiteboard');
const setupWhiteboardSocket = require('./socket/whiteboard');

const app = express();
const server = http.createServer(app);

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: [clientUrl, 'https://lccagwb.web.app', 'https://lccagwb.firebaseapp.com'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [clientUrl, 'https://lccagwb.web.app', 'https://lccagwb.firebaseapp.com'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // larger limit for canvas data
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'LCC AGW Whiteboard Server' }));
app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/sessions', sessionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/whiteboard', whiteboardRouter);

// ─── Socket.io ────────────────────────────────────────────────
setupWhiteboardSocket(io);

// ─── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 LCC AGW Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready on /whiteboard namespace`);
  console.log(`🌐 Accepting connections from: ${clientUrl}`);
});
