// Tests for the curator cross-instance lock. Uses the same throwaway
// DB file under data/. We exercise acquireCuratorLock + runCurator
// directly to verify the lock protocol.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "test-curator-lock.db");

let db;
let acquireCuratorLock, runCurator;

before(async () => {
  process.env.DB_PATH = DB_PATH;
  try { fs.unlinkSync(DB_PATH); } catch {}
  const dbMod = await import("../server/db/database.js");
  const curatorMod = await import("../server/services/curator.js");
  dbMod.initDatabase();
  db = dbMod.db;
  ({ acquireCuratorLock, runCurator } = curatorMod);
});

after(() => {
  try { fs.unlinkSync(DB_PATH); } catch {}
});

test("acquireCuratorLock: first caller succeeds", () => {
  // Reset state for this test.
  db.prepare("DELETE FROM curator_lock").run();
  const ok = acquireCuratorLock({ cooldownMs: 60_000 });
  assert.equal(ok, true);
  const row = db.prepare("SELECT last_pid, last_token FROM curator_lock WHERE id='singleton'").get();
  assert.equal(row.last_pid, process.pid);
  assert.match(row.last_token, /^tok-/);
});

test("acquireCuratorLock: second caller within cooldown is denied", () => {
  db.prepare("DELETE FROM curator_lock").run();
  const a = acquireCuratorLock({ cooldownMs: 60_000 });
  const b = acquireCuratorLock({ cooldownMs: 60_000 });
  assert.equal(a, true);
  assert.equal(b, false, "second caller inside cooldown should be denied");
});

test("acquireCuratorLock: caller succeeds again after cooldown elapses", () => {
  db.prepare("DELETE FROM curator_lock").run();
  // Push last_run_at far into the past so the cutoff check passes.
  const longAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  db.prepare("INSERT INTO curator_lock (id, last_run_at, last_pid, last_token) VALUES ('singleton', ?, 0, '')").run(longAgo);
  const ok = acquireCuratorLock({ cooldownMs: 60_000 });
  assert.equal(ok, true);
});

test("runCurator: skipped=true when lock not acquired; no DB writes", () => {
  db.prepare("DELETE FROM curator_lock").run();
  // Pretend a peer just ran 1s ago.
  const justNow = new Date(Date.now() - 1_000).toISOString();
  db.prepare("INSERT INTO curator_lock (id, last_run_at, last_pid, last_token) VALUES ('singleton', ?, 0, 'peer')").run(justNow);
  const beforeLogs = db.prepare("SELECT COUNT(*) AS n FROM evolution_logs").get().n;
  const result = runCurator();
  assert.equal(result.skipped, true);
  assert.equal(result.promotedToWatch + result.demotedToStale + result.demotedToArchived, 0);
  const afterLogs = db.prepare("SELECT COUNT(*) AS n FROM evolution_logs").get().n;
  assert.equal(afterLogs, beforeLogs, "skipped run must not write any evolution_logs");
});

test("runCurator: when lock acquired, performs its transitions normally", () => {
  db.prepare("DELETE FROM curator_lock").run();
  db.prepare("DELETE FROM skills").run();
  db.prepare("DELETE FROM evolution_logs").run();
  // Insert a skill whose updated_at is 31 days ago -> should demote active -> watch.
  const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO skills (id, name, description, content, category, status, updated_at)
    VALUES ('s1', 'old skill', 'd', 'c', 'general', 'active', ?)
  `).run(old);
  const result = runCurator();
  assert.equal(result.skipped, undefined, "lock should have been acquired");
  assert.equal(result.promotedToWatch, 1);
  const row = db.prepare("SELECT status FROM skills WHERE id='s1'").get();
  assert.equal(row.status, "watch");
});
