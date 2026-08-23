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
import { api } from "../services/apiClient";

export const uid = () => `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

  setRouter: (r: RouterState) => void;
  toast: (type: ToastMsg["type"], message: string) => void;
  dismissToast: (id: string) => void;
  setLoading: (v: boolean) => void;

  // 初始化
  loadAll: () => Promise<void>;

  // 学习报告
  startLearn: (subject: string, category: CategoryId, depth?: string) => Promise<string>;
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
  processFeedbackAndEvolve: (reportTitle: string, rating: number, improvements: string) => void;
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

    // 轮询等待报告完成
    const poll = async () => {
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const r = await api.getReport(id);
          if (r.status === "completed") {
            set(s => ({
              reports: s.reports.map(rp =>
                rp.id === id ? {
                  ...rp, progress: 100, stages: deriveStages(100),
                  status: "completed" as const, content: r.content,
                  wordCount: countWords(r.content),
                  updatedAt: new Date().toISOString(),
                } : rp
              ),
            }));
            get().toast("success", `「${subject}」报告生成完成 🎉`);
            // 自进化：自动创建 Skill
            if ((r.content || "").length > 500) {
              const template = extractTemplate(r.content);
              await get().addSkill({
                name: `${subject} 研究模板`,
                description: `基于「${subject}」研究经验自动生成`,
                content: template,
                category,
                status: "active",
                author: "AI自动生成",
                tags: [subject.toLowerCase().split(" ")[0]],
              });
              get().addEvolutionLog({
                type: "skill_created",
                subject,
                skillName: `${subject} 研究模板`,
                description: `基于「${subject}」报告自动生成学习模板`,
              });
            }
            return;
          }
          if (r.status === "error" || r.status === "generating") {
            const prog = r.progress ?? 3;
            set(s => ({
              reports: s.reports.map(rp =>
                rp.id === id ? { ...rp, progress: prog, stages: deriveStages(prog), updatedAt: new Date().toISOString() } : rp
              ),
            }));
          }
        } catch { /* 忽略轮询错误 */ }
      }
    };
    poll();
    return id;
  },

  toggleFavorite: id => {
    const report = get().reports.find(r => r.id === id);
    if (report) api.updateReport(id, { favorite: !report.favorite });
    set(s => ({ reports: s.reports.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r) }));
  },

  archiveReport: async id => {
    const report = get().reports.find(r => r.id === id);
    if (!report) return;
    const nextStatus = report.status === "archived" ? "completed" : "archived";
    try {
      await api.updateReport(id, { status: nextStatus });
      set(s => ({
        reports: s.reports.map(r =>
          r.id === id ? { ...r, status: nextStatus as LearnReport["status"], updatedAt: new Date().toISOString() } : r
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
    setTimeout(() => get().processFeedbackAndEvolve(f.reportTitle, f.rating, f.improvements), 500);
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

  processFeedbackAndEvolve: (reportTitle: string, rating: number, improvements: string) => {
    if (rating < 3 || !improvements.trim()) return;
    const relatedSkill = get().skills.find(s =>
      reportTitle.includes(s.name) || s.tags.some(t => reportTitle.toLowerCase().includes(t))
    );
    if (relatedSkill) {
      api.updateSkill(relatedSkill.id, { status: "watch" });
      get().addEvolutionLog({
        type: "feedback_processed",
        subject: reportTitle,
        skillName: relatedSkill.name,
        description: `收到改进建议: ${improvements.slice(0, 50)}...`,
      });
    } else {
      get().addEvolutionLog({
        type: "feedback_processed",
        subject: reportTitle,
        description: `新反馈触发 Skill 优化建议: ${improvements.slice(0, 50)}...`,
      });
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

/** 从报告内容提取可复用的模板骨架 */
function extractTemplate(content: string): string {
  const lines = content.split('\n');
  const headings = lines.filter(l => l.startsWith('#')).map(l => l.trim());
  return `# ${headings[0]?.replace('#', '').trim() || '主题'} 研究模板

> 本模板由「Systematically Learn and Do」自动生成

## 一、横向分析：领域边界与知识版图
## 二、纵向分析：历史沿革与发展趋势
## 三、深度调研：核心概念与方法论
## 四、规划建议：系统学习路线图
## 五、总结
`;
}
