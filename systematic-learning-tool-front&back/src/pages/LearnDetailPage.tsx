// ============================================================
// Learn 报告详情页：三阶段进度 / 完整报告 + 收藏、分享、历史版本
// ============================================================

import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, History, Link2, Loader2, RefreshCw, RotateCcw, Share2, Star } from "lucide-react";
import { useStore } from "../store/useStore";
import { api } from "../services/apiClient";
import { CATEGORIES } from "../types";
import type { LearnReport } from "../types";
import { CategoryBadge, ConfirmDialog, Modal, StatusBadge } from "../components/ui";
import { StageProgress } from "../components/StageProgress";
import { ReportViewer } from "../components/ReportViewer";
import { navigateTo } from "../components/Header";

export function LearnDetailPage({ id }: { id: string }) {
  const { reports, toggleFavorite, archiveReport, deleteReport, refreshReport, stuckReportIds, toast } = useStore();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; version: number; created_at: string; content: string }>>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const report = reports.find((r) => r.id === id);

  // Fetch the full version history (content + metadata) when the modal opens.
  useEffect(() => {
    if (!versionsOpen) return;
    let cancelled = false;
    setVersionsLoading(true);
    api.getReportVersions(id)
      .then(list => { if (!cancelled) setVersions(list || []); })
      .catch((e) => { if (!cancelled) toast("error", `加载历史版本失败：${(e as Error).message}`); })
      .finally(() => { if (!cancelled) setVersionsLoading(false); });
    return () => { cancelled = true; };
  }, [versionsOpen, id, toast]);

  const restoreVersion = async (versionId: string, v: number) => {
    try {
      await api.restoreReportVersion(id, versionId);
      const updated = await api.getReport(id);
      // Update local store + versions list.
      useStore.setState(s => ({
        reports: s.reports.map(rp => rp.id === id
          ? { ...rp, content: updated.content, wordCount: (updated.content || "").replace(/\s/g, "").length, updatedAt: new Date().toISOString() }
          : rp),
      }));
      const refreshed = await api.getReportVersions(id);
      setVersions(refreshed || []);
      toast("success", `已恢复到版本 v${v}`);
    } catch (e) {
      toast("error", `恢复版本失败：${(e as Error).message}`);
    }
  };

  if (!report) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-ink-600 dark:text-forest-300">未找到该报告，可能已被删除。</p>
        <button onClick={() => navigateTo("learn")} className="btn-soft mt-4">
          <ArrowLeft size={15} /> 返回学习列表
        </button>
      </div>
    );
  }

  const category = CATEGORIES.find((c) => c.id === report.category);

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast("success", "链接已复制到剪贴板 🔗");
    } catch {
      toast("info", `分享链接：${url}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 页头 */}
      <div className="no-print mb-6">
        <button onClick={() => navigateTo("learn")} className="btn-ghost !px-2.5 -ml-2 mb-4">
          <ArrowLeft size={16} /> 返回学习列表
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              {category && <CategoryBadge label={category.label} emoji={category.emoji} />}
              {report.favorite && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amberx/15 px-2.5 py-0.5 text-xs font-semibold text-amberx">
                  <Star size={12} className="fill-amberx" /> 已收藏
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-ink-900 dark:text-forest-100">{report.subject}</h1>
            <p className="mt-1 text-[13px] text-ink-600 dark:text-forest-300/70">
              创建于 {new Date(report.createdAt).toLocaleString("zh-CN")} · 共 {report.wordCount.toLocaleString()} 字 · 版本 {report.versions.length + 1}
            </p>
          </div>

          {/* 功能按钮 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => toggleFavorite(report.id)}
              className={report.favorite ? "btn-soft" : "btn-outline"}
              aria-label={report.favorite ? "取消收藏" : "收藏"}
            >
              <Star size={16} className={report.favorite ? "fill-amberx text-amberx" : ""} />
              {report.favorite ? "已收藏" : "收藏"}
            </button>
            <button onClick={() => window.print()} className="btn-outline" aria-label="导出 PDF">
              📄 导出
            </button>
            <button onClick={share} className="btn-outline" aria-label="分享链接">
              <Share2 size={16} /> 分享
            </button>
            <button onClick={() => setVersionsOpen(true)} className="btn-outline" aria-label="历史版本">
              <History size={16} /> 版本
            </button>
            <button
              onClick={() => archiveReport(report.id)}
              className="btn-outline"
              aria-label={report.status === "archived" ? "取消归档" : "归档"}
            >
              {report.status === "archived" ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {report.status === "archived" ? "取消归档" : "归档"}
            </button>
            <button onClick={() => setConfirmDelete(true)} className="btn-danger" aria-label="删除报告">
              删除
            </button>
          </div>
        </div>
      </div>

      {/* 内容 */}
      {report.status === "error" ? (
        <div className="card p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral/15 text-coral text-2xl" aria-hidden>
            ⚠
          </div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-forest-100">报告生成失败</h2>
          <p className="mx-auto max-w-md text-[14px] text-ink-600 dark:text-forest-300/80">
            后端在生成「{report.subject}」时遇到问题。你可以删除这条记录后用同一个主题重试，或者调整主题表述。
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setConfirmDelete(true)} className="btn-danger">删除记录</button>
            <button onClick={() => navigateTo("learn")} className="btn-soft">返回列表</button>
          </div>
        </div>
      ) : report.status === "generating" ? (
        <div className="space-y-6">
          <StageProgress stages={report.stages} overall={report.progress} />
          <div className="card p-6 space-y-3" aria-busy="true" aria-label="报告加载中">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-600 dark:text-forest-300/70">
                <Loader2 size={15} className="animate-[spin_2s_linear_infinite] text-forest-500" />
                正在生成报告内容，完成后将自动呈现…
              </div>
              {stuckReportIds.includes(report.id) && (
                <button
                  onClick={() => refreshReport(report.id)}
                  className="btn-soft !py-1 !text-[13px]"
                  title="后端可能仍在生成中，点击重新检查进度"
                >
                  <RefreshCw size={13} /> 手动刷新
                </button>
              )}
            </div>
            {stuckReportIds.includes(report.id) && (
              <p className="text-xs text-amberx">
                进度推送超时（10 秒未收到事件）。可点击「手动刷新」重连。
              </p>
            )}
            <DetailSkeletonLines />
          </div>
        </div>
      ) : (
        <>
        <ReportViewer
          content={report.content}
          extraActions={
            <>
              <button onClick={share} className="btn-soft !px-2.5" aria-label="分享">
                <Link2 size={16} />
              </button>
              <button onClick={() => toggleFavorite(report.id)} className="btn-soft !px-2.5" aria-label="收藏">
                <Star size={16} className={report.favorite ? "fill-amberx text-amberx" : ""} />
              </button>
            </>
          }
          footer={
            <div className="mt-8 rounded-xl bg-forest-50 dark:bg-night-700 p-4 text-[13px] text-ink-600 dark:text-forest-300/80">
              💡 本报告由横纵分析法自动生成，建议配合「实践清单」输出学习笔记；你也可以在
              <button onClick={() => navigateTo("feedback")} className="mx-1 font-bold text-forest-600 dark:text-forest-300 underline underline-offset-2 cursor-pointer">
                反馈页
              </button>
              提交评价帮助改进。
            </div>
          }
        />
        <ResearchSources meta={report.researchMeta} />
        </>
      )}

      {/* 历史版本弹窗 */}
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title="历史版本">
        <div className="space-y-2">
          {versionsLoading && <p className="text-sm text-ink-600 dark:text-forest-300/70">加载中…</p>}
          {!versionsLoading && versions.length === 0 && (
            <p className="text-sm text-ink-600 dark:text-forest-300/70">暂无历史版本记录。每次报告内容变更会自动保留上一版。</p>
          )}
          {versions.map(v => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-ink-200 dark:border-night-600 px-4 py-2.5 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-900 dark:text-forest-100">版本 v{v.version}</div>
                <div className="text-xs text-ink-600 dark:text-forest-300/70">{new Date(v.created_at).toLocaleString("zh-CN")}</div>
              </div>
              <button
                onClick={() => restoreVersion(v.id, v.version)}
                className="btn-soft !py-1 !text-[13px] shrink-0 ml-2"
                aria-label={`恢复到版本 v${v.version}`}
                title="恢复到该版本"
              >
                <RotateCcw size={13} /> 恢复
              </button>
            </div>
          ))}
          <div className="flex w-full items-center justify-between rounded-lg border border-forest-500/50 bg-forest-50 dark:bg-night-700 px-4 py-2.5 text-sm">
            <span className="font-bold text-forest-600 dark:text-forest-300">当前版本</span>
            <span className="text-xs text-ink-600 dark:text-forest-300/70">{new Date(report.updatedAt).toLocaleString("zh-CN")}</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteReport(report.id);
          navigateTo("learn");
        }}
        title="删除学习报告"
        message={`确定要删除「${report.subject}」的报告吗？此操作不可恢复。`}
        confirmText="删除"
      />
    </div>
  );
}

function ResearchSources({ meta }: { meta?: LearnReport["researchMeta"] }) {
  if (!meta) return null;
  return (
    <section className="card mt-6 p-5" aria-label="研究来源">
      <h2 className="text-base font-bold text-ink-900 dark:text-forest-100">研究来源与时效</h2>
      <p className="mt-1 text-xs text-ink-600 dark:text-forest-300/70">
        {meta.available ? `已通过 ${meta.provider || "联网搜索"} 检索于 ${meta.searchedAt ? new Date(meta.searchedAt).toLocaleString("zh-CN") : "未知时间"}` : `未执行联网搜索：${meta.warning || "未配置搜索提供商"}`}
      </p>
      {meta.results?.length > 0 && (
        <ol className="mt-3 space-y-2 text-sm">
          {meta.results.map((source, index) => (
            <li key={`${source.url}-${index}`}>
              <a className="font-medium text-forest-600 underline" href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.title || source.url}</a>
              {source.publishedAt && <span className="ml-2 text-xs text-ink-500">{source.publishedAt}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DetailSkeletonLines() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-11/12" />
        </div>
      ))}
    </div>
  );
}
