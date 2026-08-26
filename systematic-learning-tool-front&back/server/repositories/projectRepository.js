import { db } from '../db/database.js';

/**
 * Project persistence Module. Its Interface returns a complete project
 * detail, including child collections, so callers do not need to know the
 * SQLite table layout.
 */
export const projectRepository = {
  findById(id) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return null;
    return {
      ...project,
      stages: db.prepare('SELECT * FROM project_stages WHERE project_id = ?').all(id),
      tasks: db.prepare('SELECT * FROM project_tasks WHERE project_id = ?').all(id),
      milestones: db.prepare('SELECT * FROM project_milestones WHERE project_id = ?').all(id),
    };
  },
};
