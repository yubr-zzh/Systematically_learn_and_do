import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(__dirname, "..");

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
  throw new Error("server did not become ready within " + maxMs + "ms");
}

before(async () => {
  // Pick a high port to avoid colliding with the dev server on 3001.
  const port = 3171 + Math.floor(Math.random() * 100);
  baseUrl = `http://localhost:${port}`;
  serverProc = spawn(process.execPath, ["server/index.js"], {
    cwd: PROJECT,
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(PROJECT, "data", "system-test.db") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Unref so the test can exit even if the child hasn't shut down.
  serverProc.unref();
  await waitForServer();
});

after(async () => {
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
  }
});

test("/api/health returns 200 with both checks ok", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks.db.ok, true);
  assert.equal(body.checks.aiKey.ok, true);
  assert.match(body.timestamp, /T.+Z/);
});

test("/api/health returns X-Request-Id header", async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.ok(res.headers.get("x-request-id"), "X-Request-Id header missing");
});

test("/api/research/search returns explicit unavailable state without a provider", async () => {
  const res = await fetch(`${baseUrl}/api/research/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "current test query" }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.query, "current test query");
  assert.equal(typeof body.available, "boolean");
  assert.ok(Array.isArray(body.results));
});

test("POST /api/learn with missing subject -> 400 with details", async () => {
  const res = await fetch(`${baseUrl}/api/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "general" }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.details.join(";"), /subject/);
});

test("POST /api/learn with bad category -> 400", async () => {
  const res = await fetch(`${baseUrl}/api/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: "X", category: "banana" }),
  });
  assert.equal(res.status, 400);
});

test("POST /api/learn with valid body -> 201 with id", async () => {
  const res = await fetch(`${baseUrl}/api/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: "Integration", category: "general" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.id, "response missing id");
});

test("GET /api/learn returns array", async () => {
  const res = await fetch(`${baseUrl}/api/learn`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

test("POST /api/projects with bad type -> 400", async () => {
  const res = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "X", description: "d", type: "banana" }),
  });
  assert.equal(res.status, 400);
});

test("POST /api/feedback with rating=7 -> 400", async () => {
  const res = await fetch(`${baseUrl}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportTitle: "X", rating: 7 }),
  });
  assert.equal(res.status, 400);
});

test("POST /api/skills missing content -> 400", async () => {
  const res = await fetch(`${baseUrl}/api/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "X", description: "d" }),
  });
  assert.equal(res.status, 400);
});

test("PATCH /api/settings with bad theme -> 400", async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: "neon" }),
  });
  assert.equal(res.status, 400);
});

test("rate limit: rapid requests eventually 429", async () => {
  // Spin up a child with a tiny limit so this test runs fast.
  const port = 3271 + Math.floor(Math.random() * 100);
  const url = `http://localhost:${port}`;
  const proc = spawn(process.execPath, ["server/index.js"], {
    cwd: PROJECT,
    env: { ...process.env, PORT: String(port), RATE_LIMIT_MAX: "5", DB_PATH: path.join(PROJECT, "data", "system-rl.db") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.unref();
  // Wait for ready
  const start = Date.now();
  while (Date.now() - start < 8000) {
    try { const r = await fetch(`${url}/api/health`); if (r.status) break; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  let saw429 = false;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${url}/api/learn`);
    if (r.status === 429) { saw429 = true; break; }
  }
  proc.kill();
  assert.ok(saw429, "should have observed a 429 within 20 rapid requests");
});
