// ============================================================
// Database Module - SQLite with better-sqlite3
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/systematically.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables
export function initDatabase() {
  // Learn Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS learn_reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'generating',
      progress INTEGER DEFAULT 0,
      content TEXT DEFAULT '',
      favorite INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      research_meta TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try { db.exec("ALTER TABLE learn_reports ADD COLUMN research_meta TEXT DEFAULT '{}'"); } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }

  // Learn Report Stages
  db.exec(`
    CREATE TABLE IF NOT EXISTS learn_stages (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      content TEXT DEFAULT '',
      FOREIGN KEY (report_id) REFERENCES learn_reports(id) ON DELETE CASCADE
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'planning',
      progress INTEGER DEFAULT 0,
      content TEXT DEFAULT '',
      cover INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      research_meta TEXT DEFAULT '{}',
      due_date TEXT,
      start_date TEXT,
      ref_link TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try { db.exec("ALTER TABLE projects ADD COLUMN research_meta TEXT DEFAULT '{}'"); } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }

  // Project Stages
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_stages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      content TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Project Tasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      phase TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Project Milestones
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      name TEXT NOT NULL,
      duration TEXT NOT NULL,
      goal TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Feedback table
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      report_id TEXT,
      report_title TEXT NOT NULL,
      rating INTEGER NOT NULL,
      strengths TEXT DEFAULT '',
      improvements TEXT DEFAULT '',
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Skills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      usage_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      version INTEGER DEFAULT 1,
      author TEXT DEFAULT 'user',
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Evolution logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS evolution_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      skill_name TEXT,
      subject TEXT,
      description TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  // User settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      username TEXT DEFAULT '学习者',
      avatar TEXT DEFAULT '\ud83c\udf31',
      theme TEXT DEFAULT 'system',
      font_size INTEGER DEFAULT 15,
      analysis_depth TEXT DEFAULT 'standard',
      research_sources INTEGER DEFAULT 8,
      planning_style TEXT DEFAULT 'hybrid',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default settings if not exists
  db.exec(`
    INSERT OR IGNORE INTO user_settings (id, username, avatar, theme, font_size, analysis_depth, research_sources, planning_style)
    VALUES (1, '学习者', '\ud83c\udf31', 'system', 15, 'standard', 8, 'hybrid')
  `);

  // Report versions/history
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_versions (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (report_id) REFERENCES learn_reports(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_learn_reports_category ON learn_reports(category);
    CREATE INDEX IF NOT EXISTS idx_learn_reports_status ON learn_reports(status);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
    CREATE INDEX IF NOT EXISTS idx_evolution_logs_timestamp ON evolution_logs(timestamp);
  `);

  console.log('Database tables initialized');
}

export default db;
