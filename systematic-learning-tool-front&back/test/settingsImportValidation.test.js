// End-to-end test for POST /api/settings/import row-level validation.
// We spawn a child server with a temp DB and exercise the live route
// the way api.test.js does, but focus on the row-level rejection
// path which that suite does not cover.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, "..");
const DB_PATH = path.join(PROJECT, "data", "test-import-validation.db");

let serverProc;
let baseUrl;

async function waitForServer(maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status === 200 || res.status === 503) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("server did not become ready");
}

before(async () => {
  try { fs.unlinkSync(DB_PATH); } catch {}
  const port = 3471 + Math.floor(Math.random() * 100);
  baseUrl = `http://localhost:${port}`;
  serverProc = spawn(process.execPath, ["server/index.js"], {
    cwd: PROJECT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH,
      // Use a placeholder AI key so the route still boots; we never
      // make AI calls in this test.
      DEEPSEEK_API_KEY: "sk-test-placeholder-for-import-validation-only",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProc.unref();
  await waitForServer();
});

after(() => {
  if (serverProc && !serverProc.killed) serverProc.kill();
  try { fs.unlinkSync(DB_PATH); } catch {}
});

const VALID_BASE = {
  reports: [],
  projects: [],
  feedback: [],
  skills: [],
};

function importOnce(payload) {
  return fetch(`${baseUrl}/api/settings/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { version: 1, data: payload } }),
  });
}

test("import with valid rows succeeds", async () => {
  const res = await importOnce({
    ...VALID_BASE,
    reports: [{
      id: "r1", title: "t", subject: "S", category: "general",
      status: "completed", progress: 100, content: "x",
      favorite: false, word_count: 1, created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }],
  });
  if (res.status !== 200) {
    console.error("DEBUG body:", await res.text());
  }
  assert.equal(res.status, 200);
});

test("import with bogus report status -> 400 listing the offending row", async () => {
  const res = await importOnce({
    ...VALID_BASE,
    reports: [{
      id: "r-bad", title: "t", subject: "S", category: "general",
      status: "PWNED", progress: 50, content: "x",
      favorite: 0, word_count: 1, created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.details.join("; "), /reports\[0\]: status/);
});

test("import with bogus project type -> 400", async () => {
  const res = await importOnce({
    ...VALID_BASE,
    projects: [{
      id: "p-bad", name: "P", description: "d", type: "evil",
      status: "planning", progress: 0, content: "", cover: 0, word_count: 0,
      due_date: null, start_date: null, ref_link: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      tasks: [], milestones: [],
    }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.details.join("; "), /projects\[0\]: type/);
});

test("import with bad feedback rating -> 400", async () => {
  const res = await importOnce({
    ...VALID_BASE,
    feedback: [{
      id: "f1", report_id: null, report_title: "X",
      rating: 99, strengths: "", improvements: "", comment: "",
      created_at: new Date().toISOString(),
    }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.details.join("; "), /feedback\[0\]: rating/);
});

test("import with bad skill status -> 400", async () => {
  const res = await importOnce({
    ...VALID_BASE,
    skills: [{
      id: "s1", name: "sk", description: "d", content: "c",
      category: "general", status: "evil", usage_count: 0, rating: 0,
      version: 1, author: "user", tags: "[]",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.details.join("; "), /skills\[0\]: status/);
});

test("import with bad task in projects[0].tasks[1] -> 400 with index in path", async () => {
  const res = await importOnce({
    ...VALID_BASE,
    projects: [{
      id: "p1", name: "P", description: "d", type: "general",
      status: "planning", progress: 0, content: "", cover: 0, word_count: 0,
      due_date: null, start_date: null, ref_link: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      tasks: [
        { id: "t1", title: "ok", phase: "准备" },
        { id: "t2", title: "", phase: "准备" }, // blank title
      ],
      milestones: [],
    }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.details.join("; "), /projects\[0\]\.tasks\[1\]: title/);
});

test("failed import does not partially write (transaction)", async () => {
  // First import a valid report, then an invalid one alongside it.
  // If validation happens after the transaction started, the valid
  // row would already be persisted; we verify it is NOT.
  const validId = "r-valid-must-not-leak";
  const tx = await fetch(`${baseUrl}/api/settings/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { version: 1, data: {
      ...VALID_BASE,
      reports: [
        { id: validId, title: "t", subject: "S", category: "general",
          status: "completed", progress: 100, content: "x",
          favorite: false, word_count: 1, created_at: new Date().toISOString(),
          updated_at: new Date().toISOString() },
        // Now an invalid one in the same batch.
        { id: "r-bad2", title: "t", subject: "S", category: "general",
          status: "TOTALLY_BOGUS", progress: 0, content: "x",
          favorite: 0, word_count: 1, created_at: new Date().toISOString(),
          updated_at: new Date().toISOString() },
      ],
    } } }),
  });
  assert.equal(tx.status, 400, "must reject the batch when any row fails");
  // Now confirm the valid row is NOT present (transaction never committed).
  const list = await fetch(`${baseUrl}/api/learn`);
  const all = await list.json();
  assert.equal(all.find(r => r.id === validId), undefined,
    "failed batch must not partially write");
});
