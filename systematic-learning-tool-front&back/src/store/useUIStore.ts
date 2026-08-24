// ============================================================
// UI slice: router, toasts, global loading flag, stuck-report tracker.
// Pure presentation state — no API calls.
// ============================================================

import type { StateCreator } from "zustand";
import type { RouterState, ToastMsg } from "../types";
import { uid } from "./mappers";

export interface UISlice {
  router: RouterState;
  toasts: ToastMsg[];
  loading: boolean;
  /** Reports whose SSE stream hit the stale threshold; UI shows a retry button. */
  stuckReportIds: string[];

  setRouter: (r: RouterState) => void;
  setLoading: (v: boolean) => void;
  toast: (type: ToastMsg["type"], message: string) => void;
  dismissToast: (id: string) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get, _store) => ({
  router: { page: "learn" },
  toasts: [],
  loading: false,
  stuckReportIds: [],

  setRouter: r => set({ router: r }),
  setLoading: v => set({ loading: v }),

  toast: (type, message) => {
    const id = uid();
    set(s => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().dismissToast(id), 3200);
  },
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
});
