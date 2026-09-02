// Tests for the orphan-process reaper. Runs against a single
// throwaway SQLite file under data/. node --test executes tests
// sequentially within a file, so this is safe.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "test-reaper.db");

let db;
let registerReportProcess, touchReportProcess, unregisterReportProcess, reapOrphanProcesses;

before(async () => {
  process.env.DB_PATH = DB_PATH;
  try { fs.unlinkSync(DB_PATH); } catch {}
  const dbMod = await import("../server/db/database.js");
  const lifecycleMod = await import("../server/services/reportLifecycle.js");
  dbMod.initDatabase();
  db = dbMod.db;
  ({ registerReportProcess, touchReportProcess, unregisterReportProcess, reapOrphanProcesses } = lifecycleMod);
});

after(() => {
  try { fs.unlinkSync(DB_PATH); } catch {}
});

function insertReport(id, status = "generating") {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO learn_reports (id, title, subject, category, status, progress, created_at, updated_at)
    VALUES (?, 'T', 'T', 'general', ?, 0, ?, ?)
  `).run(id, status, now, now);
}

function clearTables() {
  db.prepare("DELETE FROM report_processes").run();
  db.prepare("DELETE FROM learn_reports").run();
  db.prepare("DELETE FROM evolution_logs").run();
}

test("reapOrphanProcesses: fresh heartbeat (now) is never reaped", () => {
  clearTables();
  insertReport("r-fresh");
  registerReportProcess("r-fresh");
  const result = reapOrphanProcesses();
  assert.equal(result.orphanedReports, 0);
  assert.equal(result.reapedProcesses, 0);
  const row = db.prepare("SELECT status, progress FROM learn_reports WHERE id='r-fresh'").get();
  assert.equal(row.status, "generating");
});

test("reapOrphanProcesses: stale heartbeat -> report marked 'error'", () => {
  clearTables();
  insertReport("r-stale");
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO report_processes (report_id, pid, started_at, heartbeat_at)
    VALUES (?, ?, ?, ?)
  `).run("r-stale", process.pid, fiveMinAgo, fiveMinAgo);

  const result = reapOrphanProcesses();
  assert.equal(result.orphanedReports, 1, "should orphan exactly one report");
  assert.equal(result.reapedProcesses, 1);

  const row = db.prepare("SELECT status, progress FROM learn_reports WHERE id='r-stale'").get();
  assert.equal(row.status, "error");
  assert.equal(row.progress, 0);

  const proc = db.prepare("SELECT * FROM report_processes WHERE report_id='r-stale'").get();
  assert.equal(proc, undefined, "process row should be deleted");

  const log = db.prepare("SELECT * FROM evolution_logs WHERE type='report_orphaned'").get();
  assert.ok(log, "should write an evolution log entry");
  assert.match(log.description, /Reaped orphan process/);
});

test("reapOrphanProcesses: already-completed report keeps its status", () => {
  clearTables();
  insertReport("r-done", "completed");
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO report_processes (report_id, pid, started_at, heartbeat_at)
    VALUES (?, ?, ?, ?)
  `).run("r-done", process.pid, old, old);
  const result = reapOrphanProcesses();
  // The process row IS stale, so it's reaped. But the report is
  // already terminal so its status must not flip to 'error'.
  assert.equal(result.reapedProcesses, 1);
  assert.equal(result.orphanedReports, 0);
  const row = db.prepare("SELECT status FROM learn_reports WHERE id='r-done'").get();
  assert.equal(row.status, "completed");
});

test("touchReportProcess resets heartbeat so reap skips", () => {
  clearTables();
  insertReport("r-touch");
  registerReportProcess("r-touch");
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  db.prepare("UPDATE report_processes SET heartbeat_at=? WHERE report_id='r-touch'").run(old);
  touchReportProcess("r-touch");
  const result = reapOrphanProcesses();
  assert.equal(result.orphanedReports, 0);
  const row = db.prepare("SELECT status FROM learn_reports WHERE id='r-touch'").get();
  assert.equal(row.status, "generating");
});

test("unregisterReportProcess removes the row", () => {
  clearTables();
  insertReport("r-unreg");
  registerReportProcess("r-unreg");
  unregisterReportProcess("r-unreg");
  const proc = db.prepare("SELECT * FROM report_processes WHERE report_id='r-unreg'").get();
  assert.equal(proc, undefined);
});
