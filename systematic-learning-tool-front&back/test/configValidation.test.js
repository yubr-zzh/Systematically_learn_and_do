// Tests for the prod-strict config validator. We snapshot the env
// vars we care about, point them at throwaway values, and call
// validateConfig directly. No server boot involved — that would
// hit the DB.
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";

const SAVED = {};
function snapshotEnv() {
  // Strip any value the dev .env file pre-loaded before we snapshot.
  // Otherwise the afterEach restore puts it back and the next test's
  // hand-built cfg picks it up via process.env, defeating the test.
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.API_KEY;
  for (const k of ["NODE_ENV","DEEPSEEK_API_KEY","API_BASE_URL","WEB_SEARCH_PROVIDER","API_KEY"]) {
    SAVED[k] = process.env[k];
  }
}
function restoreEnv() {
  for (const k of Object.keys(SAVED)) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  }
}

before(snapshotEnv);
afterEach(restoreEnv);

// The config.js top-level runs dotenv.config which writes the dev
// .env DEEPSEEK_API_KEY into process.env every import. We pre-strip
// it before importing (and after, just in case) so the cfg we hand
// build from process.env reflects only what each test sets.
async function loadConfigFresh() {
  const before = {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    API_KEY: process.env.API_KEY,
  };
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.API_KEY;
  const cfgMod = await import(`../server/config.js?v=${Date.now()}-${Math.random()}`);
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.API_KEY;
  if (before.DEEPSEEK_API_KEY !== undefined) process.env.DEEPSEEK_API_KEY = before.DEEPSEEK_API_KEY;
  if (before.API_KEY !== undefined) process.env.API_KEY = before.API_KEY;
  const nodeEnv = process.env.NODE_ENV || "development";
  const apiBaseUrl = process.env.API_BASE_URL || "https://api.deepseek.com/v1";
  const webSearchProvider = (process.env.WEB_SEARCH_PROVIDER || "auto").toLowerCase();
  return {
    cfg: {
      nodeEnv,
      apiKey: process.env.DEEPSEEK_API_KEY || process.env.API_KEY || "",
      apiBaseUrl,
      webSearchProvider,
    },
    validateConfig: cfgMod.validateConfig,
  };
}

test("validateConfig: production with placeholder key returns ok=false", async () => {
  process.env.NODE_ENV = "production";
  process.env.API_BASE_URL = "https://api.deepseek.com/v1";
  process.env.WEB_SEARCH_PROVIDER = "auto";
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.API_KEY;
  const cfg = await loadConfigFresh();
  const v = cfg.validateConfig(cfg.cfg);
  assert.equal(v.ok, false);
  assert.ok(v.problems.length >= 1);
  assert.match(v.problems[0], /DEEPSEEK_API_KEY/);
});

test("validateConfig: production with valid key returns ok=true", async () => {
  process.env.NODE_ENV = "production";
  process.env.API_BASE_URL = "https://api.deepseek.com/v1";
  process.env.WEB_SEARCH_PROVIDER = "auto";
  process.env.DEEPSEEK_API_KEY = "sk-this-is-a-real-looking-key-1234567890abcdef";
  const cfg = await loadConfigFresh();
  const v = cfg.validateConfig(cfg.cfg);
  assert.equal(v.ok, true);
  assert.deepEqual(v.problems, []);
});

test("validateConfig: catches half-typed sk- prefix key", async () => {
  process.env.NODE_ENV = "production";
  process.env.API_BASE_URL = "https://api.deepseek.com/v1";
  process.env.WEB_SEARCH_PROVIDER = "auto";
  process.env.DEEPSEEK_API_KEY = "sk-1234";  // too short
  const cfg = await loadConfigFresh();
  const v = cfg.validateConfig(cfg.cfg);
  assert.equal(v.ok, false);
  assert.match(v.problems[0], /DEEPSEEK_API_KEY/);
});

test("validateConfig: rejects bogus WEB_SEARCH_PROVIDER value", async () => {
  process.env.NODE_ENV = "production";
  process.env.API_BASE_URL = "https://api.deepseek.com/v1";
  process.env.WEB_SEARCH_PROVIDER = "yandex";
  process.env.DEEPSEEK_API_KEY = "sk-this-is-a-real-looking-key-1234567890abcdef";
  const cfg = await loadConfigFresh();
  const v = cfg.validateConfig(cfg.cfg);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some(p => /WEB_SEARCH_PROVIDER/.test(p)));
});

test("validateConfig: rejects non-http API_BASE_URL", async () => {
  process.env.NODE_ENV = "production";
  process.env.API_BASE_URL = "ftp://example.com";
  process.env.WEB_SEARCH_PROVIDER = "auto";
  process.env.DEEPSEEK_API_KEY = "sk-this-is-a-real-looking-key-1234567890abcdef";
  const cfg = await loadConfigFresh();
  const v = cfg.validateConfig(cfg.cfg);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some(p => /API_BASE_URL/.test(p)));
});
