// ============================================================
// Optimistic-update helper with automatic rollback.
// Captures a snapshot of the state slice, applies an optimistic
// mutation, awaits the API call, and restores the snapshot if the
// API throws. Toasts the error so the user knows the action
// didn't actually persist.
// ============================================================

import type { AppState } from "./types";

export interface OptimisticArgs<T> {
  /** Synchronous state mutation that reflects the user's intent immediately. */
  apply: () => void;
  /** The API call that should back the mutation. */
  apiCall: () => Promise<T>;
  /**
   * Function that, given the store's `set`, restores the slice to its
   * pre-mutation value. Should NOT re-trigger any toast or side effect.
   */
  rollback: (set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void) => void;
  /** Chinese message shown when the API call fails. */
  errorMessage: string;
  /** Store accessors. */
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
  get: () => AppState;
}

/**
 * Run an optimistic mutation with rollback on failure.
 * On success: state remains in the optimistic shape.
 * On failure: rollback restores the original slice + an error toast fires.
 *
 * Caveat: rollback is a wholesale slice restore (e.g. "the whole projects
 * array"), which can clobber another in-flight optimistic change to the
 * same list. Fine for this single-user app; if that ever changes,
 * switch to per-row / per-field patches.
 */
export async function withOptimistic<T>(args: OptimisticArgs<T>): Promise<T | null> {
  args.apply();
  try {
    return await args.apiCall();
  } catch (e) {
    args.rollback(args.set);
    // Re-read authoritative server state after rollback so concurrent
    // mutations cannot leave the store stale after a failed request.
    void args.get().loadAll().catch(() => {});
    args.get().toast("error", `${args.errorMessage}：${(e as Error).message}`);
    return null;
  }
}
