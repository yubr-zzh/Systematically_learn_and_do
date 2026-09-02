// ============================================================
// Feedback slice — user feedback + the feedback-driven evolution loop.
// ============================================================

import type { StateCreator } from "zustand";
import type { FeedbackItem, SkillStatus } from "../types";
import { api } from "../services/apiClient";
import { withOptimistic } from "./optimistic";
import { replaceSectionBody } from "../utils/markdownSections";
import type { AppState } from "./types";

export interface FeedbackSlice {
  feedbacks: FeedbackItem[];
  addFeedback: AppState["addFeedback"];
  deleteFeedback: AppState["deleteFeedback"];
  processFeedbackAndEvolve: AppState["processFeedbackAndEvolve"];
}

export const createFeedbackSlice: StateCreator<AppState, [], [], FeedbackSlice> = (set, get, _store) => ({
  feedbacks: [],

  addFeedback: async f => {
    const res = await api.addFeedback(f);
    const item: FeedbackItem = { ...f, id: res.id, createdAt: new Date().toISOString() };
    set(s => ({ feedbacks: [item, ...s.feedbacks] }));
    // Trigger self-evolution asynchronously.
    setTimeout(() => {
      get().processFeedbackAndEvolve(f.reportId, f.reportTitle, f.rating, f.improvements).catch(() => {});
    }, 500);
    get().toast("success", "感谢你的反馈！");
  },

  deleteFeedback: async id => {
    const previous = get().feedbacks;
    await withOptimistic({
      set, get,
      apply: () => set(s => ({ feedbacks: s.feedbacks.filter(f => f.id !== id) })),
      apiCall: () => api.deleteFeedback(id),
      rollback: restoreSet => { restoreSet({ feedbacks: previous }); },
      errorMessage: "删除反馈失败",
    });
  },

  processFeedbackAndEvolve: async (reportId, reportTitle, rating, improvements) => {
    const trimmedImprovements = improvements.trim();
    if (!trimmedImprovements) return;

    const sourceTag = reportId ? `report:${reportId}` : null;
    const relatedSkill = sourceTag ? get().skills.find(s => s.tags.includes(sourceTag)) : undefined;

    if (!relatedSkill) {
      get().addEvolutionLog({
        type: "feedback_processed",
        subject: reportTitle,
        description: `收到反馈（${rating}星）：${trimmedImprovements.slice(0, 50)}...`,
      });
      return;
    }

    const prevRating = relatedSkill.rating || 0;
    const newRating = prevRating === 0 ? rating : Number((prevRating * 0.6 + rating * 0.4).toFixed(2));

    // Use the section-aware helper from utils/markdownSections.ts to
    // append-or-replace the feedback section. This is robust to
    // whitespace / casing drift in the stored heading AND guarantees
    // we never end up with two "改进点（来自反馈）" sections stacked
    // after multiple rounds of feedback.
    const FEEDBACK_SECTION_HEADER = "改进点（来自反馈）";
    const newEntryBody = `> ${new Date().toLocaleString("zh-CN")} · 评分 ${rating}星\n\n${trimmedImprovements}`;
    const updatedContent = replaceSectionBody(
      relatedSkill.content,
      FEEDBACK_SECTION_HEADER,
      newEntryBody
    );

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
});
