// ============================================================
// Report slice — Learn report state + startLearn / refreshReport (SSE)
// / toggleFavorite / archiveReport / deleteReport.
// ============================================================

import type { StateCreator } from "zustand";
import type { LearnReport } from "../types";
import { api } from "../services/apiClient";
import { extractSkillTemplate } from "../utils/skillTemplate";
import { countWords, deriveStages } from "./mappers";
import type { AppState } from "./types";

// If no SSE event arrives within this window, we assume the stream died
// and surface a 'stuck' badge so the user can manually retry.
export const LEARN_STREAM_STALE_MS = 10_000;

// In-flight stream registry. Module-scoped so two store instances (tests,
// HMR, double mount) can't race on the same report id.
const streams = new Map<string, { close: () => void; staleTimer: ReturnType<typeof setTimeout> }>();

export interface ReportSlice {
  reports: LearnReport[];
  startLearn: AppState["startLearn"];
  refreshReport: AppState["refreshReport"];
  toggleFavorite: AppState["toggleFavorite"];
  archiveReport: AppState["archiveReport"];
  deleteReport: AppState["deleteReport"];
}

export const createReportSlice: StateCreator<AppState, [], [], ReportSlice> = (set, get, _store) => ({
  reports: [],

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

  refreshReport: async (id) => {
    if (streams.has(id)) return;
    const report = get().reports.find(r => r.id === id);
    if (!report) return;
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
        // CRITICAL: close the EventSource immediately so the browser's
        // built-in reconnect doesn't re-attach to a now-terminal DB row.
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
        const stillGenerating = get().reports.some(r => r.id === id && r.status === "generating");
        if (server && stillGenerating) {
          tearDown();
          set(s => ({
            reports: s.reports.map(rp =>
              rp.id === id ? { ...rp, status: "error" as const, updatedAt: new Date().toISOString() } : rp
            ),
            stuckReportIds: s.stuckReportIds.filter(x => x !== id),
          }));
          get().toast("error", `「${report.subject}」报告生成失败：${message || "后端报错"}。请删除后重试。`);
          return;
        }
        tearDown();
        if (!stillGenerating) return;
        set(s => s.stuckReportIds.includes(id) ? s : { stuckReportIds: [...s.stuckReportIds, id] });
        get().toast("error", `「${report.subject}」报告连接中断：${message || "网络问题"}。点击"手动刷新"重试。`);
      },
    });

    // Register immediately so concurrent refreshReport() calls collapse.
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
    const nextStatus = report.status === "archived"
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
});
