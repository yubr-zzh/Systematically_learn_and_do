// ============================================================
// Skill slice + evolution log.
// ============================================================

import type { StateCreator } from "zustand";
import type { EvolutionLog, Skill, SkillStatus } from "../types";
import { api } from "../services/apiClient";
import { uid } from "./mappers";
import { withOptimistic } from "./optimistic";
import type { AppState } from "./types";

export interface SkillSlice {
  skills: Skill[];
  evolutionLogs: EvolutionLog[];
  addSkill: AppState["addSkill"];
  updateSkill: AppState["updateSkill"];
  archiveSkill: AppState["archiveSkill"];
  pinSkill: AppState["pinSkill"];
  deleteSkill: AppState["deleteSkill"];
  incrementSkillUsage: AppState["incrementSkillUsage"];
  addEvolutionLog: AppState["addEvolutionLog"];
}

const MAX_EVOLUTION_LOGS = 100;

export const createSkillSlice: StateCreator<AppState, [], [], SkillSlice> = (set, get, _store) => ({
  skills: [],
  evolutionLogs: [],

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

  archiveSkill: async id => {
    const skill = get().skills.find(s => s.id === id);
    if (!skill) return;
    const previousStatus = skill.status;
    const success = await withOptimistic({
      set, get,
      apply: () => set(s => ({
        skills: s.skills.map(sk =>
          sk.id === id ? { ...sk, status: "archived" as SkillStatus, updatedAt: new Date().toISOString() } : sk
        ),
      })),
      apiCall: () => api.archiveSkill(id),
      rollback: restoreSet => {
        restoreSet(s => ({
          skills: s.skills.map(sk =>
            sk.id === id ? { ...sk, status: previousStatus, updatedAt: skill.updatedAt } : sk
          ),
        }));
      },
      errorMessage: "归档 Skill 失败",
    });
    if (success !== null) get().addEvolutionLog({ type: "skill_archived", description: "归档 Skill" });
  },

  pinSkill: async id => {
    const skill = get().skills.find(s => s.id === id);
    if (!skill) return;
    const previousStatus = skill.status;
    const pinned = previousStatus !== "pinned";
    const nextStatus: SkillStatus = pinned ? "pinned" : "active";
    await withOptimistic({
      set, get,
      apply: () => set(s => ({
        skills: s.skills.map(sk =>
          sk.id === id ? { ...sk, status: nextStatus, updatedAt: new Date().toISOString() } : sk
        ),
      })),
      apiCall: () => api.pinSkill(id, pinned),
      rollback: restoreSet => {
        restoreSet(s => ({
          skills: s.skills.map(sk =>
            sk.id === id ? { ...sk, status: previousStatus, updatedAt: skill.updatedAt } : sk
          ),
        }));
      },
      errorMessage: "置顶 Skill 失败",
    });
  },

  deleteSkill: async id => {
    const previous = get().skills;
    const result = await withOptimistic({
      set, get,
      apply: () => set(s => ({ skills: s.skills.filter(sk => sk.id !== id) })),
      apiCall: () => api.deleteSkill(id),
      rollback: restoreSet => { restoreSet({ skills: previous }); },
      errorMessage: "删除 Skill 失败",
    });
    if (result !== null) get().toast("info", "Skill 已删除");
  },

  incrementSkillUsage: async id => {
    const skill = get().skills.find(s => s.id === id);
    if (!skill) return;
    const previousCount = skill.usageCount;
    await withOptimistic({
      set, get,
      apply: () => set(s => ({
        skills: s.skills.map(sk =>
          sk.id === id ? { ...sk, usageCount: previousCount + 1, updatedAt: new Date().toISOString() } : sk
        ),
      })),
      apiCall: () => api.incrementSkillUsage(id),
      rollback: restoreSet => {
        restoreSet(s => ({
          skills: s.skills.map(sk =>
            sk.id === id ? { ...sk, usageCount: previousCount, updatedAt: skill.updatedAt } : sk
          ),
        }));
      },
      errorMessage: "使用计数失败",
    });
  },

  addEvolutionLog: log => {
    const newLog: EvolutionLog = { ...log, id: uid(), timestamp: new Date().toISOString() };
    set(s => ({ evolutionLogs: [newLog, ...s.evolutionLogs].slice(0, MAX_EVOLUTION_LOGS) }));
  },
});
