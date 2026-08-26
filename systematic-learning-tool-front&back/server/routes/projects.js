// ============================================================
// Projects Routes - Manage projects
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';
import { projectRepository } from '../repositories/projectRepository.js';
import { runProjectResearch } from '../services/aiService.js';
import { badRequestIfAny, validateProjectCreate, validateProjectPatch, validateTaskAdd } from '../validators.js';

const router = Router();

// Get all projects
router.get('/', (req, res) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM projects';
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const projects = db.prepare(query).all(...params);
    
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const project = projectRepository.findById(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create new project
router.post('/', (req, res) => {
  try {
    const { name, description, type, dueDate, startDate, refLink } = req.body;

    if (badRequestIfAny(res, validateProjectCreate(req.body))) return;

    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO projects (id, name, description, type, status, progress, created_at, updated_at, due_date, start_date, ref_link)
      VALUES (?, ?, ?, ?, 'generating', 0, ?, ?, ?, ?, ?)
    `).run(id, name, description, type, now, now, dueDate || null, startDate || null, refLink || null);

    // Create default stages (项目只做深度调研 + 规划)
    const stages = [
      { id: 'research', name: '深度调研', status: 'active', progress: 0 },
      { id: 'planning', name: '规划建议', status: 'pending', progress: 0 },
    ];
    
    const insertStage = db.prepare(`
      INSERT INTO project_stages (id, project_id, stage_id, name, status, progress)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stages.forEach(stage => {
      insertStage.run(`${id}-${stage.id}`, id, stage.id, stage.name, stage.status, stage.progress);
    });

    // 启动异步深度调研 + 规划（项目流程）
    runProjectResearch(name, description)
      .then(result => {
        db.prepare(`
          UPDATE projects SET content = ?, word_count = ?, research_meta = ?, progress = 100, status = 'completed', updated_at = ?
          WHERE id = ?
        `).run(result.content, result.wordCount, JSON.stringify(result.stages.research.researchMeta || {}), new Date().toISOString(), id);
        
        db.prepare(`
          UPDATE project_stages SET status = 'done', progress = 100, content = ?
          WHERE project_id = ? AND stage_id = ?
        `).run(result.stages.research.content, id, 'research');
        
        db.prepare(`
          UPDATE project_stages SET status = 'done', progress = 100, content = ?
          WHERE project_id = ? AND stage_id = ?
        `).run(result.stages.planning.content, id, 'planning');
        
        console.log(`[Project] 调研+规划完成: ${name}`);
      })
      .catch(error => {
        db.prepare(`
          UPDATE projects SET status = 'error', updated_at = ? WHERE id = ?
        `).run(new Date().toISOString(), id);
        console.error('[Project] 调研+规划失败:', error);
      });

    res.status(201).json({ id, name, status: 'generating' });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, status, progress, content, dueDate, startDate, refLink, cover } = req.body;

    if (badRequestIfAny(res, validateProjectPatch(req.body))) return;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (progress !== undefined) { updates.push('progress = ?'); params.push(progress); }
    if (content !== undefined) { 
      updates.push('content = ?'); 
      params.push(content);
      updates.push('word_count = ?'); 
      params.push(content.replace(/\s/g, '').length);
    }
    if (dueDate !== undefined) { updates.push('due_date = ?'); params.push(dueDate); }
    if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate); }
    if (refLink !== undefined) { updates.push('ref_link = ?'); params.push(refLink); }
    if (cover !== undefined) { updates.push('cover = ?'); params.push(cover); }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Add task to project
router.post('/:id/tasks', (req, res) => {
  try {
    const { id } = req.params;
    const { title, phase, dueDate } = req.body;

    if (badRequestIfAny(res, validateTaskAdd(req.body))) return;

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    db.prepare(`
      INSERT INTO project_tasks (id, project_id, title, phase, due_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, id, title, phase, dueDate || null);
    
    res.status(201).json({ id: taskId, title, phase });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

// Toggle task
router.patch('/:id/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const { done } = req.body;
    
    db.prepare('UPDATE project_tasks SET done = ? WHERE id = ?').run(done ? 1 : 0, taskId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling task:', error);
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

// Delete task
router.delete('/:id/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    db.prepare('DELETE FROM project_tasks WHERE id = ?').run(taskId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
