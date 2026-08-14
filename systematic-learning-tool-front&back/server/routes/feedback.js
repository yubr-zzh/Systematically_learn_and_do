// ============================================================
// Feedback Routes - Manage user feedback
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get all feedback
router.get('/', (req, res) => {
  try {
    const { reportId, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM feedback';
    const params = [];
    
    if (reportId) {
      query += ' WHERE report_id = ?';
      params.push(reportId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const feedback = db.prepare(query).all(...params);
    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Create feedback
router.post('/', (req, res) => {
  try {
    const { reportId, reportTitle, rating, strengths, improvements, comment } = req.body;
    
    if (!reportTitle || rating === undefined) {
      return res.status(400).json({ error: 'reportTitle and rating are required' });
    }

    const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    db.prepare(`
      INSERT INTO feedback (id, report_id, report_title, rating, strengths, improvements, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, reportId || null, reportTitle, rating, strengths || '', improvements || '', comment || '');

    res.status(201).json({ id, rating });
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Delete feedback
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM feedback WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
