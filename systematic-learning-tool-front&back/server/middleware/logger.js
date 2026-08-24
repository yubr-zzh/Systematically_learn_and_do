// ============================================================
// Structured logging middleware.
// - Assigns a short request-id (8 hex chars) to every incoming
//   request and surfaces it back via the X-Request-Id response header
//   for client / proxy correlation.
// - Emits a one-line JSON record per finished request with method,
//   url, status, duration, ip, ua. Compatible with Loki / ELK
//   ingestion without further parsing.
// - The format matches config.nodeEnv === 'production' (JSON); in
//   dev we fall back to a human-readable line for easier scanning
//   during local hacking.

import { randomBytes } from "node:crypto";

function newRequestId() {
  return randomBytes(4).toString("hex");
}

/** Express middleware: assigns req.id and stamps X-Request-Id.
 * Trims / caps any client-supplied id at 64 chars so a malicious
 * caller can't stuff an unbounded string into every log line. */
export function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  const id = (typeof incoming === "string" && incoming.length > 0 && incoming.length <= 64)
    ? incoming.replace(/[^\w.-]/g, "").slice(0, 64) || newRequestId()
    : newRequestId();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const record = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      reqId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket?.remoteAddress,
      ua: req.headers["user-agent"],
    };
    const line = process.env.NODE_ENV === "production"
      ? JSON.stringify(record)
      : `[${record.ts}] ${record.reqId} ${record.method} ${record.url} ${record.status} ${record.durationMs}ms`;
    // eslint-disable-next-line no-console
    console.log(line);
  });
  next();
}