const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { sendTextMessage } = require('../services/whatsapp');
const { getIo } = require('../services/socket');

router.use(authenticate);

// GET /api/conversations/:id/messages
router.get('/', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT m.*, a.name AS agent_name
       FROM messages m
       LEFT JOIN agents a ON a.id = m.sent_by_agent_id
       WHERE m.conversation_id = $1
       ORDER BY m.timestamp ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/conversations/:id/messages
router.post('/', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  try {
    // Get the conversation and contact phone number
    const convResult = await pool.query(
      `SELECT c.id, ct.phone_number FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.id = $1`,
      [id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { phone_number } = convResult.rows[0];

    // Send via WhatsApp API
    const waResponse = await sendTextMessage(phone_number, text.trim());
    const waMessageId = waResponse.messages?.[0]?.id;

    // Save to database
    const msgResult = await pool.query(
      `INSERT INTO messages (conversation_id, whatsapp_message_id, direction, message_type, content, sent_by_agent_id, status, timestamp)
       VALUES ($1, $2, 'outbound', 'text', $3, $4, 'sent', NOW())
       RETURNING *`,
      [id, waMessageId, text.trim(), req.agent.id]
    );

    // Update conversation last_message_at
    await pool.query(
      `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    const message = msgResult.rows[0];

    try {
      getIo().to(`conversation:${id}`).emit('message_sent', { conversationId: id, message });
    } catch (_) {}

    res.status(201).json(message);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
