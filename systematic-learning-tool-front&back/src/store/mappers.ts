// ============================================================
// Store mappers and pure helpers
// No side effects, no API calls — just DB-row -> front-end-shape
// transformations and small calculation utilities.
// ============================================================

import type {
  CategoryId,
  EvolutionLog,
  FeedbackItem,
  LearnReport,
  Project,
  ProjectStatus,
  ProjectTypeId,
  Skill,
  SkillStatus,
  StageInfo,
  Task,
  TaskPhase,
} from "../types";
import { STAGE_NAMES } from "../types";

export const uid = () =>
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

export function calcTaskProgress(tasks: Task[], status: ProjectStatus): number {
  if (status === "completed") return 100;
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
}

export function mapReport(r: any): LearnReport {
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
    researchMeta: typeof r.research_meta === "string"
      ? (() => { try { return JSON.parse(r.research_meta); } catch { return undefined; } })()
      : r.research_meta,
  };
}

export function mapProject(p: any): Project {
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
    researchMeta: typeof p.research_meta === "string"
      ? (() => { try { return JSON.parse(p.research_meta); } catch { return undefined; } })()
      : p.research_meta,
    dueDate: p.due_date, startDate: p.start_date, refLink: p.ref_link,
  };
}

export function mapFeedback(f: any): FeedbackItem {
  return {
    id: f.id, reportId: f.report_id, reportTitle: f.report_title,
    rating: f.rating, strengths: f.strengths, improvements: f.improvements,
    comment: f.comment, createdAt: f.created_at,
  };
}

export function mapSkill(s: any): Skill {
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

export function mapEvolutionLog(l: any): EvolutionLog {
  return {
    id: l.id,
    timestamp: l.timestamp,
    type: l.type as EvolutionLog["type"],
    subject: l.subject,
    skillName: l.skill_name,
    description: l.description,
  };
}
