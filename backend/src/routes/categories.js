import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// GET /api/categories — all categories with channel count
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(cc.channel_id)::int AS channel_count
      FROM categories c
      LEFT JOIN channel_categories cc ON cc.category_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Categories] GET / failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories — create category
router.post('/', async (req, res) => {
  const { name, icon, color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Get max sort_order
    const orderResult = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM categories');
    const nextOrder = orderResult.rows[0].next_order;

    const result = await pool.query(
      `INSERT INTO categories (name, icon, color, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), icon || 'Folder', color || '#6366f1', nextOrder]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Categories] POST / failed:', err.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PATCH /api/categories/:id — update category
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, icon, color, sort_order } = req.body;

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name.trim());
  }
  if (icon !== undefined) {
    updates.push(`icon = $${paramCount++}`);
    values.push(icon);
  }
  if (color !== undefined) {
    updates.push(`color = $${paramCount++}`);
    values.push(color);
  }
  if (sort_order !== undefined) {
    updates.push(`sort_order = $${paramCount++}`);
    values.push(sort_order);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Categories] PATCH failed:', err.message);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id — delete category
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('[Categories] DELETE failed:', err.message);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// POST /api/categories/:id/reorder — update sort order
router.post('/:id/reorder', async (req, res) => {
  const { id } = req.params;
  const { sort_order } = req.body;

  if (sort_order === undefined || sort_order === null) {
    return res.status(400).json({ error: 'sort_order is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE categories SET sort_order = $1 WHERE id = $2 RETURNING *',
      [sort_order, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Categories] Reorder failed:', err.message);
    res.status(500).json({ error: 'Failed to reorder category' });
  }
});

export default router;
