// Tests for aiService.callAIStream. We don't hit the real DeepSeek API;
// instead we mock globalThis.fetch with a ReadableStream that emits
// the SSE chunks the server would produce. This validates the SSE
// framing parser, the [DONE] sentinel, and the onChunk callback
// contract that the rest of the progress pipeline depends on.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "test-ai-stream.db");

let callAIStream;

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body,
    text: async () => "",
  };
}

before(async () => {
  process.env.DB_PATH = DB_PATH;
  process.env.API_BASE_URL = "https://fake.test/v1";
  process.env.API_KEY = "sk-test-fake-key-for-stream-tests";
  try { fs.unlinkSync(DB_PATH); } catch {}
  const dbMod = await import("../server/db/database.js");
  dbMod.initDatabase();
  const ai = await import("../server/services/aiService.js");
  callAIStream = ai.callAIStream;
});

after(() => {
  try { fs.unlinkSync(DB_PATH); } catch {}
  delete globalThis.fetch;
});

function mockFetchWith(chunks) {
  globalThis.fetch = async () => sseResponse(chunks);
}

test("callAIStream: concatenates delta content from SSE chunks", async () => {
  mockFetchWith([
    'data: {"choices":[{"delta":{"content":"hello "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
    'data: [DONE]\n\n',
  ]);
  const out = await callAIStream(
    [{ role: "user", content: "x" }],
    { maxTokens: 10, stage: "analysis" },
    null
  );
  assert.equal(out, "hello world");
});

test("callAIStream: invokes onChunk for each delta with running accumulated", async () => {
  mockFetchWith([
    'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"bc"}}]}\n\n',
    'data: [DONE]\n\n',
  ]);
  const calls = [];
  const out = await callAIStream(
    [{ role: "user", content: "x" }],
    { maxTokens: 10, stage: "research" },
    ({ delta, accumulated, stage }) => calls.push({ delta, accumulated, stage })
  );
  assert.equal(out, "abc");
  // Filter out the trailing "" final-flush delta — callAIStream emits
  // it once at [DONE] / end-of-stream so callers know the call has
  // completed. The contract: at least one call per real delta + a
  // final flush with delta=="" and accumulated == final answer.
  const realCalls = calls.filter(c => c.delta !== "");
  const finalCall = calls[calls.length - 1];
  assert.deepEqual(realCalls.map(c => c.delta), ["a", "bc"]);
  assert.deepEqual(realCalls.map(c => c.accumulated), ["a", "abc"]);
  assert.equal(finalCall.delta, "", "final flush has empty delta");
  assert.equal(finalCall.accumulated, "abc");
  for (const c of calls) assert.equal(c.stage, "research");
});

test("callAIStream: handles chunks split across network reads", async () => {
  // Two events concatenated into one network read, then [DONE] alone.
  // Verifies the buffer-based parser correctly handles partial lines.
  mockFetchWith([
    'data: {"choices":[{"delta":{"content":"part1"}}]}\n\ndata: {"choices":[{"delta":{"content":"part2"}}]}\n\n',
    'data: [DONE]\n\n',
  ]);
  const out = await callAIStream(
    [{ role: "user", content: "x" }],
    { maxTokens: 10, stage: "planning" },
    null
  );
  assert.equal(out, "part1part2");
});

test("callAIStream: returns accumulated even when stream closes without [DONE]", async () => {
  mockFetchWith([
    'data: {"choices":[{"delta":{"content":"only chunk"}}]}\n\n',
  ]);
  const out = await callAIStream(
    [{ role: "user", content: "x" }],
    { maxTokens: 10 },
    null
  );
  assert.equal(out, "only chunk");
});

test("callAIStream: malformed JSON chunk is skipped, not fatal", async () => {
  mockFetchWith([
    'data: {"choices":[{"delta":{"content":"keep1"}}]}\n\n',
    'data: this is not json\n\n',
    'data: {"choices":[{"delta":{"content":"keep2"}}]}\n\n',
    'data: [DONE]\n\n',
  ]);
  const out = await callAIStream(
    [{ role: "user", content: "x" }],
    { maxTokens: 10 },
    null
  );
  assert.equal(out, "keep1keep2");
});

test("callAIStream: throws on non-OK HTTP response", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    body: null,
    text: async () => "Unauthorized",
  });
  await assert.rejects(
    () => callAIStream([{ role: "user", content: "x" }], { maxTokens: 10 }),
    /AI API error: 401/
  );
});


