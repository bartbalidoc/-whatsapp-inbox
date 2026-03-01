const http = require('http');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const pool = require('./db/pool');
const socketService = require('./services/socket');
const verifyMetaSignature = require('./middleware/metaSignature');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
socketService.init(server);

// Parse raw body for Meta signature verification (must come before json parser)
app.use(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      verifyMetaSignature(req, res, req.body);
      req.body = JSON.parse(req.body);
      next();
    } catch (err) {
      console.error('Webhook signature error:', err.message);
      return res.sendStatus(403);
    }
  }
);

// JSON body parser for all other routes
app.use(express.json());

// CORS — allow requests from the frontend (set CLIENT_URL in production)
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// Routes
app.use('/webhook', require('./routes/webhook'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/conversations', require('./routes/messages'));
app.use('/api/contacts', require('./routes/contacts'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  // Run database migration on every startup (safe — uses IF NOT EXISTS)
  const sql = fs.readFileSync(path.join(__dirname, 'db/migrations/001_init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Database migration complete');

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
