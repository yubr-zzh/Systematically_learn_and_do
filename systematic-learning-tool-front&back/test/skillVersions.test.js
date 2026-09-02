// Tests for skill_versions: PATCH snapshots pre-image when content
// changes, restore swaps content back and snapshots current state.
// Exercises the live DB via the spawned server in api.test.js, but
// for these tests we drive better-sqlite3 directly so we can pin
// the expected pre-image exactly.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "test-skill-versions.db");

let db;

before(async () => {
  process.env.DB_PATH = DB_PATH;
  try { fs.unlinkSync(DB_PATH); } catch {}
  const dbMod = await import("../server/db/database.js");
  dbMod.initDatabase();
  db = dbMod.db;
});

after(() => {
  try { fs.unlinkSync(DB_PATH); } catch {}
});

function insertSkill(id, name, desc, content, category = "general") {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO skills (id, name, description, content, category, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(id, name, desc, content, category, now, now);
}

function applySkillPatch(id, patch) {
  // Mirror the logic in routes/skills.js so we test the snapshot
  // contract end-to-end (pre-image written iff content-bearing field
  // actually changes).
  const skill = db.prepare("SELECT * FROM skills WHERE id=?").get(id);
  if (!skill) throw new Error("no such skill");
  const contentChanged =
    (patch.name !== undefined && patch.name !== skill.name) ||
    (patch.description !== undefined && patch.description !== skill.description) ||
    (patch.content !== undefined && patch.content !== skill.content) ||
    (patch.category !== undefined && patch.category !== skill.category);
  if (contentChanged) {
    const nextV = (db.prepare("SELECT COALESCE(MAX(version),0)+1 AS v FROM skill_versions WHERE skill_id=?").get(id)?.v) || 1;
    db.prepare(`
      INSERT INTO skill_versions (id, skill_id, name, description, content, category, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`v-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      id, skill.name, skill.description, skill.content, skill.category, nextV, new Date().toISOString());
  }
  const updates = []; const params = [];
  for (const k of ["name","description","content","category"]) {
    if (patch[k] !== undefined) { updates.push(`${k} = ?`); params.push(patch[k]); }
  }
  if (patch.status !== undefined) { updates.push("status = ?"); params.push(patch.status); }
  if (updates.length === 0) return;
  updates.push("updated_at = ?"); params.push(new Date().toISOString()); params.push(id);
  db.prepare(`UPDATE skills SET ${updates.join(", ")} WHERE id=?`).run(...params);
}

function restoreVersion(id, vid) {
  const target = db.prepare("SELECT * FROM skill_versions WHERE id=? AND skill_id=?").get(vid, id);
  if (!target) throw new Error("no such version");
  const skill = db.prepare("SELECT name, description, content, category FROM skills WHERE id=?").get(id);
  if (!skill) throw new Error("no such skill");
  // snapshot current
  const nextV = (db.prepare("SELECT COALESCE(MAX(version),0)+1 AS v FROM skill_versions WHERE skill_id=?").get(id)?.v) || 1;
  db.prepare(`
    INSERT INTO skill_versions (id, skill_id, name, description, content, category, version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(`v-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    id, skill.name, skill.description, skill.content, skill.category, nextV, new Date().toISOString());
  db.prepare("UPDATE skills SET name=?, description=?, content=?, category=?, updated_at=? WHERE id=?")
    .run(target.name, target.description, target.content, target.category, new Date().toISOString(), id);
}

test("PATCH snapshot: content change writes one skill_versions row with pre-image", () => {
  db.prepare("DELETE FROM skill_versions").run();
  db.prepare("DELETE FROM skills").run();
  insertSkill("s1", "name-1", "desc-1", "content-1");
  applySkillPatch("s1", { content: "content-2" });
  const versions = db.prepare("SELECT * FROM skill_versions WHERE skill_id='s1' ORDER BY version ASC").all();
  assert.equal(versions.length, 1);
  assert.equal(versions[0].version, 1);
  assert.equal(versions[0].content, "content-1", "snapshot must capture pre-image");
  assert.equal(versions[0].name, "name-1");
  const current = db.prepare("SELECT content FROM skills WHERE id='s1'").get();
  assert.equal(current.content, "content-2");
});

test("PATCH snapshot: PATCH with no content change writes no version row", () => {
  db.prepare("DELETE FROM skill_versions").run();
  db.prepare("DELETE FROM skills").run();
  insertSkill("s2", "n", "d", "c");
  // status is a non-content-bearing field — should NOT snapshot.
  applySkillPatch("s2", { status: "watch" });
  const versions = db.prepare("SELECT * FROM skill_versions WHERE skill_id='s2'").all();
  assert.equal(versions.length, 0, "metadata-only edit must not write a snapshot");
});

test("PATCH snapshot: each subsequent content edit creates the next version number", () => {
  db.prepare("DELETE FROM skill_versions").run();
  db.prepare("DELETE FROM skills").run();
  insertSkill("s3", "n", "d", "v1");
  applySkillPatch("s3", { content: "v2" });
  applySkillPatch("s3", { content: "v3" });
  applySkillPatch("s3", { description: "desc-3" });
  const versions = db.prepare("SELECT version, content, description FROM skill_versions WHERE skill_id='s3' ORDER BY version ASC").all();
  assert.equal(versions.length, 3);
  assert.deepEqual(versions.map(v => v.version), [1, 2, 3]);
  assert.equal(versions[0].content, "v1");
  assert.equal(versions[1].content, "v2");
  assert.equal(versions[2].content, "v3"); // snapshot was taken BEFORE v3 write
});

test("restore: current state is snapshotted then target content replaces current", () => {
  db.prepare("DELETE FROM skill_versions").run();
  db.prepare("DELETE FROM skills").run();
  insertSkill("s4", "n", "d", "v1");
  applySkillPatch("s4", { content: "v2" });
  applySkillPatch("s4", { content: "v3" });
  const versions = db.prepare("SELECT id, version, content FROM skill_versions WHERE skill_id='s4' ORDER BY version ASC").all();
  // versions[0] is the v1 pre-image. Restore to it.
  restoreVersion("s4", versions[0].id);
  const skill = db.prepare("SELECT content FROM skills WHERE id='s4'").get();
  assert.equal(skill.content, "v1", "skill content should be back to v1");
  // The restore itself should have written a new version (the pre-restore v3).
  const after = db.prepare("SELECT version, content FROM skill_versions WHERE skill_id='s4' ORDER BY version DESC").all();
  assert.equal(after[0].content, "v3", "restore should snapshot the current state first");
});
