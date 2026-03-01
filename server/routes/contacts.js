const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, phone_number, name, notes, created_at FROM contacts ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, phone_number, name, notes, created_at FROM contacts WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching contact:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/contacts/:id
router.patch('/:id', async (req, res) => {
  const { name, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE contacts
       SET name = COALESCE($1, name),
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, phone_number, name, notes, updated_at`,
      [name || null, notes || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating contact:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
