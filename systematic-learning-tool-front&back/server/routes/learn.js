// ============================================================
// Learn Routes - Manage learning reports
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';
import { runLearnAnalysis } from '../services/aiService.js';

const router = Router();

// Get all learn reports
router.get('/', (req, res) => {
  try {
    const { status, category, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM learn_reports';
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
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const reports = db.prepare(query).all(...params);
    
    // Get stages for each report
    const stagesStmt = db.prepare('SELECT * FROM learn_stages WHERE report_id = ?');
    const reportsWithStages = reports.map(report => ({
      ...report,
      favorite: Boolean(report.favorite),
      stages: stagesStmt.all(report.id),
    }));
    
    res.json(reportsWithStages);
  } catch (error) {
    console.error('Error fetching learn reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get single learn report
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const report = db.prepare('SELECT * FROM learn_reports WHERE id = ?').get(id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const stages = db.prepare('SELECT * FROM learn_stages WHERE report_id = ?').all(id);
    
    res.json({
      ...report,
      favorite: Boolean(report.favorite),
      stages,
    });
  } catch (error) {
    console.error('Error fetching learn report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Create new learn report and start research
router.post('/', async (req, res) => {
  try {
    const { subject, category, depth = 'standard' } = req.body;
    
    if (!subject || !category) {
      return res.status(400).json({ error: 'subject and category are required' });
    }

    const id = `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    
    // Create initial report
    db.prepare(`
      INSERT INTO learn_reports (id, title, subject, category, status, progress, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'generating', 0, ?, ?)
    `).run(id, subject, subject, category, now, now);
    
    // Create stages (学习只做横纵分析)
    const stages = [
      { id: 'analysis', name: '横纵分析', status: 'active', progress: 0 },
    ];
    
    const insertStage = db.prepare(`
      INSERT INTO learn_stages (id, report_id, stage_id, name, status, progress)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stages.forEach((stage, index) => {
      insertStage.run(
        `${id}-${stage.id}`,
        id,
        stage.id,
        stage.name,
        stage.status,
        stage.progress
      );
    });

    // 启动异步横纵分析（学习流程）
    runLearnAnalysis(subject, category, { depth })
      .then(result => {
        // Update report with final content
        db.prepare(`
          UPDATE learn_reports 
          SET content = ?, word_count = ?, progress = 100, status = 'completed', updated_at = ?
          WHERE id = ?
        `).run(result.content, result.wordCount, new Date().toISOString(), id);
        
        // Update stage
        db.prepare(`
          UPDATE learn_stages SET status = 'done', progress = 100, content = ?
          WHERE report_id = ? AND stage_id = ?
        `).run(result.stages.analysis.content, id, 'analysis');
        
        console.log(`[Learn] 横纵分析完成: ${subject}`);
      })
      .catch(error => {
        console.error('Research failed:', error);
        db.prepare(`
          UPDATE learn_reports SET status = 'error', updated_at = ?
          WHERE id = ?
        `).run(new Date().toISOString(), id);
      });

    res.status(201).json({
      id,
      subject,
      category,
      status: 'generating',
      progress: 0,
    });
  } catch (error) {
    console.error('Error creating learn report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Update learn report (e.g., toggle favorite)
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { favorite, title, content } = req.body;
    
    const report = db.prepare('SELECT * FROM learn_reports WHERE id = ?').get(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const updates = [];
    const params = [];
    
    if (favorite !== undefined) {
      updates.push('favorite = ?');
      params.push(favorite ? 1 : 0);
    }
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
      updates.push('word_count = ?');
      params.push(content.replace(/\s/g, '').length);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      
      db.prepare(`UPDATE learn_reports SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating learn report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Delete learn report
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM learn_reports WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting learn report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Get report versions
router.get('/:id/versions', (req, res) => {
  try {
    const { id } = req.params;
    const versions = db.prepare(`
      SELECT id, version, created_at FROM report_versions 
      WHERE report_id = ? ORDER BY version DESC
    `).all(id);
    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

export default router;
