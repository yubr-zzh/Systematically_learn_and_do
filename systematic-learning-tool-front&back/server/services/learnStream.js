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

  runLearnAnalysis(subject, category, options)
    .then((result) => {
      clearInterval(tick);
      emitter.emit("progress", { progress: 100 });
      emitter.emit("complete", {
        content: result.content,
        wordCount: result.wordCount,
      });
    })
    .catch((err) => {
      clearInterval(tick);
      emitter.emit("error", { message: err?.message || String(err) });
    })
    .finally(() => {
      // Close after a tick so any final 'progress' reaches the client.
      setImmediate(() => emitter.emit("end"));
    });

  return emitter;
}
