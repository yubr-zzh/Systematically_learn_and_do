// ============================================================
// Learn report generation as an EventEmitter.
// ============================================================
//
// The emitter forwards three kinds of events to the SSE handler:
//
//   'progress' { progress }  — incremental, driven by aiService's
//                              onProgress callback (real bytes arrived).
//                              Also fired as a 5s heartbeat so the
//                              client stale-timer never trips while the
//                              AI call is still in flight.
//   'complete' { content, wordCount, researchMeta }
//   'error'    { message }
//
// We no longer fake progress from elapsed time — that lied to the
// user when AI calls took 60–120s. Truthful progress comes from
// aiService.runLearnAnalysis -> stage1/2/3 -> callAIStream chunks.

import { EventEmitter } from "node:events";
import { runLearnAnalysis } from "./aiService.js";

// Heartbeat interval: re-emit the latest known progress so the
// client's stale-detection timer keeps resetting even when the AI
// is between chunks (chunks can be 1-3s apart on slow responses).
const HEARTBEAT_TICK_MS = 5_000;

export function streamLearnAnalysis(subject, category, options = {}) {
  const emitter = new EventEmitter();

  // Latest progress the AI pipeline has reported. Used by the
  // heartbeat to forward the most recent value verbatim.
  let lastProgress = 0;
  // Latch: once we see 100 (or 'complete'), stop re-emitting.
  let finished = false;

  const emitProgress = (p) => {
    if (finished) return;
    lastProgress = p;
    emitter.emit("progress", { progress: p });
  };

  // Forwarded options: aiService.runLearnAnalysis will call
  // onProgress(percent) for each token chunk that arrives.
  const runOptions = {
    ...options,
    onProgress: (p) => emitProgress(p),
  };

  const heartbeat = setInterval(() => {
    if (finished) return;
    emitProgress(lastProgress);
  }, HEARTBEAT_TICK_MS);

  runLearnAnalysis(subject, category, runOptions)
    .then((result) => {
      finished = true;
      clearInterval(heartbeat);
      emitProgress(100);
      emitter.emit("complete", {
        content: result.content,
        wordCount: result.wordCount,
        researchMeta: result.researchMeta,
      });
    })
    .catch((err) => {
      finished = true;
      clearInterval(heartbeat);
      emitter.emit("error", { message: err?.message || String(err) });
    })
    .finally(() => {
      // Defer end so any final 'progress' / 'complete' / 'error' is
      // flushed before the SSE handler closes the response.
      setImmediate(() => emitter.emit("end"));
    });

  return emitter;
}
