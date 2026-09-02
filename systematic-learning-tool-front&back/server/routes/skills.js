// ============================================================
// Skills Routes - Manage skills and evolution
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';
import { badRequestIfAny, validateSkillCreate, validateSkillPatch } from '../validators.js';

const router = Router();

// Get all skills
router.get('/', (req, res) => {
  try {
    const { status, category, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM skills';
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const skills = db.prepare(query).all(...params).map(s => ({
      ...s,
      tags: JSON.parse(s.tags || '[]'),
    }));
    
    res.json(skills);
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// Get single skill
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    res.json({
      ...skill,
      tags: JSON.parse(skill.tags || '[]'),
    });
  } catch (error) {
    console.error('Error fetching skill:', error);
    res.status(500).json({ error: 'Failed to fetch skill' });
  }
});

// Create skill
router.post('/', (req, res) => {
  try {
    const { name, description, content, category, tags = [] } = req.body;

    if (badRequestIfAny(res, validateSkillCreate(req.body))) return;

    const id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    db.prepare(`
      INSERT INTO skills (id, name, description, content, category, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description, content, category || 'general', JSON.stringify(tags));

    // Log evolution
    db.prepare(`
      INSERT INTO evolution_logs (id, type, skill_name, description)
      VALUES (?, 'skill_created', ?, ?)
    `).run(`log-${Date.now()}`, name, `Created skill: ${name}`);

    res.status(201).json({ id, name });
  } catch (error) {
    console.error('Error creating skill:', error);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

// Update skill
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, content, category, status, rating, tags } = req.body;

    if (badRequestIfAny(res, validateSkillPatch(req.body))) return;

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Snapshot the pre-image BEFORE writing if any content-bearing
    // field is actually changing. Pure metadata edits (status, rating,
    // tags) don't earn a version row.
    const contentChanged =
      (name !== undefined && name !== skill.name) ||
      (description !== undefined && description !== skill.description) ||
      (content !== undefined && content !== skill.content) ||
      (category !== undefined && category !== skill.category);
    if (contentChanged) {
      const nextVersion = (db.prepare(
        'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM skill_versions WHERE skill_id = ?'
      ).get(id)?.v) || 1;
      db.prepare(`
        INSERT INTO skill_versions (id, skill_id, name, description, content, category, version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `skver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id, skill.name, skill.description, skill.content, skill.category,
        nextVersion, new Date().toISOString()
      );
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (rating !== undefined) { updates.push('rating = ?'); params.push(rating); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      
      db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating skill:', error);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

// Increment skill usage
router.post('/:id/use', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE skills SET usage_count = usage_count + 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing usage:', error);
    res.status(500).json({ error: 'Failed to increment usage' });
  }
});

// Archive skill
router.post('/:id/archive', (req, res) => {
  try {
    const { id } = req.params;
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    db.prepare('UPDATE skills SET status = ? WHERE id = ?').run('archived', id);
    
    // Log evolution
    db.prepare(`
      INSERT INTO evolution_logs (id, type, skill_name, description)
      VALUES (?, 'skill_archived', ?, ?)
    `).run(`log-${Date.now()}`, skill.name, `Archived skill: ${skill.name}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving skill:', error);
    res.status(500).json({ error: 'Failed to archive skill' });
  }
});

// Pin/unpin skill
router.post('/:id/pin', (req, res) => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;
    const status = pinned ? 'pinned' : 'active';
    
    db.prepare('UPDATE skills SET status = ? WHERE id = ?').run(status, id);
    
    // Log evolution
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    db.prepare(`
      INSERT INTO evolution_logs (id, type, skill_name, description)
      VALUES (?, 'skill_pinned', ?, ?)
    `).run(`log-${Date.now()}`, skill.name, `${pinned ? 'Pinned' : 'Unpinned'} skill: ${skill.name}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error pinning skill:', error);
    res.status(500).json({ error: 'Failed to pin skill' });
  }
});

// Delete skill
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

// Get evolution logs
router.get('/evolution/logs', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const logs = db.prepare(`
      SELECT * FROM evolution_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));
    res.json(logs);
  } catch (error) {
    console.error('Error fetching evolution logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// List prior versions of a skill. The content is included so the
// UI can render a side-by-side preview before confirming a restore.
router.get('/:id/versions', (req, res) => {
  try {
    const { id } = req.params;
    const versions = db.prepare(`
      SELECT id, version, created_at, name, description, content, category
      FROM skill_versions
      WHERE skill_id = ?
      ORDER BY version DESC
    `).all(id);
    res.json(versions);
  } catch (error) {
    console.error('Error fetching skill versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// Restore a previous version. Snapshots the current content as a new
// version first so the restore itself is reversible.
router.post('/:id/versions/:vid/restore', (req, res) => {
  try {
    const { id, vid } = req.params;
    const target = db.prepare(
      'SELECT id, version, name, description, content, category FROM skill_versions WHERE id = ? AND skill_id = ?'
    ).get(vid, id);
    if (!target) return res.status(404).json({ error: 'Version not found' });
    const skill = db.prepare('SELECT name, description, content, category FROM skills WHERE id = ?').get(id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Snapshot current state first.
    const nextVersion = (db.prepare(
      'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM skill_versions WHERE skill_id = ?'
    ).get(id)?.v) || 1;
    db.prepare(`
      INSERT INTO skill_versions (id, skill_id, name, description, content, category, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `skver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id, skill.name, skill.description, skill.content, skill.category,
      nextVersion, new Date().toISOString()
    );

    // Restore target fields onto the skill row.
    db.prepare(`
      UPDATE skills
      SET name = ?, description = ?, content = ?, category = ?, updated_at = ?
      WHERE id = ?
    `).run(target.name, target.description, target.content, target.category, new Date().toISOString(), id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring skill version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

export default router;
