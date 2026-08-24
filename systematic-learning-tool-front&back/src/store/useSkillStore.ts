// ============================================================
// Skill slice + evolution log.
// ============================================================

import type { StateCreator } from "zustand";
import type { EvolutionLog, Skill, SkillStatus } from "../types";
import { api } from "../services/apiClient";
import { uid } from "./mappers";
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

  addEvolutionLog: log => {
    const newLog: EvolutionLog = { ...log, id: uid(), timestamp: new Date().toISOString() };
    set(s => ({ evolutionLogs: [newLog, ...s.evolutionLogs].slice(0, MAX_EVOLUTION_LOGS) }));
  },
});
