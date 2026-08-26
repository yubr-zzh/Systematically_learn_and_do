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
    const load = async <T>(name: string, task: Promise<T>, fallback: T) => {
      try { return { name, value: await task, error: null }; }
      catch (e) { return { name, value: fallback, error: e instanceof Error ? e.message : "加载失败" }; }
    };
    const results = await Promise.all([
      load("reports", api.getReports(), []),
      load("projects", api.getProjects(), []),
      load("feedback", api.getFeedback(), []),
      load("skills", api.getSkills(), []),
      load("evolutionLogs", api.getEvolutionLogs(50), []),
      load("settings", api.getSettings(), null),
    ]);
    const byName = Object.fromEntries(results.map(r => [r.name, r]));
    const loadErrors = Object.fromEntries(results.filter(r => r.error).map(r => [r.name, r.error!])) as Record<string, string>;
    set({ loadErrors });
    Object.entries(loadErrors).forEach(([name, error]) => get().toast("error", `${name} 加载失败：${error}`));
    const reports = byName.reports.value as any[];
    const projects = byName.projects.value as any[];
    const feedbacks = byName.feedback.value as any[];
    const skills = byName.skills.value as any[];
    const logs = byName.evolutionLogs.value as any[];
    const settings = byName.settings.value as any;
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
  loadErrors: {},
  loadAll: () => loadAllImpl(set as any, get),
}));

// Re-export type for callers that want to refer to the combined state.
export type { AppState };
