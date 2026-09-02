// ============================================================
// Learn Routes - Manage learning reports
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';
import { streamLearnAnalysis } from '../services/learnStream.js';
import {
  registerReportProcess,
  touchReportProcess,
  unregisterReportProcess,
} from '../services/reportLifecycle.js';
import { badRequestIfAny, validateLearnCreate, validateLearnReportPatch } from '../validators.js';

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
    const { subject, category, depth = 'standard', skillId } = req.body;

    if (badRequestIfAny(res, validateLearnCreate(req.body))) return;

    // If a Skill template is provided, load its content to use as the
    // AI system prompt. Replace {subject} / {category} placeholders.
    let template = null;
    if (skillId) {
      const skill = db.prepare('SELECT content FROM skills WHERE id = ?').get(skillId);
      if (!skill) return res.status(404).json({ error: 'Skill not found' });
      template = skill.content;
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
      { id: 'research', name: '娣卞害璋冪爺', status: 'pending', progress: 0 },
      { id: 'planning', name: '瑙勫垝寤鸿', status: 'pending', progress: 0 },
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

    // Register this in-flight report with the local process BEFORE the
    // emitter starts so a server crash before the first event still has
    // a heartbeat row the reaper can find on next boot.
    registerReportProcess(id);

    // 启动异步横纵分析（学习流程）。通过 streamLearnAnalysis 拿到
    // progress / complete / error 事件，并把进度实时写库，这样 SSE 客户端
    // 可以在中途连接进来也能同步看到进度。
    const emitter = streamLearnAnalysis(subject, category, { depth, template });
    emitter
      .on('progress', ({ progress }) => {
        touchReportProcess(id);
        db.prepare(`
          UPDATE learn_reports SET progress = ?, updated_at = ?
          WHERE id = ?
        `).run(progress, new Date().toISOString(), id);
      })
      .on('complete', (result) => {
        db.prepare(`
          UPDATE learn_reports
          SET content = ?, word_count = ?, research_meta = ?, progress = 100, status = 'completed', updated_at = ?
          WHERE id = ?
        `).run(result.content, result.wordCount, JSON.stringify(result.researchMeta || {}), new Date().toISOString(), id);

        // Snapshot the freshly-generated content as a new version so the
        // user has something to roll back to after a manual edit. Use
        // MAX(version)+1 so re-running the AI doesn't collide on v1.
        const aiVersion = (db.prepare(
          'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM report_versions WHERE report_id = ?'
        ).get(id)?.v) || 1;
        db.prepare(`
          INSERT INTO report_versions (id, report_id, content, version, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(`ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, id, result.content, aiVersion, new Date().toISOString());

        // Update stage (legacy single-stage table)
        for (const stageId of ['analysis', 'research', 'planning']) {
          const stage = result.stages?.[stageId];
          if (!stage) continue;
          db.prepare(`
            UPDATE learn_stages SET status = 'done', progress = 100, content = ?
            WHERE report_id = ? AND stage_id = ?
          `).run(stage.content, id, stageId);
        }

        unregisterReportProcess(id);
        console.log(`[Learn] 横纵分析完成: ${subject}`);
      })
      .on('error', (err) => {
        console.error('Research failed:', err);
        unregisterReportProcess(id);
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

// Update learn report (e.g., toggle favorite, archive)
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { favorite, title, content, status } = req.body;

    if (badRequestIfAny(res, validateLearnReportPatch(req.body))) return;

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
      // Snapshot the previous content into report_versions so the user
      // can roll back via the version modal in LearnDetailPage.
      if (report.content !== content) {
        const nextVersion = (db.prepare(
          'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM report_versions WHERE report_id = ?'
        ).get(id)?.v) || 1;
        db.prepare(`
          INSERT INTO report_versions (id, report_id, content, version, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          id,
          report.content,
          nextVersion,
          new Date().toISOString()
        );
      }
      updates.push('content = ?');
      params.push(content);
      updates.push('word_count = ?');
      params.push(content.replace(/\s/g, '').length);
    }
    if (status !== undefined) {
      // NOTE: enum validation lives in Step 3.2 (shared runtime schema).
      updates.push('status = ?');
      params.push(status);
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

// Get report versions (includes content so the frontend can preview)
router.get('/:id/versions', (req, res) => {
  try {
    const { id } = req.params;
    const versions = db.prepare(`
      SELECT id, version, created_at, content FROM report_versions
      WHERE report_id = ? ORDER BY version DESC
    `).all(id);
    res.json(versions);
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// Restore a previous version. Snapshots current content as a new
// version first so the restore itself is reversible.
router.post('/:id/versions/:vid/restore', (req, res) => {
  try {
    const { id, vid } = req.params;
    const target = db.prepare(
      'SELECT id, content FROM report_versions WHERE id = ? AND report_id = ?'
    ).get(vid, id);
    if (!target) return res.status(404).json({ error: 'Version not found' });
    const report = db.prepare('SELECT content FROM learn_reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Snapshot current content as the next version so the user can
    // undo the restore.
    const nextVersion = (db.prepare(
      'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM report_versions WHERE report_id = ?'
    ).get(id)?.v) || 1;
    db.prepare(`
      INSERT INTO report_versions (id, report_id, content, version, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `ver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id,
      report.content,
      nextVersion,
      new Date().toISOString()
    );

    // Restore target content into the report.
    db.prepare(`
      UPDATE learn_reports SET content = ?, word_count = ?, updated_at = ?
      WHERE id = ?
    `).run(target.content, target.content.replace(/\s/g, '').length, new Date().toISOString(), id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// -------------------------------------------------------------
// SSE: stream progress / completion for a Learn report
//
// The frontend opens EventSource('/api/learn/:id/stream') right after
// POST /api/learn. We DO NOT trigger AI generation here — POST /api/learn
// already kicks it off and writes results to the DB. This handler just
// watches the DB row and forwards events:
//   - 'progress' whenever the row's progress value changes
//   - 'complete' when status flips to 'completed' (with full content)
//   - 'error' when status flips to 'error'
//
// This keeps the single source of truth in the DB and avoids the SSE
// endpoint re-running the AI call.
// -------------------------------------------------------------
router.get('/:id/stream', (req, res) => {
  const { id } = req.params;
  const report = db.prepare('SELECT * FROM learn_reports WHERE id = ?').get(id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  // SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders?.();

  const sendEvent = (event, payload) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  // Short-circuit on terminal states
  if (report.status === 'completed') {
    sendEvent('complete', { content: report.content, wordCount: report.word_count });
    return res.end();
  }
  if (report.status === 'error') {
    sendEvent('error', { message: 'Report failed' });
    return res.end();
  }

  // Watch the DB row. Forward 'progress' on every poll — the backend
  // emits heartbeats after the 30s interpolation plateau so the client's
  // stale-detection timer never trips on healthy in-flight generations.
  // (1 event / second is well under any reasonable SSE budget.)
  const stmt = db.prepare('SELECT status, progress, content, word_count FROM learn_reports WHERE id = ?');

  // Ship an immediate progress so the UI knows we're streaming.
  sendEvent('progress', { progress: report.progress ?? 0 });

  const interval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(interval);
      return;
    }
    const row = stmt.get(id);
    if (!row) {
      sendEvent('error', { message: 'Report vanished' });
      clearInterval(interval);
      return res.end();
    }
    if (row.status === 'completed') {
      sendEvent('complete', { content: row.content, wordCount: row.word_count });
      clearInterval(interval);
      return res.end();
    }
    if (row.status === 'error') {
      sendEvent('error', { message: 'Report failed' });
      clearInterval(interval);
      return res.end();
    }
    // Always forward progress (incl. heartbeats at the same numeric value)
    // so the client stale timer keeps resetting.
    sendEvent('progress', { progress: row.progress ?? 0 });
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
    if (!res.writableEnded) res.end();
  });
});

export default router;
