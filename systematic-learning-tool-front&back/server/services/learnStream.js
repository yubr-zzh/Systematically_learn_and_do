// ============================================================
// Learn report generation as an EventEmitter
// Lets SSE handlers stream progress/complete/error to the client
// without changing the underlying AI call (which has no internal
// progress hooks). Progress is faked from elapsed time as a stop-gap;
// switch to real token-stream progress when aiService gains it.
// ============================================================

import { EventEmitter } from "node:events";
import { runLearnAnalysis } from "./aiService.js";

// Tunable: how long we expect a typical generation to take.
// Progress is interpolated linearly across this window.
const EXPECTED_DURATION_MS = 30_000;
// Emit a progress update at most this often (avoid flooding the client).
const PROGRESS_TICK_MS = 1_500;
// Heartbeat: keep the SSE channel alive while the AI call is still in
// flight even after progress has plateaued at 85%. Clients reset their
// stale-detection timer on every 'progress' event, so without this any
// generation longer than EXPECTED_DURATION_MS + small fudge would trip
// the client-side "stuck" badge even though the server is healthy.
const HEARTBEAT_TICK_MS = 5_000;

function interpolateProgress(startTs) {
  const elapsed = Date.now() - startTs;
  const ratio = Math.min(1, elapsed / EXPECTED_DURATION_MS);
  // 0..85% from elapsed time, the remaining 15% jumps on 'complete'.
  return Math.round(ratio * 85);
}

export function streamLearnAnalysis(subject, category, options = {}) {
  const emitter = new EventEmitter();
  const startTs = Date.now();

  // Periodic progress ticks until the AI call resolves.
  const tick = setInterval(() => {
    emitter.emit("progress", { progress: interpolateProgress(startTs) });
  }, PROGRESS_TICK_MS);

  // Once we've plateaued at 85%, the AI call may still take much longer
  // (real-world DeepSeek responses: 60–120s). Heartbeat so the SSE
  // client knows the stream is still alive.
  const heartbeat = setInterval(() => {
    emitter.emit("progress", { progress: interpolateProgress(startTs) });
  }, HEARTBEAT_TICK_MS);

  runLearnAnalysis(subject, category, options)
    .then((result) => {
      clearInterval(tick);
      clearInterval(heartbeat);
      emitter.emit("progress", { progress: 100 });
      emitter.emit("complete", {
        content: result.content,
        wordCount: result.wordCount,
        researchMeta: result.researchMeta,
      });
    })
    .catch((err) => {
      clearInterval(tick);
      clearInterval(heartbeat);
      emitter.emit("error", { message: err?.message || String(err) });
    })
    .finally(() => {
      // Close after a tick so any final 'progress' reaches the client.
      setImmediate(() => emitter.emit("end"));
    });

  return emitter;
}
