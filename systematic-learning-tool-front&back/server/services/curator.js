// ============================================================
// Curator — periodic maintenance for the Skill lifecycle.
//
// Skill statuses (per 工具需求与目标.md):
//   active   -> watch   : no update in 30 days
//   watch    -> stale   : no update in 90 days
//   stale    -> archived: no update in 180 days
//   pinned   : never auto-transitioned
//   archived : terminal (a separate "restore" UI action can revive it)
//
// Each transition is logged as an evolution event so the Skill page
// evolution log surfaces what the Curator did and why.
// ============================================================

import { db } from "../db/database.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const THRESHOLDS = {
  watchAfterDays: 30,
  staleAfterDays: 90,
  archiveAfterDays: 180,
};

/** Parse a Skill's updated_at, which can be in either of two shapes:
 *  - SQLite native:  'YYYY-MM-DD HH:MM:SS'     (UTC, space-separated)
 *  - JS / API:       'YYYY-MM-DDTHH:MM:SS.sssZ' (ISO 8601)
 * Returns null when the input is unparseable (the row gets skipped, not
 * force-demoted — better safe than wrong).
 */
export function parseSkillTimestamp(updatedAt) {
  const raw = String(updatedAt ?? "").trim();
  if (!raw) return null;
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const iso = hasTz ? raw : raw.replace(" ", "T") + "Z";
  const ts = new Date(iso);
  return Number.isNaN(ts.getTime()) ? null : ts;
}

/** Compute the next status for a skill given its current status + updated_at.
 * Returns the new status or null when no transition is warranted.
 * Exported for unit testing.
 */
export function computeNextStatus(currentStatus, updatedAt) {
  if (currentStatus === "pinned" || currentStatus === "archived") return null;
  const ts = parseSkillTimestamp(updatedAt);
  if (!ts) return null;
  const ageDays = (Date.now() - ts.getTime()) / DAY_MS;
  if (currentStatus === "active" && ageDays >= THRESHOLDS.watchAfterDays) return "watch";
  if (currentStatus === "watch" && ageDays >= THRESHOLDS.staleAfterDays) return "stale";
  if (currentStatus === "stale" && ageDays >= THRESHOLDS.archiveAfterDays) return "archived";
  return null;
}

/** Which threshold (in days) was crossed for a given transition. */
function thresholdForTransition(currentStatus, nextStatus) {
  if (currentStatus === "active" && nextStatus === "watch") return THRESHOLDS.watchAfterDays;
  if (currentStatus === "watch" && nextStatus === "stale") return THRESHOLDS.staleAfterDays;
  if (currentStatus === "stale" && nextStatus === "archived") return THRESHOLDS.archiveAfterDays;
  return 0;
}

/**
 * Cross-instance lock for runCurator().
 *
 * Multiple Node processes sharing one SQLite file (dev-server HMR +
 * background worker, or PM2 cluster mode) all want to run the
 * periodic curator pass. Without coordination each instance would
 * scan + UPDATE + write evolution_logs, producing duplicate logs.
 *
 * The lock is a single-row table (id='singleton') holding
 * `last_run_at` + the running instance's pid/token. Acquiring
 * succeeds when EITHER the row doesn't exist yet OR last_run_at is
 * older than `cooldownMs`. This is intentionally optimistic: even
 * if two instances race past the check at the exact same instant,
 * the SQLite UPDATE is atomic and only one row gets the new
 * `last_run_at`; the loser observes `last_run_at` already moved and
 * re-tries — finding it newer than `now - cooldownMs` and skipping.
 *
 * Returns true if the caller may proceed with the curator pass,
 * false if another instance holds the lock inside the cooldown.
 */
export function acquireCuratorLock({ cooldownMs = 24 * 60 * 60 * 1000 } = {}) {
  const nowIso = new Date().toISOString();
  const token = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // INSERT the singleton row if absent.
  db.prepare(`
    INSERT OR IGNORE INTO curator_lock (id, last_run_at, last_pid, last_token)
    VALUES ('singleton', '1970-01-01T00:00:00.000Z', 0, '')
  `).run();
  // Atomically claim the lock if the cooldown has elapsed.
  const cutoffIso = new Date(Date.now() - cooldownMs).toISOString();
  const result = db.prepare(`
    UPDATE curator_lock
    SET last_run_at = ?, last_pid = ?, last_token = ?
    WHERE id = 'singleton' AND last_run_at < ?
  `).run(nowIso, process.pid, token, cutoffIso);
  return result.changes === 1;
}

/**
 * Single pass: scan all non-terminal Skills, demote as needed.
 * Returns a summary { promotedToWatch, demotedToStale, demotedToArchived,
 * skipped (lock not acquired), errors }.
 */
export function runCurator() {
  // Cheap fast-path: every caller checks the lock first so the common
  // case (another instance just ran) does no work.
  if (!acquireCuratorLock()) {
    return { promotedToWatch: 0, demotedToStale: 0, demotedToArchived: 0, skipped: true, errors: [] };
  }

  const rows = db.prepare(
    "SELECT id, name, status, updated_at FROM skills WHERE status NOT IN ('pinned', 'archived')"
  ).all();

  const promote = db.prepare(
    "UPDATE skills SET status = ?, updated_at = ? WHERE id = ?"
  );
  const insertLog = db.prepare(
    "INSERT INTO evolution_logs (id, type, skill_name, description) VALUES (?, ?, ?, ?)"
  );

  const summary = { promotedToWatch: 0, demotedToStale: 0, demotedToArchived: 0, errors: [] };
  for (const row of rows) {
    try {
      const next = computeNextStatus(row.status, row.updated_at);
      if (!next) continue;
      promote.run(next, new Date().toISOString(), row.id);
      const eventType =
        next === "watch" ? "skill_updated" :
        next === "stale" ? "skill_updated" :
        "skill_archived";
      const threshold = thresholdForTransition(row.status, next);
      insertLog.run(
        `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        eventType,
        row.name,
        `Curator：${row.status} → ${next}（超过 ${threshold} 天未更新）`
      );
      if (next === "watch") summary.promotedToWatch++;
      else if (next === "stale") summary.demotedToStale++;
      else if (next === "archived") summary.demotedToArchived++;
    } catch (e) {
      summary.errors.push({ id: row.id, error: e.message });
    }
  }
  return summary;
}

/**
 * Schedule periodic curator runs. Returns the timer handle so callers
 * (tests, hot reload) can stop it.
 *
 * Default interval is 24h. The interval is capped at 24h because
 * setInterval's max value is ~24.8 days; longer intervals would just
 * be clipped to ~24.8 days anyway, so we standardise.
 */
export function startCuratorLoop(intervalMs = 24 * 60 * 60 * 1000) {
  const capped = Math.min(Math.max(intervalMs, 1000), 24 * 60 * 60 * 1000);
  // First pass: small delay so the rest of the server boot can finish
  // and any startup error can surface before we touch the DB.
  const initial = setTimeout(() => {
    try {
      const result = runCurator();
      if (result.skipped) {
        console.log("[Curator] skipped — another instance holds the lock");
      } else if (result.promotedToWatch || result.demotedToStale || result.demotedToArchived) {
        console.log(
          `[Curator] promotedToWatch=${result.promotedToWatch} ` +
          `demotedToStale=${result.demotedToStale} ` +
          `demotedToArchived=${result.demotedToArchived}`
        );
      } else {
        console.log("[Curator] no transitions needed");
      }
    } catch (e) {
      console.error("[Curator] initial run failed:", e);
    }
  }, 5_000);
  const loop = setInterval(() => {
    try {
      runCurator();
    } catch (e) {
      console.error("[Curator] periodic run failed:", e);
    }
  }, capped);
  return { initial, loop, stop: () => { clearTimeout(initial); clearInterval(loop); } };
}
