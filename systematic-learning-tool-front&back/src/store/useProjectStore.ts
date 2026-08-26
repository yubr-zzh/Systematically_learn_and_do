// ============================================================
// Project slice — projects + tasks.
// ============================================================

import type { StateCreator } from "zustand";
import type { Project } from "../types";
import { api } from "../services/apiClient";
import { calcTaskProgress, deriveStages, mapProject } from "./mappers";
import { withOptimistic } from "./optimistic";
import type { AppState } from "./types";

export interface ProjectSlice {
  projects: Project[];
  loadProject: AppState["loadProject"];
  createProject: AppState["createProject"];
  updateProject: AppState["updateProject"];
  archiveProject: AppState["archiveProject"];
  deleteProject: AppState["deleteProject"];
  addTask: AppState["addTask"];
  toggleTask: AppState["toggleTask"];
  deleteTask: AppState["deleteTask"];
  markProjectDone: AppState["markProjectDone"];
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get, _store) => ({
  projects: [],

  loadProject: async id => {
    const project = await api.getProject(id);
    const mapped = mapProject(project);
    set(s => s.projects.some(p => p.id === id)
      ? { projects: s.projects.map(p => p.id === id ? mapped : p) }
      : { projects: [mapped, ...s.projects] });
  },

  createProject: async ({ name, description, type, dueDate, startDate, refLink }) => {
    const res = await api.createProject({ name, description, type, dueDate, startDate, refLink });
    const id = res.id;
    const project: Project = {
      id, name, description, type,
      status: "generating", progress: 3, stages: deriveStages(3),
      tasks: [], milestones: [], content: "", wordCount: 0,
      cover: Math.floor(Math.random() * 4),
      createdAt: new Date().toISOString(), dueDate, startDate, refLink,
    };
    set(s => ({ projects: [project, ...s.projects] }));
    const poll = async () => {
      try {
        await get().loadProject(id);
        const current = get().projects.find(p => p.id === id);
        if (current?.status === "generating") setTimeout(poll, 1500);
      } catch {
        setTimeout(poll, 3000);
      }
    };
    setTimeout(poll, 500);
    return id;
  },

  updateProject: async (id, patch) => {
    await api.updateProject(id, patch);
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) }));
  },

  archiveProject: async id => {
    const project = get().projects.find(p => p.id === id);
    if (!project) return;
    const previousStatus = project.status;
    const nextStatus = previousStatus === "archived" ? "in_progress" : "archived";
    await withOptimistic({
      set, get,
      apply: () => set(s => ({
        projects: s.projects.map(p =>
          p.id === id ? { ...p, status: nextStatus as Project["status"] } : p
        ),
      })),
      apiCall: () => api.updateProject(id, { status: nextStatus }),
      rollback: restoreSet => {
        restoreSet(s => ({
          projects: s.projects.map(p =>
            p.id === id ? { ...p, status: previousStatus } : p
          ),
        }));
      },
      errorMessage: "归档失败",
    });
  },

  deleteProject: async id => {
    const previous = get().projects;
    const result = await withOptimistic({
      set, get,
      apply: () => set(s => ({ projects: s.projects.filter(p => p.id !== id) })),
      apiCall: () => api.deleteProject(id),
      rollback: restoreSet => { restoreSet({ projects: previous }); },
      errorMessage: "删除失败",
    });
    if (result !== null) get().toast("info", "项目已删除");
  },

  addTask: async (projectId, title, phase, dueDate?) => {
    const previous = get().projects.find(p => p.id === projectId);
    if (!previous) return;
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticTasks = [...previous.tasks, { id: tmpId, title, phase, done: false, dueDate }];
    const result = await withOptimistic<{ id: string }>({
      set, get,
      apply: () => set(s => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, tasks: optimisticTasks, progress: calcTaskProgress(optimisticTasks, p.status) };
        }),
      })),
      apiCall: () => api.addTask(projectId, title, phase, dueDate),
      rollback: restoreSet => {
        restoreSet(s => ({
          projects: s.projects.map(p =>
            p.id === projectId ? { ...p, tasks: previous.tasks, progress: calcTaskProgress(previous.tasks, p.status) } : p
          ),
        }));
      },
      errorMessage: "添加任务失败",
    });
    if (!result) return;
    // Swap the tmp id for the real server id so subsequent ops target the right record.
    set(s => ({
      projects: s.projects.map(p => {
        if (p.id !== projectId) return p;
        const tasks = p.tasks.map(t => t.id === tmpId ? { ...t, id: result.id } : t);
        return { ...p, tasks };
      }),
    }));
  },

  toggleTask: (projectId, taskId) => {
    const project = get().projects.find(p => p.id === projectId);
    const task = project?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const previousDone = task.done;
    void withOptimistic({
      set, get,
      apply: () => set(s => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p;
          const tasks = p.tasks.map(t => t.id === taskId ? { ...t, done: !previousDone } : t);
          return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
        }),
      })),
      apiCall: () => api.toggleTask(projectId, taskId, !previousDone),
      rollback: restoreSet => {
        restoreSet(s => ({
          projects: s.projects.map(p => {
            if (p.id !== projectId) return p;
            const tasks = p.tasks.map(t => t.id === taskId ? { ...t, done: previousDone } : t);
            return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
          }),
        }));
      },
      errorMessage: "任务状态切换失败",
    });
  },

  deleteTask: async (projectId, taskId) => {
    const previousTasks = get().projects.find(p => p.id === projectId)?.tasks;
    if (!previousTasks) return;
    await withOptimistic({
      set, get,
      apply: () => set(s => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p;
          const tasks = p.tasks.filter(t => t.id !== taskId);
          return { ...p, tasks, progress: calcTaskProgress(tasks, p.status) };
        }),
      })),
      apiCall: () => api.deleteTask(projectId, taskId),
      rollback: restoreSet => {
        restoreSet(s => ({
          projects: s.projects.map(p =>
            p.id === projectId ? { ...p, tasks: previousTasks, progress: calcTaskProgress(previousTasks, p.status) } : p
          ),
        }));
      },
      errorMessage: "删除任务失败",
    });
  },

  markProjectDone: async id => {
    const project = get().projects.find(p => p.id === id);
    if (!project) return;
    const previousStatus = project.status;
    const previousProgress = project.progress;
    await withOptimistic({
      set, get,
      apply: () => set(s => ({
        projects: s.projects.map(p =>
          p.id === id ? { ...p, status: "completed" as Project["status"], progress: 100 } : p
        ),
      })),
      apiCall: () => api.updateProject(id, { status: "completed", progress: 100 }),
      rollback: restoreSet => {
        restoreSet(s => ({
          projects: s.projects.map(p =>
            p.id === id ? { ...p, status: previousStatus, progress: previousProgress } : p
          ),
        }));
      },
      errorMessage: "标记完成失败",
    });
  },
});
