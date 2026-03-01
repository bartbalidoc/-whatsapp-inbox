const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');
const { getIo } = require('../services/socket');

// All conversation routes require login
router.use(authenticate);

// GET /api/conversations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, ct.name AS contact_name, ct.phone_number,
              a.name AS assigned_agent_name
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN agents a ON a.id = c.assigned_agent_id
       ORDER BY c.last_message_at DESC NULLS LAST
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const convResult = await pool.query(
      `SELECT c.*, ct.name AS contact_name, ct.phone_number, ct.notes,
              a.name AS assigned_agent_name
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN agents a ON a.id = c.assigned_agent_id
       WHERE c.id = $1`,
      [id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(convResult.rows[0]);
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/conversations/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, assigned_agent_id } = req.body;

  const allowed = ['open', 'resolved', 'pending'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await pool.query(
      `UPDATE conversations
       SET status = COALESCE($1, status),
           assigned_agent_id = COALESCE($2, assigned_agent_id),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status || null, assigned_agent_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = result.rows[0];
    try {
      getIo().emit('conversation_updated', { conversation: updated });
    } catch (_) {}

    res.json(updated);
  } catch (err) {
    console.error('Error updating conversation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
