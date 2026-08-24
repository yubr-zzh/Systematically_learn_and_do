// ============================================================
// Project slice — projects + tasks.
// ============================================================

import type { StateCreator } from "zustand";
import type { Project } from "../types";
import { api } from "../services/apiClient";
import { calcTaskProgress, deriveStages } from "./mappers";
import type { AppState } from "./types";

export interface ProjectSlice {
  projects: Project[];
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
          p.id === id ? { ...p, status: nextStatus as Project["status"] } : p
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

  addTask: async (projectId, title, phase, dueDate?) => {
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
          p.id === id ? { ...p, status: "completed" as Project["status"], progress: 100 } : p
        ),
      }));
    } catch (e) {
      get().toast("error", `更新失败：${(e as Error).message}`);
    }
  },
});
