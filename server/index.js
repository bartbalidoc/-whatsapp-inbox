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

// Signature verification only applies to POST /webhook (not GET verification handshake)
app.post(
  '/webhook',
  express.raw({ type: '*/*' }),
  (req, res, next) => {
    try {
      verifyMetaSignature(req, res, req.body);
      req.body = JSON.parse(req.body);
      next();
    } catch (err) {
      console.error('Webhook signature error:', err.message);
      return res.sendStatus(403);
    }
  },
  require('./routes/webhook')
);

// JSON body parser for all other routes
app.use(express.json());

// CORS — allow requests from the frontend (set CLIENT_URL in production)
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// GET /webhook — Meta verification handshake (no signature needed)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/conversations', require('./routes/messages'));
app.use('/api/contacts', require('./routes/contacts'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Start listening immediately so Railway health check passes
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

// Run migration after server is up (non-blocking)
// pg cannot run multiple statements in one query — split and run each one
async function runMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'db/migrations/001_init.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  const client = await pool.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    console.log('Database migration complete');
  } finally {
    client.release();
  }
}

runMigration().catch((err) => console.error('Migration error:', err.message));
