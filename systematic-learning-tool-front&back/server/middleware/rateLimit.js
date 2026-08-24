// ============================================================
// Simple in-memory sliding-window rate limiter, per IP.
// No external dependency. Use a Map keyed by IP -> hit timestamps.
//
// NOTE: in-memory only — for multi-process deployments swap for a
// Redis-backed limiter. For this single-process server it's fine.
// ============================================================

const DEFAULT_SKIP_PATHS = new Set(["/api/health"]);

export function createRateLimiter({ max = 200, windowMs = 60_000, skipPaths = DEFAULT_SKIP_PATHS } = {}) {
  const hits = new Map(); // ip -> number[] (timestamps within window)

  // Periodic cleanup so the Map doesn't grow forever with idle entries.
  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, list] of hits) {
      const fresh = list.filter(t => t > cutoff);
      if (fresh.length === 0) hits.delete(ip);
      else if (fresh.length !== list.length) hits.set(ip, fresh);
    }
  }, windowMs).unref();

  return function rateLimit(req, res, next) {
    if (max <= 0) return next(); // disabled
    const path = req.path.replace(/\/+$/, "") || "/";
    if (skipPaths.has(path)) return next();
    // CORS preflight doesn't carry application state; never charge it
    // against the limiter budget (each cross-origin POST would otherwise
    // cost 2 tokens).
    if (req.method === "OPTIONS") return next();

    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;
    const list = hits.get(ip) || [];
    // Drop entries outside the current window
    const fresh = list.filter(t => t > cutoff);
    if (fresh.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((fresh[0] + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      return res.status(429).json({
        error: "Too Many Requests",
        message: `请求过于频繁，请在 ${retryAfter} 秒后重试`,
      });
    }
    fresh.push(now);
    hits.set(ip, fresh);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - fresh.length)));
    next();
  };
}