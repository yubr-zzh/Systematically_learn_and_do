// ============================================================
// Root store: composes all slices into a single Zustand store.
// Components continue to import `useStore` from this file; the
// individual slice files are implementation details.
// ============================================================

import { create } from "zustand";
import { api } from "../services/apiClient";
import {
  mapEvolutionLog,
  mapFeedback,
  mapProject,
  mapReport,
  mapSkill,
} from "./mappers";
import type { AppState } from "./types";
import { createUISlice } from "./useUIStore";
import { createReportSlice } from "./useReportStore";
import { createProjectSlice } from "./useProjectStore";
import { createFeedbackSlice } from "./useFeedbackStore";
import { createSkillSlice } from "./useSkillStore";
import { DEFAULT_SETTINGS, createSettingsSlice } from "./useSettingsStore";

async function loadAllImpl(set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void, get: () => AppState) {
  set({ loading: true });
  try {
    const [reports, projects, feedbacks, skills, logs, settings] = await Promise.all([
      api.getReports().catch(() => []),
      api.getProjects().catch(() => []),
      api.getFeedback().catch(() => []),
      api.getSkills().catch(() => []),
      api.getEvolutionLogs(50).catch(() => []),
      api.getSettings().catch(() => null),
    ]);
    set({
      reports: (reports || []).map(mapReport),
      projects: (projects || []).map(mapProject),
      feedbacks: (feedbacks || []).map(mapFeedback),
      skills: (skills || []).map(mapSkill),
      evolutionLogs: (logs || []).map(mapEvolutionLog),
      settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS,
    });
    // Re-attach streaming for any report left mid-generation across a reload.
    const orphans = (reports || []).filter((r: any) => r.status === "generating");
    orphans.forEach((r: any) => { get().refreshReport(r.id).catch(() => {}); });
  } finally {
    set({ loading: false });
  }
}

export const useStore = create<AppState>()((set, get, store) => ({
  ...createUISlice(set, get, store),
  ...createReportSlice(set, get, store),
  ...createProjectSlice(set, get, store),
  ...createFeedbackSlice(set, get, store),
  ...createSkillSlice(set, get, store),
  ...createSettingsSlice(set, get, store),
  loadAll: () => loadAllImpl(set as any, get),
}));

// Re-export type for callers that want to refer to the combined state.
export type { AppState };
