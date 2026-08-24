// ============================================================
// Settings slice — user preferences + data export/import.
// ============================================================

import type { StateCreator } from "zustand";
import type { UserSettings } from "../types";
import { api } from "../services/apiClient";
import type { AppState } from "./types";

const DEFAULT_SETTINGS: UserSettings = {
  username: "学习者",
  avatar: "🌱",
  theme: "system",
  fontSize: 15,
  analysisDepth: "standard",
  researchSources: 8,
  planningStyle: "hybrid",
};

export interface SettingsSlice {
  settings: UserSettings;
  updateSettings: AppState["updateSettings"];
  exportData: AppState["exportData"];
  importData: AppState["importData"];
  clearHistory: AppState["clearHistory"];
  syncNow: AppState["syncNow"];
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set, get, _store) => ({
  settings: DEFAULT_SETTINGS,

  updateSettings: async patch => {
    await api.updateSettings(patch);
    set(s => ({ settings: { ...s.settings, ...patch } }));
  },

  exportData: () => {
    const s = get();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        reports: s.reports,
        projects: s.projects,
        feedbacks: s.feedbacks,
        skills: s.skills,
        evolutionLogs: s.evolutionLogs,
        settings: s.settings,
      },
      null,
      2
    );
  },

  importData: (json: string) => {
    try {
      const data = JSON.parse(json);
      if (!data || !Array.isArray(data.reports) || !Array.isArray(data.projects)) return false;
      set({
        reports: data.reports,
        projects: data.projects,
        feedbacks: Array.isArray(data.feedbacks) ? data.feedbacks : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        evolutionLogs: Array.isArray(data.evolutionLogs) ? data.evolutionLogs : [],
        settings: { ...DEFAULT_SETTINGS, ...data.settings },
      });
      return true;
    } catch {
      return false;
    }
  },

  clearHistory: () => {
    set({ reports: [], projects: [], feedbacks: [] });
    get().toast("info", "历史记录已清除");
  },

  syncNow: () => {
    get().loadAll();
    get().toast("success", "数据已同步 ✓");
  },
});

export { DEFAULT_SETTINGS };
