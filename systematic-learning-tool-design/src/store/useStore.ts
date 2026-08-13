// ============================================================
// 全局状态管理（Zustand + localStorage 持久化）
// 包含：路由、学习报告、项目、反馈、设置、Toast、生成引擎、Skill 管理
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
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
import { generateLearnReport, generateProjectReport } from "../data/reportGenerator";
import { buildSeedFeedback, buildSeedProjects, buildSeedReports } from "../data/seed";

// ---------- 工具函数 ----------

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

/** 根据整体进度推导三阶段状态 */
export function deriveStages(progress: number): StageInfo[] {
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

export function countWords(text: string): number {
  return text.replace(/\s/g, "").length;
}

// ---------- 状态定义 ----------

interface AppState {
  router: RouterState;
  reports: LearnReport[];
  projects: Project[];
  feedbacks: FeedbackItem[];
  skills: Skill[];
  evolutionLogs: EvolutionLog[];
  settings: UserSettings;
  toasts: ToastMsg[];

  setRouter: (r: RouterState) => void;
  toast: (type: ToastMsg["type"], message: string) => void;
  dismissToast: (id: string) => void;

  // 学习报告
  startLearn: (subject: string, category: CategoryId) => string;
  advanceGeneration: () => void;
  toggleFavorite: (id: string) => void;
  archiveReport: (id: string) => void;
  deleteReport: (id: string) => void;

  // 项目
  createProject: (p: { name: string; description: string; type: ProjectTypeId; dueDate?: string; startDate?: string; refLink?: string }) => string;
  updateProject: (id: string, p: Partial<Project>) => void;
  archiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
  addTask: (projectId: string, title: string, phase: TaskPhase, dueDate?: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  markProjectDone: (id: string) => void;

  // 反馈
  addFeedback: (f: Omit<FeedbackItem, "id" | "createdAt">) => void;
  deleteFeedback: (id: string) => void;

  // Skill 管理
  addSkill: (skill: Omit<Skill, "id" | "createdAt" | "updatedAt" | "usageCount" | "rating" | "version">) => void;
  updateSkill: (id: string, patch: Partial<Skill>) => void;
  archiveSkill: (id: string) => void;
  pinSkill: (id: string) => void;
  deleteSkill: (id: string) => void;
  incrementSkillUsage: (id: string) => void;

  // 进化日志
  addEvolutionLog: (log: Omit<EvolutionLog, "id" | "timestamp">) => void;

  // 设置
  updateSettings: (p: Partial<UserSettings>) => void;
  exportData: () => string;
  importData: (json: string) => boolean;
  clearHistory: () => void;
  syncNow: () => void;
}

// ---------- 生成引擎（模块级定时器，不参与持久化） ----------

let genTimer: ReturnType<typeof setInterval> | null = null;

function startGenLoop() {
  if (genTimer) return;
  genTimer = setInterval(() => {
    const st = useStore.getState();
    const hasGenerating =
      st.reports.some((r) => r.status === "generating") || st.projects.some((p) => p.status === "generating");
    if (!hasGenerating) {
      clearInterval(genTimer!);
      genTimer = null;
      return;
    }
    st.advanceGeneration();
  }, 450);
}

// ---------- Store ----------

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      router: { page: "learn" },
      reports: [],
      projects: [],
      feedbacks: [],
      skills: [],
      evolutionLogs: [],
      settings: DEFAULT_SETTINGS,
      toasts: [],

      setRouter: (r) => set({ router: r }),

      toast: (type, message) => {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
        setTimeout(() => get().dismissToast(id), 3200);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ==================== 学习报告 ====================
      
      /** 开始生成学习报告，返回报告 id */
      startLearn: (subject, category) => {
        const id = uid();
        const now = new Date().toISOString();
        const report: LearnReport = {
          id,
          title: `${subject} · 系统研究报告`,
          subject,
          category,
          status: "generating",
          progress: 3,
          stages: deriveStages(3),
          content: "",
          favorite: false,
          wordCount: 0,
          versions: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ reports: [report, ...s.reports] }));
        startGenLoop();
        return id;
      },

      /** 推进所有生成中的报告 / 项目 */
      advanceGeneration: () => {
        set((s) => {
          let changed = false;
          let completedTitles: string[] = [];

          const reports = s.reports.map((r) => {
            if (r.status !== "generating") return r;
            changed = true;
            const inc = 2 + Math.floor(Math.random() * 7);
            const progress = Math.min(100, r.progress + inc);
            if (progress >= 100) {
              generateLearnReport(r.subject, r.category, s.settings.analysisDepth).then((content) => {
                set((st) => ({
                  reports: st.reports.map((rp) =>
                    rp.id === r.id
                      ? {
                          ...rp,
                          progress: 100,
                          stages: deriveStages(100),
                          status: "completed" as const,
                          content,
                          wordCount: countWords(content),
                          versions: [...rp.versions, new Date().toISOString()],
                          updatedAt: new Date().toISOString(),
                        }
                      : rp
                  ),
                }));
                get().toast("success", `「${r.subject}」报告生成完成 🎉`);
                // 自动创建 Skill（自进化）
                if (content.length > 500) {
                  get().addSkill({
                    name: `${r.subject} 研究模板`,
                    description: `基于「${r.subject}」研究经验自动生成的学习模板`,
                    content: extractTemplate(content),
                    category: r.category,
                    status: "active",
                    author: "AI自动生成",
                    tags: [r.subject.toLowerCase().split(" ")[0]],
                  });
                  get().addEvolutionLog({
                    type: "skill_created",
                    subject: r.subject,
                    skillName: `${r.subject} 研究模板`,
                    description: `基于「${r.subject}」报告自动生成学习模板`,
                  });
                }
              });
              completedTitles.push(r.subject);
              return {
                ...r,
                progress: 100,
                stages: deriveStages(100),
                status: "completed" as const,
                content: "AI 正在生成报告...",
                wordCount: 0,
                updatedAt: new Date().toISOString(),
              };
            }
            return { ...r, progress, stages: deriveStages(progress), updatedAt: new Date().toISOString() };
          });

          const projects = s.projects.map((p) => {
            if (p.status !== "generating") return p;
            changed = true;
            const inc = 3 + Math.floor(Math.random() * 8);
            const progress = Math.min(100, p.progress + inc);
            if (progress >= 100) {
              const { content, milestones } = generateProjectReport({
                name: p.name,
                description: p.description,
                type: p.type,
                dueDate: p.dueDate,
              });
              completedTitles.push(p.name);
              return {
                ...p,
                progress: 100,
                stages: deriveStages(100),
                status: "in_progress" as ProjectStatus,
                content,
                milestones,
                wordCount: countWords(content),
              };
            }
            return { ...p, progress, stages: deriveStages(progress) };
          });

          if (!changed) return s;
          if (completedTitles.length > 0) {
            setTimeout(() => {
              get().toast("success", `「${completedTitles[completedTitles.length - 1]}」报告生成完成 🎉`);
            }, 0);
          }
          return { ...s, reports, projects };
        });
      },

      toggleFavorite: (id) =>
        set((s) => ({
          reports: s.reports.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)),
        })),

      archiveReport: (id) =>
        set((s) => ({
          reports: s.reports.map((r) =>
            r.id === id ? { ...r, status: r.status === "archived" ? "completed" : "archived" } : r
          ),
        })),

      deleteReport: (id) => {
        set((s) => ({ reports: s.reports.filter((r) => r.id !== id) }));
        get().toast("info", "报告已删除");
      },

      // ==================== 项目 ====================

      /** 创建项目并开始生成调研报告，返回项目 id */
      createProject: ({ name, description, type, dueDate, startDate, refLink }) => {
        const id = uid();
        const project: Project = {
          id,
          name,
          description,
          type,
          status: "generating",
          progress: 3,
          stages: deriveStages(3),
          tasks: [],
          milestones: [],
          content: "",
          wordCount: 0,
          cover: Math.floor(Math.random() * 4),
          createdAt: new Date().toISOString(),
          dueDate,
          startDate,
          refLink,
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        startGenLoop();
        return id;
      },

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      archiveProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, status: p.status === "archived" ? "in_progress" : "archived" } : p
          ),
        })),

      deleteProject: (id) => {
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
        get().toast("info", "项目已删除");
      },

      addTask: (projectId, title, phase, dueDate) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const tasks = [...p.tasks, { id: uid(), title, phase, done: false, dueDate }];
            return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
          }),
        })),

      toggleTask: (projectId, taskId) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const tasks = p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
            return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
          }),
        })),

      deleteTask: (projectId, taskId) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const tasks = p.tasks.filter((t) => t.id !== taskId);
            return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
          }),
        })),

      markProjectDone: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, status: "completed" as ProjectStatus, progress: 100 } : p
          ),
        })),

      // ==================== 反馈 ====================

      addFeedback: (f) => {
        const item: FeedbackItem = { ...f, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({ feedbacks: [item, ...s.feedbacks] }));
        
        // 反馈驱动自进化：分析反馈并改进相关 Skill
        setTimeout(() => {
          get().processFeedbackAndEvolve(f.reportTitle, f.rating, f.improvements);
        }, 500);
        
        get().toast("success", "感谢你的反馈！");
      },

      deleteFeedback: (id) =>
        set((s) => ({ feedbacks: s.feedbacks.filter((f) => f.id !== id) })),

      // ==================== Skill 管理 ====================

      addSkill: (skill) => {
        const now = new Date().toISOString();
        const newSkill: Skill = {
          ...skill,
          id: uid(),
          createdAt: now,
          updatedAt: now,
          usageCount: 0,
          rating: 0,
          version: 1,
        };
        set((s) => ({ skills: [newSkill, ...s.skills] }));
        get().addEvolutionLog({
          type: "skill_created",
          skillName: newSkill.name,
          description: `创建新 Skill: ${newSkill.name}`,
        });
        get().toast("success", `Skill 「${newSkill.name}」已创建`);
      },

      updateSkill: (id, patch) => {
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, ...patch, updatedAt: new Date().toISOString(), version: sk.version + 1 } : sk
          ),
        }));
      },

      archiveSkill: (id) => {
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, status: "archived" as SkillStatus, updatedAt: new Date().toISOString() } : sk
          ),
        }));
        get().addEvolutionLog({
          type: "skill_archived",
          description: "归档 Skill",
        });
      },

      pinSkill: (id) => {
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, status: "pinned" as SkillStatus, updatedAt: new Date().toISOString() } : sk
          ),
        }));
      },

      deleteSkill: (id) => {
        set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) }));
        get().toast("info", "Skill 已删除");
      },

      incrementSkillUsage: (id) => {
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.id === id ? { ...sk, usageCount: sk.usageCount + 1, updatedAt: new Date().toISOString() } : sk
          ),
        }));
      },

      // ==================== 进化日志 ====================

      addEvolutionLog: (log) => {
        const newLog: EvolutionLog = { ...log, id: uid(), timestamp: new Date().toISOString() };
        set((s) => ({ evolutionLogs: [newLog, ...s.evolutionLogs].slice(0, 100) }));
      },

      // ==================== 反馈驱动的自进化 ====================

      processFeedbackAndEvolve: (reportTitle: string, rating: number, improvements: string) => {
        if (rating < 3 || !improvements.trim()) return;
        
        // 查找相关 Skill
        const relatedSkill = get().skills.find(s => 
          reportTitle.includes(s.name) || s.tags.some(t => reportTitle.toLowerCase().includes(t))
        );
        
        if (relatedSkill) {
          get().updateSkill(relatedSkill.id, {
            status: "watch" as SkillStatus,
          });
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

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

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
            settings: s.settings 
          },
          null,
          2
        );
      },

      importData: (json) => {
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
          startGenLoop();
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
        get().toast("success", "数据已同步 ✓");
      },
    }),
    {
      name: "sld-store-v1",
      partialize: (s) => ({
        reports: s.reports,
        projects: s.projects,
        feedbacks: s.feedbacks,
        skills: s.skills,
        evolutionLogs: s.evolutionLogs,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => {
        // 首次访问（无任何持久化数据）注入示例数据；已使用过的用户不受影响
        if (!state) {
          const seededKey = "sld-seeded-v1";
          try {
            if (!localStorage.getItem(seededKey)) {
              localStorage.setItem(seededKey, "1");
              useStore.setState({
                reports: buildSeedReports(),
                projects: buildSeedProjects(),
                feedbacks: buildSeedFeedback(),
                skills: [],
                evolutionLogs: [],
              });
            }
          } catch {
            /* localStorage 不可用时忽略 */
          }
        }
        // 恢复中断的报告生成任务
        setTimeout(startGenLoop, 300);
      },
    }
  )
);

/** 根据任务完成情况计算项目进度 */
function calcTaskProgress(tasks: Task[], status: ProjectStatus): number {
  if (status === "completed") return 100;
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

/** 从报告中提取可复用的模板结构 */
function extractTemplate(content: string): string {
  // 简化版本：提取 Markdown 标题结构作为模板骨架
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
