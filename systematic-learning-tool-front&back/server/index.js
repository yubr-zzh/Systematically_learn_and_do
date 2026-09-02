// ============================================================
// Server Entry Point - Systematically Learn and Do
// ============================================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// IMPORTANT: config.js must be imported first so that dotenv.config()
// has already populated process.env before any other module reads it
// at top level (e.g. database.js captures process.env.DB_PATH).
import { config, validateConfig } from './config.js';
import { initDatabase, db } from './db/database.js';
import { seedSkills } from './db/seed.js';
import { startCuratorLoop } from './services/curator.js';
import { reapOrphanProcesses } from './services/reportLifecycle.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import learnRoutes from './routes/learn.js';
import projectRoutes from './routes/projects.js';
import feedbackRoutes from './routes/feedback.js';
import skillRoutes from './routes/skills.js';
import settingsRoutes from './routes/settings.js';
import researchRoutes from './routes/research.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId, requestLogger } from './middleware/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;

// Middleware
// CORS: in production enforce a whitelist from ALLOWED_ORIGINS; in
// development allow any origin so the Vite dev server on a different
// port can hit us.
const corsOptions = config.allowedOrigins.length
  ? { origin: (origin, cb) => {
      // Allow same-origin / curl / server-to-server (no Origin header)
      if (!origin) return cb(null, true);
      if (config.allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: ${origin} 不在白名单中`));
    }}
  : {}; // empty options = allow all (dev fallback)
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Per-request id + structured access log.
// Note: must come BEFORE the rate limiter so 429-rejected requests
// still get a request id and an access-log entry.
app.use(requestId);
app.use(requestLogger);

// Rate limit (per IP, sliding window). Skip /api/health for monitors.
app.use(createRateLimiter({
  max: config.rateLimitMax,
  windowMs: config.rateLimitWindowMs,
}));

// API Routes
app.use('/api/learn', learnRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/research', researchRoutes);

// Health check — liveness + readiness probe. Reports DB connectivity,
// AI key presence, and Curator status. Returns 200 when everything is
// healthy; 503 when something critical (DB) is down so load balancers
// can drain the pod.
app.get('/api/health', (req, res) => {
  const checks = { db: { ok: false }, aiKey: { ok: false }, webSearch: { ok: false, configured: false } };
  try {
    const row = db.prepare('SELECT 1 AS alive').get();
    checks.db.ok = row?.alive === 1;
  } catch (e) {
    checks.db.error = e.message;
  }
  checks.aiKey.ok = !!config.apiKey && config.apiKey.length >= 20;
  checks.webSearch.configured = config.webSearchProvider !== 'none' && Boolean(config.tavilyApiKey || config.braveSearchApiKey);
  checks.webSearch.ok = checks.webSearch.configured;
  // AI and web search are capabilities, not liveness dependencies: the app
  // can still serve saved reports and explicit template fallbacks without them.
  const allOk = checks.db.ok;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    nodeEnv: config.nodeEnv,
  });
});

// Serve static files in production
if (config.nodeEnv === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));

  // path-to-regexp v8 requires a named wildcard; '/*splat' gives us
  // a catch-all that routes unmatched paths back to index.html so
  // the SPA can take over client-side routing.
  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// CORS errors come through as plain Error("CORS: ..."); translate
// them into a 403 instead of letting the generic handler return 500.
app.use((err, req, res, next) => {
  if (err && typeof err.message === "string" && err.message.startsWith("CORS: ")) {
    return res.status(403).json({ error: "Forbidden", message: err.message });
  }
  next(err);
});

// Error handling
app.use(errorHandler);

// Initialize database and start server
async function start() {
  try {
    // Surface missing / placeholder env before doing anything else.
    // In production we REFUSE to boot with placeholder config — the
    // user must explicitly set a real DEEPSEEK_API_KEY (the README
    // example file uses one for local dev). In dev we keep the old
    // warn-only behaviour so contributors can poke at the UI without
    // a working AI key (the aiService has a static template fallback).
    const validation = validateConfig();
    if (validation.problems.length) {
      const header = config.nodeEnv === 'production'
        ? '❌ Configuration errors (refusing to boot):'
        : '⚠️  Configuration warnings:';
      console.warn(header);
      validation.problems.forEach(p => console.warn(`   - ${p}`));
      if (!validation.ok && config.nodeEnv === 'production') {
        console.error('\nRefusing to start in production with placeholder config. Set a real DEEPSEEK_API_KEY in .env (or in the deployment environment) and try again.');
        process.exit(1);
      }
    } else {
      console.log('✅  Configuration OK (AI key present)');
    }

    await initDatabase();
    console.log('Database initialized');

    // Reap report_processes rows left behind by a crashed/restarted
    // previous instance. Done before seeding so orphan reports are
    // visible to /api/health / loadAll without waiting for any timer.
    const reaped = reapOrphanProcesses();
    if (reaped.orphanedReports) {
      console.log(`[reaper] marked ${reaped.orphanedReports} orphan report(s) as 'error'`);
    }

    // Seed skills from skills folder
    seedSkills();

    // Curator: periodic Skill lifecycle maintenance (active → watch → stale → archived)
    startCuratorLoop();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
