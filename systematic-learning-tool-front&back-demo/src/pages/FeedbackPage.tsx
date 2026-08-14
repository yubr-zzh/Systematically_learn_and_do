// ============================================================
// Feedback 页面：提交反馈表单 + 反馈列表（按报告分类展示）
// ============================================================

import { useMemo, useState } from "react";
import { MessageSquareHeart, Send, ThumbsUp, Trash2, Wrench } from "lucide-react";
import { useStore } from "../store/useStore";
import { ConfirmDialog, EmptyState, StarRating } from "../components/ui";
import { navigateTo } from "../components/Header";

export function FeedbackPage() {
  const { reports, feedbacks, addFeedback, deleteFeedback } = useStore();
  const [reportId, setReportId] = useState("");
  const [rating, setRating] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const completedReports = useMemo(
    () => reports.filter((r) => r.status === "completed"),
    [reports]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return feedbacks;
    const q = query.toLowerCase();
    return feedbacks.filter(
      (f) => f.reportTitle.toLowerCase().includes(q) || f.comment.toLowerCase().includes(q) || f.strengths.toLowerCase().includes(q)
    );
  }, [feedbacks, query]);

  const submit = () => {
    if (!reportId) {
      setError("请选择要评价的报告");
      return;
    }
    if (rating < 1) {
      setError("请点击星星给出评分（1-5 星）");
      return;
    }
    if (!strengths.trim() && !improvements.trim()) {
      setError("请至少填写「满意点」或「改进建议」中的一项");
      return;
    }
    const report = reports.find((r) => r.id === reportId);
    addFeedback({
      reportId,
      reportTitle: report?.title ?? "未知报告",
      rating,
      strengths: strengths.trim(),
      improvements: improvements.trim(),
      comment: comment.trim(),
    });
    setRating(0);
    setStrengths("");
    setImprovements("");
    setComment("");
    setError("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 页头 */}
      <div className="mb-8">
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-ink-900 dark:text-forest-100">
          反馈与建议 <span className="inline-block">💬</span>
        </h1>
        <p className="mt-2 text-[15px] text-ink-600 dark:text-forest-300/80">
          你的反馈将直接帮助横纵分析法引擎生成更高质量的报告。
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* 提交表单 */}
        <section className="lg:col-span-2" aria-label="提交反馈">
          <div className="card overflow-hidden sticky top-24">
            <div className="h-1.5 bg-gradient-to-r from-forest-600 via-forest-400 to-forest-300" />
            <div className="p-6">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
                <MessageSquareHeart size={19} className="text-forest-500" /> 提交反馈
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                    关联报告 <span className="text-coral">*</span>
                  </label>
                  <select
                    value={reportId}
                    onChange={(e) => {
                      setReportId(e.target.value);
                      if (error) setError("");
                    }}
                    className="input cursor-pointer"
                    aria-label="选择要评价的报告"
                  >
                    <option value="">选择一份学习报告…</option>
                    {completedReports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.subject}
                      </option>
                    ))}
                  </select>
                  {completedReports.length === 0 && (
                    <p className="mt-1 text-xs text-ink-600 dark:text-forest-300/60">暂无可评价的已完成报告，先去 Learn 页生成一份吧。</p>
                  )}
                </div>

                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                    评分 <span className="text-coral">*</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <StarRating value={rating} onChange={(v) => { setRating(v); if (error) setError(""); }} size={28} />
                    <span className="text-sm font-bold text-amberx">{rating > 0 ? `${rating} 星` : "未评分"}</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                    满意点 <span className="text-coral">*</span>
                  </label>
                  <textarea
                    value={strengths}
                    onChange={(e) => { setStrengths(e.target.value); if (error) setError(""); }}
                    rows={2}
                    className="input resize-none"
                    placeholder="报告哪些部分最有帮助？"
                    aria-label="满意点"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">改进建议</label>
                  <textarea
                    value={improvements}
                    onChange={(e) => { setImprovements(e.target.value); if (error) setError(""); }}
                    rows={2}
                    className="input resize-none"
                    placeholder="希望报告在哪些方面做得更好？"
                    aria-label="改进建议"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">附加评论（可选）</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    className="input resize-none"
                    placeholder="其他想说的话…"
                    aria-label="附加评论"
                  />
                </div>

                {error && <p className="rounded-lg bg-coral/10 px-3 py-2 text-[13px] text-coral">{error}</p>}

                <button onClick={submit} className="btn-primary w-full !py-2.5">
                  <Send size={16} /> 提交反馈
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 反馈列表 */}
        <section className="lg:col-span-3" aria-label="反馈列表">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-ink-900 dark:text-forest-100">
              全部反馈 <span className="ml-1 text-sm font-semibold text-ink-600 dark:text-forest-300/70">({filtered.length})</span>
            </h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input !w-52 !py-2 !text-[13px]"
              placeholder="搜索报告名 / 内容…"
              aria-label="搜索反馈"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              emoji="🌿"
              title="还没有反馈"
              desc="在左侧提交你的第一条反馈，帮助引擎持续进化"
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((f) => (
                <article key={f.id} className="card p-5 animate-fade-in">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        onClick={() => f.reportId && navigateTo("learn", f.reportId)}
                        className="text-left text-[15px] font-bold text-ink-900 dark:text-forest-100 hover:text-forest-600 dark:hover:text-forest-300 transition-colors cursor-pointer line-clamp-1"
                      >
                        {f.reportTitle}
                      </button>
                      <p className="mt-0.5 text-xs text-ink-600 dark:text-forest-300/60">
                        {new Date(f.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={f.rating} size={16} readOnly />
                      <button
                        onClick={() => setPendingDelete(f.id)}
                        className="rounded-lg p-1.5 text-ink-600/60 hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer"
                        aria-label="删除反馈"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {f.strengths && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-forest-50 dark:bg-night-700 px-3.5 py-2.5 text-[13px] text-ink-700 dark:text-forest-200">
                      <ThumbsUp size={14} className="mt-0.5 shrink-0 text-forest-500" />
                      <span>
                        <b>满意点：</b>
                        {f.strengths}
                      </span>
                    </p>
                  )}
                  {f.improvements && (
                    <p className="mt-2 flex items-start gap-2 rounded-lg bg-cream/70 dark:bg-amberx/10 px-3.5 py-2.5 text-[13px] text-ink-700 dark:text-forest-200">
                      <Wrench size={14} className="mt-0.5 shrink-0 text-amberx" />
                      <span>
                        <b>改进建议：</b>
                        {f.improvements}
                      </span>
                    </p>
                  )}
                  {f.comment && (
                    <p className="mt-2 border-l-2 border-forest-200 dark:border-night-600 pl-3 text-[13px] text-ink-600 dark:text-forest-300/80">
                      {f.comment}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteFeedback(pendingDelete)}
        title="删除反馈"
        message="确定要删除这条反馈吗？"
        confirmText="删除"
      />
    </div>
  );
}
