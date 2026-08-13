// ============================================================
// Settings Routes - Manage user settings
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';

const router = Router();

// Get settings
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM user_settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.patch('/', (req, res) => {
  try {
    const { username, avatar, theme, fontSize, analysisDepth, researchSources, planningStyle } = req.body;
    
    const updates = [];
    const params = [];
    
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (theme !== undefined) { updates.push('theme = ?'); params.push(theme); }
    if (fontSize !== undefined) { updates.push('font_size = ?'); params.push(fontSize); }
    if (analysisDepth !== undefined) { updates.push('analysis_depth = ?'); params.push(analysisDepth); }
    if (researchSources !== undefined) { updates.push('research_sources = ?'); params.push(researchSources); }
    if (planningStyle !== undefined) { updates.push('planning_style = ?'); params.push(planningStyle); }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      
      db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE id = 1`).run(...params);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Export all data
router.get('/export', (req, res) => {
  try {
    const reports = db.prepare('SELECT * FROM learn_reports').all();
    const projects = db.prepare('SELECT * FROM projects').all();
    const feedback = db.prepare('SELECT * FROM feedback').all();
    const skills = db.prepare('SELECT * FROM skills').all();
    const settings = db.prepare('SELECT * FROM user_settings WHERE id = 1').get();
    
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        reports,
        projects,
        feedback,
        skills,
        settings,
      },
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=systematically-export.json');
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Import data
router.post('/import', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !data.data) {
      return res.status(400).json({ error: 'Invalid import data' });
    }
    
    const { reports, projects, feedback, skills, settings } = data.data;
    
    // Import reports
    if (reports) {
      const insertReport = db.prepare(`
        INSERT OR REPLACE INTO learn_reports (id, title, subject, category, status, progress, content, favorite, word_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      reports.forEach(r => {
        insertReport.run(r.id, r.title, r.subject, r.category, r.status, r.progress, r.content, r.favorite, r.word_count, r.created_at, r.updated_at);
      });
    }
    
    // Import projects
    if (projects) {
      const insertProject = db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, description, type, status, progress, content, cover, word_count, due_date, start_date, ref_link, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      projects.forEach(p => {
        insertProject.run(p.id, p.name, p.description, p.type, p.status, p.progress, p.content, p.cover, p.word_count, p.due_date, p.start_date, p.ref_link, p.created_at, p.updated_at);
      });
    }
    
    // Import feedback
    if (feedback) {
      const insertFeedback = db.prepare(`
        INSERT OR REPLACE INTO feedback (id, report_id, report_title, rating, strengths, improvements, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      feedback.forEach(f => {
        insertFeedback.run(f.id, f.report_id, f.report_title, f.rating, f.strengths, f.improvements, f.comment, f.created_at);
      });
    }
    
    // Import skills
    if (skills) {
      const insertSkill = db.prepare(`
        INSERT OR REPLACE INTO skills (id, name, description, content, category, status, usage_count, rating, version, author, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      skills.forEach(s => {
        insertSkill.run(s.id, s.name, s.description, s.content, s.category, s.status, s.usage_count, s.rating, s.version, s.author, s.tags, s.created_at, s.updated_at);
      });
    }
    
    // Import settings
    if (settings) {
      db.prepare(`
        UPDATE user_settings SET username = ?, avatar = ?, theme = ?, font_size = ?, analysis_depth = ?, research_sources = ?, planning_style = ?, updated_at = ?
        WHERE id = 1
      `).run(settings.username, settings.avatar, settings.theme, settings.font_size, settings.analysis_depth, settings.research_sources, settings.planning_style, new Date().toISOString());
    }
    
    res.json({ success: true, message: 'Data imported successfully' });
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Clear all data
router.post('/clear', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({ error: 'Confirmation required: send { "confirm": "DELETE_ALL_DATA" }' });
    }
    
    db.exec('DELETE FROM learn_reports');
    db.exec('DELETE FROM projects');
    db.exec('DELETE FROM feedback');
    db.exec('DELETE FROM skills');
    db.exec('DELETE FROM evolution_logs');
    
    res.json({ success: true, message: 'All data cleared' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Failed to clear data' });
  }
});

export default router;
