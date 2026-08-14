// ============================================================
// Server Entry Point - Systematically Learn and Do
// ============================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDatabase } from './db/database.js';
import { seedSkills } from './db/seed.js';
import learnRoutes from './routes/learn.js';
import projectRoutes from './routes/projects.js';
import feedbackRoutes from './routes/feedback.js';
import skillRoutes from './routes/skills.js';
import settingsRoutes from './routes/settings.js';
import researchRoutes from './routes/research.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// API Routes
app.use('/api/learn', learnRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/research', researchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling
app.use(errorHandler);

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    // Seed skills from skills folder
    seedSkills();
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
