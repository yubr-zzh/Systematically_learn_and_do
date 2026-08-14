// ============================================================
// Seed Data - Initialize with skills from skills folder
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skills folder path (relative to project root)
const skillsFolder = path.join(__dirname, '../../skills');

export function seedSkills() {
  try {
    if (!fs.existsSync(skillsFolder)) {
      console.log('Skills folder not found, skipping seed');
      return;
    }

    const files = fs.readdirSync(skillsFolder).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} skill files`);

    const insertSkill = db.prepare(`
      INSERT OR IGNORE INTO skills (id, name, description, content, category, status, version, author)
      VALUES (?, ?, ?, ?, ?, 'active', 1, 'system')
    `);

    files.forEach(file => {
      const filePath = path.join(skillsFolder, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse frontmatter
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      let name = file.replace('.md', '');
      let description = 'Research skill';
      let category = 'research';

      if (match) {
        const frontmatter = match[1];
        const titleMatch = frontmatter.match(/name:\s*(.+)/);
        const descMatch = frontmatter.match(/description:\s*(.+)/);
        const catMatch = frontmatter.match(/category:\s*(.+)/);
        
        if (titleMatch) name = titleMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
        if (catMatch) category = catMatch[1].trim();
      }

      const id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      try {
        insertSkill.run(id, name, description, content, category);
        console.log(`Seeded skill: ${name}`);
      } catch (e) {
        console.log(`Skill already exists or error: ${e.message}`);
      }
    });

    console.log('Skills seeding complete');
  } catch (error) {
    console.error('Error seeding skills:', error);
  }
}

// Run seed if called directly
seedSkills();
