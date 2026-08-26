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

function toServerImport(data: any) {
  return {
    reports: (data.reports || []).map((r: any) => ({
      id: r.id, title: r.title, subject: r.subject, category: r.category,
      status: r.status, progress: r.progress, content: r.content,
      favorite: r.favorite ? 1 : 0, word_count: r.wordCount ?? r.word_count ?? 0,
      created_at: r.createdAt ?? r.created_at, updated_at: r.updatedAt ?? r.updated_at,
      stages: (r.stages || []).map((s: any) => ({
        id: s.id ?? `${r.id}-${s.stage_id ?? s.stageId}`,
        stage_id: s.stage_id ?? s.stageId, name: s.name, status: s.status,
        progress: s.progress ?? 0, content: s.content ?? "",
      })),
    })),
    projects: (data.projects || []).map((p: any) => ({
      id: p.id, name: p.name, description: p.description, type: p.type,
      status: p.status, progress: p.progress, content: p.content,
      cover: p.cover ?? 0, word_count: p.wordCount ?? p.word_count ?? 0,
      due_date: p.dueDate ?? p.due_date, start_date: p.startDate ?? p.start_date,
      ref_link: p.refLink ?? p.ref_link, created_at: p.createdAt ?? p.created_at,
      updated_at: p.updatedAt ?? p.updated_at,
      tasks: (p.tasks || []).map((t: any) => ({
        id: t.id, title: t.title, phase: t.phase, done: t.done ? 1 : 0,
        due_date: t.dueDate ?? t.due_date,
      })),
      milestones: (p.milestones || []).map((m: any) => ({
        phase: m.phase, name: m.name, duration: m.duration, goal: m.goal,
      })),
    })),
    feedback: (data.feedbacks || data.feedback || []).map((f: any) => ({
      id: f.id, report_id: f.reportId ?? f.report_id, report_title: f.reportTitle ?? f.report_title,
      rating: f.rating, strengths: f.strengths, improvements: f.improvements,
      comment: f.comment, created_at: f.createdAt ?? f.created_at,
    })),
    skills: (data.skills || []).map((s: any) => ({
      id: s.id, name: s.name, description: s.description, content: s.content,
      category: s.category, status: s.status, usage_count: s.usageCount ?? s.usage_count ?? 0,
      rating: s.rating ?? 0, version: s.version ?? 1, author: s.author ?? "user",
      tags: JSON.stringify(s.tags || []), created_at: s.createdAt ?? s.created_at,
      updated_at: s.updatedAt ?? s.updated_at,
    })),
    settings: data.settings,
  };
}

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

  importData: async (json: string) => {
    try {
      const data = JSON.parse(json);
      if (!data || !Array.isArray(data.reports) || !Array.isArray(data.projects)) return false;
      await api.importData({ data: { version: data.version ?? 1, data: toServerImport(data) } });
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

  clearHistory: async () => {
    await api.clearData();
    set({ reports: [], projects: [], feedbacks: [] });
    get().toast("info", "历史记录已清除");
  },

  syncNow: () => {
    get().loadAll();
    get().toast("success", "数据已同步 ✓");
  },
});

export { DEFAULT_SETTINGS };
