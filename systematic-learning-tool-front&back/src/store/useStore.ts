// ============================================================
// 全局状态管理（对接后端 API）
// 包含：路由、学习报告、项目、反馈、设置、Toast、Skill 管理、进化日志
// ============================================================
import { create } from "zustand";
import type {
  CategoryId,
  EvolutionLog,
  FeedbackItem,
  LearnReport,
  Project,
  ProjectStatus,
  ProjectTypeId,
  RouterState,
  Skill,
  SkillStatus,
  StageInfo,
  Task,
  TaskPhase,
  ToastMsg,
  UserSettings,
} from "../types";
import { STAGE_NAMES } from "../types";
import { extractSkillTemplate } from "../utils/skillTemplate";
import { api } from "../services/apiClient";

export const uid = () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ---- Learn report streaming ----
// If no SSE event arrives within this window, we assume the stream died
// and surface a 'stuck' badge so the user can manually retry.
export const LEARN_STREAM_STALE_MS = 10_000;

// In-flight stream registry. Module-scoped so two store instances (tests,
// HMR, double mount) can't race on the same report id.
const streams = new Map<string, { close: () => void; staleTimer: ReturnType<typeof setTimeout> }>();

const DEFAULT_SETTINGS: UserSettings = {
  username: "学习者",
  avatar: "🌱",
  theme: "system",
  fontSize: 15,
  analysisDepth: "standard",
  researchSources: 8,
  planningStyle: "hybrid",
};

function deriveStages(progress: number): StageInfo[] {
  const ranges: [StageInfo["id"], number, number][] = [
    ["analysis", 0, 40],
    ["research", 40, 78],
    ["planning", 78, 100],
  ];
  return ranges.map(([id, from, to]) => {
    const done = progress >= to;
    const active = progress > from && progress < to;
    const p = done ? 100 : active ? Math.round(((progress - from) / (to - from)) * 100) : 0;
    return { id, name: STAGE_NAMES[id], status: done ? "done" : active ? "active" : "pending", progress: p };
  });
}

function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

function calcTaskProgress(tasks: Task[], status: ProjectStatus): number {
  if (status === "completed") return 100;
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
}

/** 后端 LearnReport 记录 → 前端类型 */
function mapReport(r: any): LearnReport {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    category: r.category as CategoryId,
    status: (r.status || "generating") as LearnReport["status"],
    progress: r.progress ?? 0,
    stages: deriveStages(r.progress ?? 0),
    content: r.content ?? "",
    favorite: Boolean(r.favorite),
    wordCount: r.word_count ?? 0,
    versions: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 后端 Project 记录 → 前端类型 */
function mapProject(p: any): Project {
  const tasks: Task[] = (p.tasks || []).map((t: any) => ({
    id: t.id, title: t.title, phase: t.phase as TaskPhase, done: Boolean(t.done), dueDate: t.due_date,
  }));
  const milestones = (p.milestones || []).map((m: any) => ({
    phase: m.phase as TaskPhase, name: m.name, duration: m.duration, goal: m.goal,
  }));
  return {
    id: p.id, name: p.name, description: p.description, type: p.type as ProjectTypeId,
    status: (p.status || "planning") as ProjectStatus,
    progress: p.progress ?? 0,
    stages: deriveStages(p.progress ?? 0),
    tasks, milestones,
    content: p.content ?? "",
    wordCount: p.word_count ?? 0,
    cover: p.cover ?? 0,
    createdAt: p.created_at,
    dueDate: p.due_date, startDate: p.start_date, refLink: p.ref_link,
  };
}

/** 后端 Feedback 记录 → 前端类型 */
function mapFeedback(f: any): FeedbackItem {
  return {
    id: f.id, reportId: f.report_id, reportTitle: f.report_title,
    rating: f.rating, strengths: f.strengths, improvements: f.improvements,
    comment: f.comment, createdAt: f.created_at,
  };
}

/** 后端 Skill 记录 → 前端类型 */
function mapSkill(s: any): Skill {
  return {
    id: s.id, name: s.name, description: s.description, content: s.content,
    category: s.category as CategoryId,
    status: (s.status || "active") as SkillStatus,
    usageCount: s.usage_count ?? 0, rating: s.rating ?? 0,
    version: s.version ?? 1, author: s.author ?? "user",
    tags: typeof s.tags === "string" ? JSON.parse(s.tags) : (s.tags || []),
    createdAt: s.created_at, updatedAt: s.updated_at,
  };
}

interface AppState {
  router: RouterState;
  reports: LearnReport[];
  projects: Project[];
  feedbacks: FeedbackItem[];
  skills: Skill[];
  evolutionLogs: EvolutionLog[];
  settings: UserSettings;
  toasts: ToastMsg[];
  loading: boolean;
  /** Reports whose auto-polling hit the timeout cap. UI shows a retry button. */
  stuckReportIds: string[];

  setRouter: (r: RouterState) => void;
  toast: (type: ToastMsg["type"], message: string) => void;
  dismissToast: (id: string) => void;
  setLoading: (v: boolean) => void;

  // 初始化
  loadAll: () => Promise<void>;

  // 学习报告
  startLearn: (subject: string, category: CategoryId, depth?: string) => Promise<string>;
  refreshReport: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => void;
  archiveReport: (id: string) => void;
  deleteReport: (id: string) => void;

  // 项目
  createProject: (p: { name: string; description: string; type: ProjectTypeId; dueDate?: string; startDate?: string; refLink?: string }) => Promise<string>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  archiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
  addTask: (projectId: string, title: string, phase: TaskPhase, dueDate?: string) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  markProjectDone: (id: string) => void;

  // 反馈
  addFeedback: (f: Omit<FeedbackItem, "id" | "createdAt">) => Promise<void>;
  deleteFeedback: (id: string) => void;

  // Skill 管理
  addSkill: (skill: Omit<Skill, "id" | "createdAt" | "updatedAt" | "usageCount" | "rating" | "version">) => Promise<void>;
  updateSkill: (id: string, patch: Partial<Skill>) => Promise<void>;
  archiveSkill: (id: string) => void;
  pinSkill: (id: string) => void;
  deleteSkill: (id: string) => void;
  incrementSkillUsage: (id: string) => void;

  // 进化日志
  addEvolutionLog: (log: Omit<EvolutionLog, "id" | "timestamp">) => void;

  // 设置
  updateSettings: (p: Partial<UserSettings>) => Promise<void>;
  exportData: () => string;
  importData: (json: string) => boolean;
  clearHistory: () => void;
  syncNow: () => void;
  processFeedbackAndEvolve: (reportId: string | undefined, reportTitle: string, rating: number, improvements: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  router: { page: "learn" },
  reports: [],
  projects: [],
  feedbacks: [],
  skills: [],
  evolutionLogs: [],
  settings: DEFAULT_SETTINGS,
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

  // ==================== 初始化 ====================

  loadAll: async () => {
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
        evolutionLogs: (logs || []).map((l: any) => ({
          id: l.id, timestamp: l.timestamp, type: l.type as EvolutionLog["type"],
          subject: l.subject, skillName: l.skill_name, description: l.description,
        })),
        settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS,
      });
      // Re-attach polling for any report that was mid-generation when we
      // last closed the tab — otherwise it would be an orphaned spinner.
      const orphans = (reports || []).filter(r => r.status === "generating");
      orphans.forEach(r => { get().refreshReport(r.id).catch(() => {}); });
    } finally {
      set({ loading: false });
    }
  },

  // ==================== 学习报告 ====================

  startLearn: async (subject, category, depth = "standard") => {
    const res = await api.createReport(subject, category, depth);
    const id = res.id;
    const now = new Date().toISOString();
    const report: LearnReport = {
      id, title: `${subject} · 系统研究报告`, subject, category,
      status: "generating", progress: 3, stages: deriveStages(3),
      content: "", favorite: false, wordCount: 0, versions: [],
      createdAt: now, updatedAt: now,
    };
    set(s => ({ reports: [report, ...s.reports] }));
    // Fire and forget — refreshReport() is callable from the UI for retries.
    get().refreshReport(id).catch(() => {});
    return id;
  },

  /**
   * Open (or re-open) an SSE stream for a Learn report. Streams events
   * straight into the store; the caller doesn't need to await anything.
   *
   * Safe to call concurrently for the same id — the module-level
   * `streams` map rejects re-entry. Manual retries from the UI work the
   * same way: just call refreshReport(id) again and the existing stream
   * is torn down first.
   *
   * Stuck detection: if no event arrives within LEARN_STREAM_STALE_MS,
   * we flag the report so the UI can offer a retry button. The stale
   * timer is reset on every event.
   */
  refreshReport: async (id) => {
    if (streams.has(id)) return;
    const report = get().reports.find(r => r.id === id);
    if (!report) return;
    // Clear any previous stuck flag — we're actively streaming again.
    set(s => ({ stuckReportIds: s.stuckReportIds.filter(x => x !== id) }));

    let controller: { close: () => void } | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;

    const tearDown = () => {
      controller?.close();
      if (staleTimer) clearTimeout(staleTimer);
      streams.delete(id);
    };

    const armStaleTimer = () => {
      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        tearDown();
        set(s => s.stuckReportIds.includes(id) ? s : { stuckReportIds: [...s.stuckReportIds, id] });
        get().toast(
          "info",
          `「${report.subject}」报告生成连接超时（${LEARN_STREAM_STALE_MS / 1000} 秒未收到事件）。点击"手动刷新"重连。`
        );
      }, LEARN_STREAM_STALE_MS);
    };

    controller = api.openLearnStream(id, {
      onProgress: ({ progress }) => {
        if (!get().reports.some(r => r.id === id)) {
          tearDown();
          return;
        }
        armStaleTimer();
        set(s => ({
          reports: s.reports.map(rp =>
            rp.id === id ? { ...rp, progress, stages: deriveStages(progress), updatedAt: new Date().toISOString() } : rp
          ),
        }));
      },
      onComplete: async ({ content, wordCount }) => {
        // CRITICAL: close the EventSource immediately. Without this the
        // browser's built-in reconnect would re-attach to a now-terminal
        // row forever.
        tearDown();
        set(s => ({
          reports: s.reports.map(rp =>
            rp.id === id ? {
              ...rp, progress: 100, stages: deriveStages(100),
              status: "completed" as const, content,
              wordCount: wordCount || countWords(content),
              updatedAt: new Date().toISOString(),
            } : rp
          ),
          stuckReportIds: s.stuckReportIds.filter(x => x !== id),
        }));
        get().toast("success", `「${report.subject}」报告生成完成 🎉`);
        // 自进化：自动创建 Skill（独立 try/catch）
        if ((content || "").length > 500) {
          try {
            const tpl = extractSkillTemplate(content, report.subject);
            await get().addSkill({
              name: tpl.title,
              description: tpl.description,
              content: tpl.markdown,
              category: report.category,
              status: "active",
              author: "AI自动生成",
              // Include `report:<id>` so processFeedbackAndEvolve can find
              // the originating Skill for a given report's feedback.
              tags: [...tpl.tags, `report:${id}`],
            });
            get().addEvolutionLog({
              type: "skill_created",
              subject: report.subject,
              skillName: tpl.title,
              description: `基于「${report.subject}」报告自动提炼模板（${tpl.headings.length} 个章节）`,
            });
          } catch (e) {
            console.warn("[Skill] auto-create failed:", e);
          }
        }
      },
      onError: ({ message, server }) => {
        // Two flavors of error: server-sent (terminal: report.status='error'
        // was already written by the backend's error handler — flip our copy
        // so the UI shows the right state) and network-level (transient:
        // mark stuck and let manual refresh recover).
        const stillGenerating = get().reports.some(r => r.id === id && r.status === "generating");
        if (server && stillGenerating) {
          tearDown();
          set(s => ({
            reports: s.reports.map(rp =>
              rp.id === id ? { ...rp, status: "error" as const, updatedAt: new Date().toISOString() } : rp
            ),
            stuckReportIds: s.stuckReportIds.filter(x => x !== id),
          }));
          get().toast("error", `「${report.subject}」报告生成失败：${message || '后端报错'}。请删除后重试。`);
          return;
        }
        // Transient: keep status as-is, surface a retry button.
        tearDown();
        if (!stillGenerating) return;
        set(s => s.stuckReportIds.includes(id) ? s : { stuckReportIds: [...s.stuckReportIds, id] });
        get().toast("error", `「${report.subject}」报告连接中断：${message || '网络问题'}。点击"手动刷新"重试。`);
      },
    });

    // Register the stream immediately so concurrent refreshReport() calls
    // for the same id short-circuit. armStaleTimer() below will replace
    // the placeholder timer with a real one on first event.
    streams.set(id, { close: () => controller?.close(), staleTimer: setTimeout(() => {}, 0) });
    armStaleTimer();
  },

  toggleFavorite: id => {
    const report = get().reports.find(r => r.id === id);
    if (report) api.updateReport(id, { favorite: !report.favorite });
    set(s => ({ reports: s.reports.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r) }));
  },

  archiveReport: async id => {
    const report = get().reports.find(r => r.id === id);
    if (!report) return;
    // Toggle: archiving is always allowed; un-archiving restores "completed"
    // only if the report actually has content (wordCount > 0). A failed
    // report (wordCount === 0) goes back to "error" so it doesn't masquerade
    // as a successful one in the history list.
    const isCurrentlyArchived = report.status === "archived";
    const nextStatus: LearnReport["status"] = isCurrentlyArchived
      ? report.wordCount > 0 ? "completed" : "error"
      : "archived";
    try {
      await api.updateReport(id, { status: nextStatus });
      set(s => ({
        reports: s.reports.map(r =>
          r.id === id ? { ...r, status: nextStatus, updatedAt: new Date().toISOString() } : r
        ),
      }));
    } catch (e) {
      get().toast("error", `归档失败：${(e as Error).message}`);
    }
  },

  deleteReport: async id => {
    await api.deleteReport(id);
    set(s => ({ reports: s.reports.filter(r => r.id !== id) }));
    get().toast("info", "报告已删除");
  },

  // ==================== 项目 ====================

  createProject: async ({ name, description, type, dueDate, startDate, refLink }) => {
    const res = await api.createProject({ name, description, type, dueDate, startDate, refLink });
    const id = res.id;
    const project: Project = {
      id, name, description, type,
      status: "planning", progress: 3, stages: deriveStages(3),
      tasks: [], milestones: [], content: "", wordCount: 0,
      cover: Math.floor(Math.random() * 4),
      createdAt: new Date().toISOString(), dueDate, startDate, refLink,
    };
    set(s => ({ projects: [project, ...s.projects] }));
    return id;
  },

  updateProject: async (id, patch) => {
    await api.updateProject(id, patch);
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) }));
  },

  archiveProject: async id => {
    const project = get().projects.find(p => p.id === id);
    if (!project) return;
    const nextStatus = project.status === "archived" ? "in_progress" : "archived";
    try {
      await api.updateProject(id, { status: nextStatus });
      set(s => ({
        projects: s.projects.map(p =>
          p.id === id ? { ...p, status: nextStatus as ProjectStatus } : p
        ),
      }));
    } catch (e) {
      get().toast("error", `归档失败：${(e as Error).message}`);
    }
  },

  deleteProject: async id => {
    await api.deleteProject(id);
    set(s => ({ projects: s.projects.filter(p => p.id !== id) }));
    get().toast("info", "项目已删除");
  },

  addTask: async (projectId, title, phase, dueDate) => {
    const res = await api.addTask(projectId, title, phase, dueDate);
    set(s => ({
      projects: s.projects.map(p => {
        if (p.id !== projectId) return p;
        const tasks = [...p.tasks, { id: res.id, title, phase, done: false, dueDate }];
        return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
      }),
    }));
  },

  toggleTask: (projectId, taskId) => {
    const project = get().projects.find(p => p.id === projectId);
    const task = project?.tasks.find(t => t.id === taskId);
    if (task) api.toggleTask(projectId, taskId, !task.done);
    set(s => ({
      projects: s.projects.map(p => {
        if (p.id !== projectId) return p;
        const tasks = p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
        return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
      }),
    }));
  },

  deleteTask: async (projectId, taskId) => {
    await api.deleteTask(projectId, taskId);
    set(s => ({
      projects: s.projects.map(p => {
        if (p.id !== projectId) return p;
        const tasks = p.tasks.filter(t => t.id !== taskId);
        return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
      }),
    }));
  },

  markProjectDone: async id => {
    try {
      await api.updateProject(id, { status: "completed", progress: 100 });
      set(s => ({
        projects: s.projects.map(p =>
          p.id === id ? { ...p, status: "completed" as ProjectStatus, progress: 100 } : p
        ),
      }));
    } catch (e) {
      get().toast("error", `更新失败：${(e as Error).message}`);
    }
  },

  // ==================== 反馈 ====================

  addFeedback: async f => {
    const res = await api.addFeedback(f);
    const item: FeedbackItem = { ...f, id: res.id, createdAt: new Date().toISOString() };
    set(s => ({ feedbacks: [item, ...s.feedbacks] }));
    // 触发自进化
    setTimeout(() => {
      get().processFeedbackAndEvolve(f.reportId, f.reportTitle, f.rating, f.improvements).catch(() => {});
    }, 500);
    get().toast("success", "感谢你的反馈！");
  },

  deleteFeedback: async id => {
    await api.deleteFeedback(id);
    set(s => ({ feedbacks: s.feedbacks.filter(f => f.id !== id) }));
  },

  // ==================== Skill 管理 ====================

  addSkill: async skill => {
    const res = await api.createSkill(skill);
    const now = new Date().toISOString();
    const newSkill: Skill = { ...skill, id: res.id, createdAt: now, updatedAt: now, usageCount: 0, rating: 0, version: 1 };
    set(s => ({ skills: [newSkill, ...s.skills] }));
    get().addEvolutionLog({ type: "skill_created", skillName: newSkill.name, description: `创建新 Skill: ${newSkill.name}` });
    get().toast("success", `Skill 「${newSkill.name}」已创建`);
  },

  updateSkill: async (id, patch) => {
    await api.updateSkill(id, patch);
    set(s => ({
      skills: s.skills.map(sk =>
        sk.id === id ? { ...sk, ...patch, updatedAt: new Date().toISOString(), version: sk.version + 1 } : sk
      ),
    }));
  },

  archiveSkill: id => {
    api.archiveSkill(id);
    set(s => ({
      skills: s.skills.map(sk =>
        sk.id === id ? { ...sk, status: "archived" as SkillStatus, updatedAt: new Date().toISOString() } : sk
      ),
    }));
    get().addEvolutionLog({ type: "skill_archived", description: "归档 Skill" });
  },

  pinSkill: id => {
    const skill = get().skills.find(s => s.id === id);
    const pinned = skill?.status !== "pinned";
    api.pinSkill(id, pinned);
    set(s => ({
      skills: s.skills.map(sk =>
        sk.id === id ? { ...sk, status: pinned ? "pinned" : "active" as SkillStatus, updatedAt: new Date().toISOString() } : sk
      ),
    }));
  },

  deleteSkill: async id => {
    await api.deleteSkill(id);
    set(s => ({ skills: s.skills.filter(sk => sk.id !== id) }));
    get().toast("info", "Skill 已删除");
  },

  incrementSkillUsage: async id => {
    await api.incrementSkillUsage(id);
    set(s => ({
      skills: s.skills.map(sk =>
        sk.id === id ? { ...sk, usageCount: sk.usageCount + 1, updatedAt: new Date().toISOString() } : sk
      ),
    }));
  },

  // ==================== 进化日志 ====================

  addEvolutionLog: log => {
    const newLog: EvolutionLog = { ...log, id: uid(), timestamp: new Date().toISOString() };
    set(s => ({ evolutionLogs: [newLog, ...s.evolutionLogs].slice(0, 100) }));
  },

  // ==================== 反馈驱动的自进化 ====================

  processFeedbackAndEvolve: async (reportId: string | undefined, reportTitle: string, rating: number, improvements: string) => {
    const trimmedImprovements = improvements.trim();
    if (!trimmedImprovements) return;

    // Auto-created Skills carry a 'report:<id>' tag (see refreshReport's
    // completed branch). Use that to find the Skill that originated from
    // this report, instead of fragile name/tag substring matching.
    const sourceTag = reportId ? `report:${reportId}` : null;
    const relatedSkill = sourceTag ? get().skills.find(s => s.tags.includes(sourceTag)) : undefined;

    if (!relatedSkill) {
      // No linked Skill — feedback is still logged so a Curator step
      // (later) can scan for repeat feedback on the same report title.
      get().addEvolutionLog({
        type: "feedback_processed",
        subject: reportTitle,
        description: `收到反馈（${rating}星）：${trimmedImprovements.slice(0, 50)}...`,
      });
      return;
    }

    // Update the Skill's running rating (exponential moving average, alpha=0.4
    // so recent feedback counts more than ancient history).
    const prevRating = relatedSkill.rating || 0;
    const newRating = prevRating === 0 ? rating : Number((prevRating * 0.6 + rating * 0.4).toFixed(2));

    // Append the feedback as an "改进点" section. We replace the old
    // feedback section rather than stack them, so the Skill carries
    // only the latest improvement note.
    const FEEDBACK_SECTION_HEADER = "## 改进点（来自反馈）";
    const sections = relatedSkill.content.split(/\n(?=##\s)/);
    const withoutOldFeedback = sections.filter(s => !s.startsWith(FEEDBACK_SECTION_HEADER));
    const newEntry = [
      FEEDBACK_SECTION_HEADER,
      "",
      `> ${new Date().toLocaleString("zh-CN")} · 评分 ${rating}星`,
      "",
      trimmedImprovements,
    ].join("\n");
    const updatedContent = [...withoutOldFeedback, newEntry].join("\n\n").replace(/\n{3,}/g, "\n\n");

    // Low ratings flag the Skill for the Curator's attention — but
    // respect user-curated states (pinned always stays pinned,
    // archived stays archived so a Curator-side restore can find it).
    let nextStatus: SkillStatus = relatedSkill.status;
    if (rating < 3 && relatedSkill.status === "active") {
      nextStatus = "watch";
    }

    try {
      await api.updateSkill(relatedSkill.id, {
        content: updatedContent,
        rating: newRating,
        status: nextStatus,
      });
      set(s => ({
        skills: s.skills.map(sk =>
          sk.id === relatedSkill.id
            ? { ...sk, content: updatedContent, rating: newRating, status: nextStatus, updatedAt: new Date().toISOString(), version: sk.version + 1 }
            : sk
        ),
      }));
      get().addEvolutionLog({
        type: "feedback_processed",
        subject: reportTitle,
        skillName: relatedSkill.name,
        description: `已写入 Skill (v${relatedSkill.version + 1}, 评分 ${newRating}${rating < 3 ? ", 标记为观察中" : ""}): ${trimmedImprovements.slice(0, 50)}...`,
      });
    } catch (e) {
      get().toast("error", `Skill 进化失败：${(e as Error).message}`);
    }
  },

  // ==================== 设置 ====================

  updateSettings: async patch => {
    await api.updateSettings(patch);
    set(s => ({ settings: { ...s.settings, ...patch } }));
  },
  exportData: () => {
    const s = get();
    return JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), reports: s.reports, projects: s.projects, feedbacks: s.feedbacks, skills: s.skills, evolutionLogs: s.evolutionLogs, settings: s.settings },
      null, 2
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
}));
