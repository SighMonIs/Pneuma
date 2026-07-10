const express = require('express');
const router = express.Router();
const { getDb, withTransaction } = require('../db');

// GET /api/categories
router.get('/', (req, res) => {
  const db = getDb();
  const cats = db.prepare('SELECT * FROM categories ORDER BY position, name').all();
  res.json(cats);
});

// POST /api/categories
router.post('/', (req, res) => {
  const { name, settings_json } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = getDb();
  const maxPos = db.prepare('SELECT MAX(position) as m FROM categories').get().m ?? -1;
  const result = db.prepare(
    'INSERT INTO categories (name, position, settings_json) VALUES (?, ?, ?)'
  ).run(name, maxPos + 1, settings_json || '{}');
  res.json({ id: Number(result.lastInsertRowid) });
});

// PUT /api/categories/reorder — bulk position update (must be before /:id)
router.put('/reorder', (req, res) => {
  const { order } = req.body; // [{ id, position }, ...]
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array' });
  const db = getDb();
  const update = db.prepare('UPDATE categories SET position = ? WHERE id = ?');
  withTransaction(db, () => order.forEach(({ id, position }) => update.run(position, id)));
  res.json({ ok: true });
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const { name, position, collapsed, settings_json } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE categories SET
      name          = COALESCE(?, name),
      position      = COALESCE(?, position),
      collapsed     = COALESCE(?, collapsed),
      settings_json = COALESCE(?, settings_json)
    WHERE id = ?
  `).run(name ?? null, position ?? null, collapsed ?? null, settings_json ?? null, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE channels SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
