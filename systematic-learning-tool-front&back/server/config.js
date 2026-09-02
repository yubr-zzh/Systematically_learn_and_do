// ============================================================
// Server config loader + startup validation
// Surfaces missing / placeholder secrets early instead of failing
// silently during the first AI call.
// ============================================================

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve .env from this file's location so cwd doesn't matter.
// Falls back to cwd lookup if the pinned file is missing.
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env.local"), override: false });

const PLACEHOLDER_TOKENS = new Set([
  "",
  "replace-me-with-your-real-key",
  "your-api-key",
  "your_api_key",
  "replaceme",
  "placeholder",
  "your-key-here",
  "changeme",
  "xxx",
  "sk-xxx",
  "***",
  "null",
  "undefined",
]);

function isPlaceholder(value) {
  if (value == null) return true;
  const v = String(value).trim().toLowerCase();
  if (PLACEHOLDER_TOKENS.has(v)) return true;
  // DeepSeek / OpenAI-style keys are typically "sk-" + >= 20 chars.
  // Catch half-typed values like "sk-1234" silently passing as truthy.
  if (v.startsWith("sk-") && v.length < 20) return true;
  return false;
}

/** Parse an env var as a number, treating unset / blank / non-numeric as the default.
 * Explicit "0" is preserved (used by RATE_LIMIT_MAX=0 to disable the limiter). */
function parseNumericEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build a config snapshot from the current process.env. Always called
 * fresh (never cached at module load time) so tests and the runtime
 * see a consistent view of env mutations, and so a buildConfig call
 * right after `dotenv.config()` sees those changes immediately.
 */
export function buildConfig() {
  return {
    port: Number(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || "development",
    dbPath: process.env.DB_PATH || "./data/systematically.db",
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "",
    apiBaseUrl: process.env.API_BASE_URL || "https://api.deepseek.com/v1",
    aiModel: process.env.AI_MODEL || "deepseek-chat",
    webSearchProvider: (process.env.WEB_SEARCH_PROVIDER || "auto").toLowerCase(),
    tavilyApiKey: process.env.TAVILY_API_KEY || "",
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY || "",
    webSearchTimeoutMs: parseNumericEnv("WEB_SEARCH_TIMEOUT_MS", 12_000),
    webSearchMaxResults: parseNumericEnv("WEB_SEARCH_MAX_RESULTS", 8),
    /** Comma-separated list of allowed CORS origins. Empty = allow all (dev only). */
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    /** Max requests per IP within rateLimitWindowMs. 0 = disabled. */
    rateLimitMax: parseNumericEnv("RATE_LIMIT_MAX", 200),
    rateLimitWindowMs: parseNumericEnv("RATE_LIMIT_WINDOW_MS", 60_000),
  };
}

/** Snapshot at module load — used by code paths that want a frozen view. */
export const config = buildConfig();

/**
 * Validate a config snapshot. Defaults to `config` for back-compat with
 * existing call sites that pass nothing; tests pass `buildConfig()` so
 * they can mutate env between cases.
 *
 * Returns { ok, problems }.
 *   ok=true  when there are NO problems.
 *   ok=false when something is wrong.
 *
 * index.js acts on ok=false only when NODE_ENV=production (refuses to
 * boot). In development we keep the warn-only contract so contributors
 * can still poke at the UI without a working AI key — the aiService
 * has a static template fallback for that case.
 */
export function validateConfig(cfg = config) {
  const problems = [];
  if (isPlaceholder(cfg.apiKey)) {
    problems.push(
      "DEEPSEEK_API_KEY is missing or still set to a placeholder. " +
        "AI report generation will fall back to a static template. " +
        "Set a real key in .env to enable live AI reports."
    );
  }
  if (!cfg.apiBaseUrl.startsWith("http")) {
    problems.push(`API_BASE_URL looks invalid: "${cfg.apiBaseUrl}".`);
  }
  if (!['auto', 'tavily', 'brave', 'none'].includes(cfg.webSearchProvider)) {
    problems.push(`WEB_SEARCH_PROVIDER must be auto, tavily, brave, or none (got "${cfg.webSearchProvider}").`);
  }
  return { ok: problems.length === 0, problems };
}
