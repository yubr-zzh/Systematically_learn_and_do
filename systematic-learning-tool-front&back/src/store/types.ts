// ============================================================
// Combined AppState type — the union of every slice.
// Splitting slices keeps the implementation modular, but the runtime
// shape is one tree so cross-slice action calls (e.g. startLearn
// calling addSkill) work via get().
// ============================================================

import type {
  CategoryId,
  EvolutionLog,
  FeedbackItem,
  LearnReport,
  Project,
  ProjectTypeId,
  RouterState,
  Skill,
  TaskPhase,
  ToastMsg,
  UserSettings,
} from "../types";
import type { UISlice } from "./useUIStore";

export type AppState = UISlice & {
  // Reports
  reports: LearnReport[];
  startLearn: (subject: string, category: CategoryId, depth?: string, skillId?: string) => Promise<string>;
  refreshReport: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
  archiveReport: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;

  // Projects
  projects: Project[];
  loadProject: (id: string) => Promise<void>;
  createProject: (p: {
    name: string; description: string; type: ProjectTypeId;
    dueDate?: string; startDate?: string; refLink?: string;
  }) => Promise<string>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addTask: (projectId: string, title: string, phase: TaskPhase, dueDate?: string) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => void;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  markProjectDone: (id: string) => Promise<void>;

  // Feedback
  feedbacks: FeedbackItem[];
  addFeedback: (f: Omit<FeedbackItem, "id" | "createdAt">) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;

  // Skills + evolution logs
  skills: Skill[];
  evolutionLogs: EvolutionLog[];
  addSkill: (skill: Omit<Skill, "id" | "createdAt" | "updatedAt" | "usageCount" | "rating" | "version">) => Promise<void>;
  updateSkill: (id: string, patch: Partial<Skill>) => Promise<void>;
  archiveSkill: (id: string) => Promise<void>;
  pinSkill: (id: string) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  incrementSkillUsage: (id: string) => Promise<void>;
  addEvolutionLog: (log: Omit<EvolutionLog, "id" | "timestamp">) => void;
  processFeedbackAndEvolve: (
    reportId: string | undefined,
    reportTitle: string,
    rating: number,
    improvements: string
  ) => Promise<void>;

  // Settings
  settings: UserSettings;
  updateSettings: (p: Partial<UserSettings>) => Promise<void>;
  exportData: () => string;
  importData: (json: string) => boolean;
  clearHistory: () => void;
  syncNow: () => void;

  // Init
  loadAll: () => Promise<void>;
};

// Re-export for callers that previously imported these from useStore.
export type { RouterState, ToastMsg };
