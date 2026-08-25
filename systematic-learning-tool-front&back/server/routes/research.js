// ============================================================
// Research Routes - Manual stage execution
// ============================================================

import { Router } from 'express';
import { db } from '../db/database.js';
import { stage1HorizontalVerticalAnalysis, stage2DeepResearch, stage3Planning } from '../services/aiService.js';
import { searchWeb } from '../services/webSearch.js';

const router = Router();

// Run single research stage
router.post('/stage/:stageId', async (req, res) => {
  try {
    const { stageId } = req.params;
    const { subject, category, reportId, content, options = {} } = req.body;
    
    if (!subject || !category) {
      return res.status(400).json({ error: 'subject and category are required' });
    }

    let result;
    
    switch (stageId) {
      case 'analysis':
        result = await stage1HorizontalVerticalAnalysis(subject, category, options);
        break;
      case 'research':
        if (!content) {
          return res.status(400).json({ error: 'content from previous stage required' });
        }
        result = await stage2DeepResearch(subject, content, options);
        break;
      case 'planning':
        if (!content) {
          return res.status(400).json({ error: 'content from previous stage required' });
        }
        result = await stage3Planning(subject, content, '', options);
        break;
      default:
        return res.status(400).json({ error: 'Invalid stageId' });
    }

    // If reportId provided, update the stage
    if (reportId) {
      db.prepare(`
        UPDATE learn_stages SET content = ?, progress = 100, status = 'done'
        WHERE report_id = ? AND stage_id = ?
      `).run(result.content, reportId, stageId);
    }

    res.json(result);
  } catch (error) {
    console.error('Error running research stage:', error);
    res.status(500).json({ error: 'Failed to run research stage' });
  }
});

// Search related content using the configured provider.
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const result = await searchWeb([query], req.body.options || {});
    res.json({ query, ...result });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

export default router;
