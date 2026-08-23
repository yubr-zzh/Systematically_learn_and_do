// ============================================================
// Learn 页面：主题输入 → 三阶段生成 → 历史学习列表
// ============================================================

import { useMemo, useState } from "react";
import { ArrowRight, Archive, ArchiveRestore, BookOpen, CalendarDays, FileText, Loader2, RefreshCw, Search, Sparkles, Star, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import type { CategoryId, LearnReport } from "../types";
import { CATEGORIES } from "../types";
import { ConfirmDialog, EmptyState, ProgressBar, Skeleton, StatusBadge } from "../components/ui";
import { StageProgress } from "../components/StageProgress";
import { navigateTo } from "../components/Header";

const QUICK_TAGS: { label: string; category: CategoryId }[] = [
  { label: "AI 人工智能", category: "ai" },
  { label: "编程开发", category: "coding" },
  { label: "设计创意", category: "design" },
  { label: "商业管理", category: "business" },
  { label: "语言学习", category: "general" },
  { label: "心理学", category: "general" },
];

type Filter = "all" | "completed" | "archived" | "favorite";

export function LearnPage() {
  const { reports, startLearn, refreshReport, toggleFavorite, deleteReport, archiveReport, stuckReportIds } = useStore();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<CategoryId>("ai");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "words">("newest");
  const [pendingDelete, setPendingDelete] = useState<LearnReport | null>(null);
  const [inputError, setInputError] = useState("");

  const generating = reports.filter((r) => r.status === "generating");

  const filtered = useMemo(() => {
    // 历史列表排除「生成中」（在专用的 “生成中的报告” 区展示），
    // 但保留「生成失败」，让用户可以查看/重新触发归档/删除。
    let list = reports.filter((r) => r.status !== "generating");
    if (filter === "completed") list = list.filter((r) => r.status === "completed");
    if (filter === "archived") list = list.filter((r) => r.status === "archived");
    if (filter === "favorite") list = list.filter((r) => r.favorite);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.subject.toLowerCase().includes(q) || r.title.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === "oldest") return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sort === "words") return b.wordCount - a.wordCount;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
  }, [reports, filter, search, sort]);

  const submit = async () => {
    const v = subject.trim();
    if (!v) {
      setInputError("请输入你想学习的主题");
      return;
    }
    if (v.length > 50) {
      setInputError("主题请控制在 50 字以内");
      return;
    }
    setInputError("");
    const id = await startLearn(v, category);
    setSubject("");
    navigateTo("learn", id);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 页头 */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-ink-900 dark:text-forest-100">
          系统学习，深度掌握 <span className="inline-block">📚</span>
        </h1>
        <p className="mt-2 text-[15px] text-ink-600 dark:text-forest-300/80">
          输入任意主题，横纵分析法引擎将生成一份包含领域边界、历史脉络、深度调研与学习路线的结构化报告。
        </p>
      </div>

      {/* 输入卡片 */}
      <section className="card overflow-hidden" aria-label="创建学习主题">
        <div className="h-1.5 bg-gradient-to-r from-forest-600 via-forest-400 to-forest-300" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (inputError) setInputError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className={cn("input !py-3.5 !text-base", inputError && "input-error")}
                placeholder="输入你想学习的主题，如：React 框架、人工智能、产品设计…"
                aria-label="学习主题"
                aria-invalid={!!inputError}
              />
              {inputError && <p className="mt-1.5 text-[13px] text-coral">{inputError}</p>}
            </div>
            <button onClick={submit} className="btn-primary !px-6 !py-3.5 !text-base shrink-0" aria-label="开始生成研究报告">
              <Sparkles size={18} />
              开始研究
            </button>
          </div>

          {/* 分类选择 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-ink-600 dark:text-forest-300/70">领域：</span>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={cn(
                  "chip",
                  category === c.id
                    ? "border-forest-500 bg-forest-100 text-forest-700 dark:bg-night-700 dark:text-forest-200 dark:border-forest-500"
                    : "border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 text-ink-600 dark:text-forest-300/70 hover:border-forest-400"
                )}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* 快捷标签 */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-200/60 dark:border-night-600 pt-4">
            <span className="text-[13px] font-semibold text-ink-600 dark:text-forest-300/70">热门主题：</span>
            {QUICK_TAGS.map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  setSubject(t.label.replace(/^[^\s]+\s/, ""));
                  setCategory(t.category);
                }}
                className="chip border-ink-200 dark:border-night-600 bg-forest-50 dark:bg-night-800 text-ink-700 dark:text-forest-200 hover:border-forest-400 hover:text-forest-600 dark:hover:text-forest-200"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 生成中的报告 */}
      {generating.length > 0 && (
        <section className="mt-10" aria-label="正在生成的报告">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-ink-900 dark:text-forest-100">
            <Loader2 size={19} className="text-forest-500 animate-[spin_2s_linear_infinite]" />
            生成中的报告
          </h2>
          <div className="space-y-4">
            {generating.map((r) => {
              const stuck = stuckReportIds.includes(r.id);
              return (
                <div key={r.id} className="animate-slide-up">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[15px] font-bold text-ink-900 dark:text-forest-100">
                      {r.subject} <span className="ml-1 text-xs font-medium text-ink-600 dark:text-forest-300/70">({CATEGORIES.find((c) => c.id === r.category)?.label})</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {stuck && (
                        <button
                          onClick={() => refreshReport(r.id)}
                          className="btn-soft !py-1 !text-[13px]"
                          title="后端可能仍在生成中，点击重新检查进度"
                        >
                          <RefreshCw size={13} /> 手动刷新
                        </button>
                      )}
                      <button onClick={() => navigateTo("learn", r.id)} className="btn-ghost !py-1 !text-[13px]">
                        查看详情 <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                  <StageProgress stages={r.stages} overall={r.progress} />
                  {stuck && (
                    <p className="mt-2 text-xs text-amberx">
                      进度推送超时（10 秒未收到事件）。可点击「手动刷新」重连；若后端已失败，状态会自动转为「生成失败」。
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 历史学习列表 */}
      <section className="mt-10" aria-label="历史学习列表">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink-900 dark:text-forest-100">
            <BookOpen size={20} className="text-forest-500" />
            历史学习
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input !w-44 !py-2 !pl-9 !text-[13px]"
                placeholder="搜索主题…"
                aria-label="搜索学习报告"
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input !w-28 !py-2 !text-[13px] cursor-pointer" aria-label="排序方式">
              <option value="newest">最新优先</option>
              <option value="oldest">最早优先</option>
              <option value="words">字数优先</option>
            </select>
          </div>
        </div>

        {/* 筛选 */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "全部"],
              ["completed", "已完成"],
              ["archived", "已归档"],
              ["favorite", "⭐ 收藏"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "chip",
                filter === key
                  ? "bg-forest-600 text-white border-forest-600"
                  : "bg-white dark:bg-night-800 text-ink-600 dark:text-forest-300/70 border-ink-200 dark:border-night-600 hover:border-forest-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            emoji="🍃"
            title={search ? "没有找到匹配的报告" : "还没有学习报告"}
            desc={search ? "换个关键词试试，或清除搜索条件" : "在上方输入一个主题，开始你的第一份系统化研究报告吧"}
            action={
              !search ? (
                <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn-primary">
                  <Sparkles size={16} /> 开始学习
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((r) => (
              <article key={r.id} className="card card-hover p-5 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-ink-600 dark:text-forest-300/70">
                        {CATEGORIES.find((c) => c.id === r.category)?.emoji} {CATEGORIES.find((c) => c.id === r.category)?.label}
                      </span>
                    </div>
                    <h3
                      onClick={() => navigateTo("learn", r.id)}
                      className="cursor-pointer text-lg font-bold text-ink-900 dark:text-forest-100 transition-colors group-hover:text-forest-600 dark:group-hover:text-forest-300 line-clamp-1"
                    >
                      {r.subject}
                    </h3>
                  </div>
                  <button
                    onClick={() => toggleFavorite(r.id)}
                    aria-label={r.favorite ? "取消收藏" : "收藏"}
                    className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-forest-50 dark:hover:bg-night-700 cursor-pointer"
                  >
                    <Star size={18} className={r.favorite ? "fill-amberx text-amberx" : "text-ink-300 dark:text-night-600"} />
                  </button>
                </div>

                <p className="mt-2 flex items-center gap-3 text-[13px] text-ink-600 dark:text-forest-300/70">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={13} /> {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={13} /> {r.wordCount.toLocaleString()} 字
                  </span>
                  <span className="text-xs text-forest-500">v{(r.versions.length + 1) || 1}</span>
                </p>

                {r.status === "generating" && <ProgressBar value={r.progress} className="mt-3" />}

                <div className="mt-4 flex items-center justify-between border-t border-ink-200/60 dark:border-night-600 pt-3">
                  <button onClick={() => navigateTo("learn", r.id)} className="btn-soft !py-1.5 !text-[13px]">
                    查看报告 <ArrowRight size={14} />
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => archiveReport(r.id)}
                      className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-forest-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
                      aria-label={r.status === "archived" ? "取消归档" : "归档"}
                      title={r.status === "archived" ? "取消归档" : "归档"}
                    >
                      {r.status === "archived" ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                    <button
                      onClick={() => setPendingDelete(r)}
                      className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer"
                      aria-label="删除报告"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteReport(pendingDelete.id)}
        title="删除学习报告"
        message={`确定要删除「${pendingDelete?.subject}」的报告吗？此操作不可恢复。`}
        confirmText="删除"
      />
    </div>
  );
}

/** 详情页加载骨架 */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-64 mb-4" />
      <Skeleton className="h-4 w-96 mb-8" />
      <div className="card p-6">
        <Skeleton className="h-6 w-40 mb-5" />
        <div className="grid gap-3 sm:grid-cols-3 mb-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}
