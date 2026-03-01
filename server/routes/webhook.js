const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { getIo } = require('../services/socket');

// GET /webhook — Meta verification handshake
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('Webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// POST /webhook — Receive incoming messages
router.post('/', async (req, res) => {
  // Respond 200 immediately so Meta does not retry
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            await processIncomingMessage(msg, value.contacts);
          }
        }

        // Handle status updates (delivered, read, etc.)
        if (value.statuses) {
          for (const status of value.statuses) {
            await processStatusUpdate(status);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
  }
});

async function processIncomingMessage(msg, contacts) {
  const phoneNumber = msg.from;
  const waMessageId = msg.id;
  const timestamp = new Date(parseInt(msg.timestamp) * 1000);
  const messageType = msg.type;
  const content = msg.text?.body || null;

  // Get contact name from webhook payload if available
  const contactProfile = contacts?.find((c) => c.wa_id === phoneNumber);
  const contactName = contactProfile?.profile?.name || null;

  // Upsert contact
  const contactResult = await pool.query(
    `INSERT INTO contacts (phone_number, name)
     VALUES ($1, $2)
     ON CONFLICT (phone_number) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [phoneNumber, contactName]
  );
  const contactId = contactResult.rows[0].id;

  // Upsert conversation
  const convResult = await pool.query(
    `INSERT INTO conversations (contact_id, last_message_at, unread_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (contact_id)
     DO UPDATE SET last_message_at = $2, unread_count = conversations.unread_count + 1, updated_at = NOW()
     RETURNING id`,
    [contactId, timestamp]
  );
  const conversationId = convResult.rows[0].id;

  // Insert message
  const msgResult = await pool.query(
    `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, message_type, content, timestamp, raw_payload)
     VALUES ($1, $2, 'inbound', $3, $4, $5, $6)
     ON CONFLICT (whatsapp_message_id) DO NOTHING
     RETURNING *`,
    [conversationId, waMessageId, messageType, content, timestamp, JSON.stringify(msg)]
  );

  if (msgResult.rows.length === 0) return; // duplicate, skip

  const message = msgResult.rows[0];

  // Emit real-time event to all connected agents
  try {
    getIo().emit('new_message', { conversationId, message });
  } catch (_) {
    // Socket not yet initialized in tests — ignore
  }
}

async function processStatusUpdate(status) {
  const { id: waMessageId, status: newStatus } = status;

  await pool.query(
    `UPDATE messages SET status = $1 WHERE whatsapp_message_id = $2`,
    [newStatus, waMessageId]
  );

  try {
    getIo().emit('message_status', { messageId: waMessageId, status: newStatus });
  } catch (_) {}
}

module.exports = router;
