// ============================================================
// Report process lifecycle
// ============================================================
//
// A learn_report stays in 'generating' until its AI emitter resolves.
// If the server crashes or is restarted mid-generation, the emitter
// vanishes but the row keeps status='generating' forever — clients
// reconnecting to the SSE endpoint just sit on a now-silent poll.
//
// To recover without restarting the AI (which we can't safely do
// anyway — we lost the emitter), we track each in-flight report as
// a row in `report_processes` keyed by report_id. The emitter pings
// `heartbeat_at` on every event. On server boot we delete heartbeat
// rows older than `ORPHAN_HEARTBEAT_MS` and mark the corresponding
// learn_reports status='error' so the UI can render a clear failure.
//
// This does NOT restart the AI. That is a separate (intentionally
// separate) concern; restarting AI on boot risks spawning duplicate
// generators for the same report when the original process is just
// slow. Marking orphan='error' leaves the door open for the user to
// re-trigger via a fresh POST /api/learn.

import { db } from "../db/database.js";

export const ORPHAN_HEARTBEAT_MS = 60_000;

/** Heartbeat the in-flight process for a report. Called from the emitter. */
export function touchReportProcess(reportId) {
  db.prepare(
    "UPDATE report_processes SET heartbeat_at = ? WHERE report_id = ?"
  ).run(new Date().toISOString(), reportId);
}

/** Register a freshly spawned emitter. Replaces any stale row for this report. */
export function registerReportProcess(reportId, pid = process.pid) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO report_processes (report_id, pid, started_at, heartbeat_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(report_id) DO UPDATE SET
      pid = excluded.pid,
      started_at = excluded.started_at,
      heartbeat_at = excluded.heartbeat_at
  `).run(reportId, pid, now, now);
}

/** Remove the process row for a report (terminal state reached). */
export function unregisterReportProcess(reportId) {
  db.prepare("DELETE FROM report_processes WHERE report_id = ?").run(reportId);
}

/**
 * Reap orphan processes whose heartbeat is older than the threshold,
 * and mark their learn_reports as 'error' so the UI stops spinning.
 *
 * Returns { reapedProcesses, orphanedReports, errors }. Pure: callers
 * (index.js boot, optional cron later) can ignore the return.
 */
export function reapOrphanProcesses({
  heartbeatMs = ORPHAN_HEARTBEAT_MS,
  now = Date.now(),
} = {}) {
  const summary = { reapedProcesses: 0, orphanedReports: 0, errors: [] };

  // 1. Find candidate processes: heartbeat older than threshold.
  const stale = db.prepare(`
    SELECT rp.report_id, rp.pid, rp.heartbeat_at
    FROM report_processes rp
    WHERE rp.heartbeat_at IS NOT NULL
      AND (CAST(strftime('%s', ?) AS INTEGER) - CAST(strftime('%s', rp.heartbeat_at) AS INTEGER)) * 1000 > ?
  `).all(new Date(now).toISOString(), heartbeatMs);

  if (stale.length === 0) return summary;

  const deleteProc = db.prepare("DELETE FROM report_processes WHERE report_id = ?");
  const orphanReport = db.prepare(`
    UPDATE learn_reports
    SET status = 'error', progress = 0, updated_at = ?
    WHERE id = ? AND status = 'generating'
  `);
  const insertLog = db.prepare(`
    INSERT INTO evolution_logs (id, type, subject, description)
    VALUES (?, 'report_orphaned', ?, ?)
  `);

  // Wrap in a transaction so a half-reaped boot never leaves the DB
  // in a state where the row is dead but the report still claims
  // 'generating'.
  const run = db.transaction(() => {
    for (const row of stale) {
      try {
        // Update only counts if the WHERE clause matches. A stale
        // process row whose report is already terminal (completed /
        // error / archived) intentionally does NOT get re-flagged.
        const result = orphanReport.run(new Date(now).toISOString(), row.report_id);
        deleteProc.run(row.report_id);
        if (result.changes > 0) {
          insertLog.run(
            `log-orphan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            row.report_id,
            `Reaped orphan process (pid=${row.pid}, last heartbeat ${row.heartbeat_at}). Report marked 'error'.`
          );
          summary.orphanedReports++;
        }
        summary.reapedProcesses++;
      } catch (e) {
        summary.errors.push({ reportId: row.report_id, error: e.message });
      }
    }
  });
  run();
  return summary;
}
