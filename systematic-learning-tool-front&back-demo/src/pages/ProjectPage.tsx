// ============================================================
// Project 页面：项目卡片网格 + 新建 / 编辑项目表单
// ============================================================

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, FolderKanban, Loader2, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import type { Project, ProjectStatus, ProjectTypeId } from "../types";
import { PROJECT_TYPES } from "../types";
import { COVER_GRADIENTS, ConfirmDialog, EmptyState, Modal, ProgressBar, StatusBadge } from "../components/ui";
import { StageProgress } from "../components/StageProgress";
import { navigateTo } from "../components/Header";

type Filter = "all" | ProjectStatus;

interface FormState {
  name: string;
  description: string;
  type: ProjectTypeId;
  dueDate: string;
  startDate: string;
  refLink: string;
}

const EMPTY_FORM: FormState = { name: "", description: "", type: "product", dueDate: "", startDate: "", refLink: "" };

export function ProjectPage() {
  const { projects, createProject, updateProject, deleteProject, archiveProject, toast } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; description?: string; refLink?: string }>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const filtered = useMemo(() => {
    const list = filter === "all" ? projects : projects.filter((p) => p.status === filter);
    return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [projects, filter]);

  const generatingCount = projects.filter((p) => p.status === "generating").length;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      type: p.type,
      dueDate: p.dueDate?.slice(0, 10) ?? "",
      startDate: p.startDate?.slice(0, 10) ?? "",
      refLink: p.refLink ?? "",
    });
    setErrors({});
    setFormOpen(true);
  };

  const submit = async () => {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "请输入项目名称";
    if (!form.description.trim()) errs.description = "请输入项目描述 / 目标";
    if (form.description.trim().length > 200) errs.description = "描述请控制在 200 字以内";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const link = form.refLink.trim();
    if (link && !/^https?:\/\/.+/.test(link)) {
      errs.refLink = "参考链接需以 http(s):// 开头";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    if (editing) {
      updateProject(editing.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        dueDate: form.dueDate || undefined,
        startDate: form.startDate || undefined,
        refLink: link || undefined,
      });
      toast("success", "项目已更新 ✓");
    } else {
      const id = await createProject({
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        dueDate: form.dueDate || undefined,
        startDate: form.startDate || undefined,
        refLink: link || undefined,
      });
      toast("info", "项目已创建，正在生成调研报告…");
      setFormOpen(false);
      navigateTo("projects", id);
    }
  };

  const taskSummary = (p: Project) => {
    const done = p.tasks.filter((t) => t.done).length;
    return p.tasks.length ? `${done}/${p.tasks.length} 项任务` : "暂无任务";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 页头 */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-ink-900 dark:text-forest-100">
            项目规划与执行 <span className="inline-block">🚀</span>
          </h1>
          <p className="mt-2 text-[15px] text-ink-600 dark:text-forest-300/80">
            为每个项目生成调研报告与实施路线图，并用任务清单持续追踪进度。
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary !px-5 !py-2.5">
          <Plus size={17} /> 新建项目
        </button>
      </div>

      {/* 生成中的项目 */}
      {generatingCount > 0 && (
        <section className="mb-8 space-y-4" aria-label="正在生成报告的项目">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink-900 dark:text-forest-100">
            <Loader2 size={19} className="text-forest-500 animate-[spin_2s_linear_infinite]" />
            调研报告生成中
          </h2>
          {projects
            .filter((p) => p.status === "generating")
            .map((p) => (
              <div key={p.id}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[15px] font-bold text-ink-900 dark:text-forest-100">{p.name}</p>
                  <button onClick={() => navigateTo("projects", p.id)} className="btn-ghost !py-1 !text-[13px]">
                    查看详情 →
                  </button>
                </div>
                <StageProgress stages={p.stages} overall={p.progress} />
              </div>
            ))}
        </section>
      )}

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["all", "全部"],
            ["planning", "规划中"],
            ["in_progress", "进行中"],
            ["completed", "已完成"],
            ["archived", "已归档"],
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

      {/* 卡片网格 */}
      {filtered.length === 0 ? (
        <EmptyState
          emoji="🗂️"
          title="还没有项目"
          desc="创建一个项目，系统将为你生成调研报告与分阶段实施路线图"
          action={
            <button onClick={openCreate} className="btn-primary">
              <Plus size={16} /> 新建项目
            </button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const type = PROJECT_TYPES.find((t) => t.id === p.type);
            return (
              <article key={p.id} className="card card-hover overflow-hidden group">
                {/* 封面 */}
                <div
                  className={cn(
                    "relative flex h-28 items-center justify-center bg-gradient-to-br",
                    COVER_GRADIENTS[p.cover % COVER_GRADIENTS.length]
                  )}
                >
                  <span className="text-4xl" aria-hidden>
                    {type?.emoji ?? "📌"}
                  </span>
                  <div className="absolute right-3 top-3">
                    <StatusBadge status={p.status} className={cn(p.status === "generating" && "!bg-white/90 !text-forest-700")} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
                    <div
                      className="h-full bg-white/90 transition-all duration-300"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>

                {/* 内容 */}
                <div className="p-5">
                  <h3
                    onClick={() => navigateTo("projects", p.id)}
                    className="cursor-pointer text-lg font-bold text-ink-900 dark:text-forest-100 transition-colors group-hover:text-forest-600 dark:group-hover:text-forest-300 line-clamp-1"
                  >
                    {p.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 min-h-[3rem] text-[13px] leading-relaxed text-ink-600 dark:text-forest-300/70">
                    {p.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[12px] text-ink-600 dark:text-forest-300/70">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} />
                      创建于 {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-forest-500" />
                      {taskSummary(p)}
                    </span>
                  </div>
                  {p.dueDate && (
                    <p className="mt-1 text-[12px] text-amberx">⏰ 目标日期：{p.dueDate}</p>
                  )}

                  <ProgressBar value={p.progress} className="mt-3" />

                  <div className="mt-4 flex items-center justify-between border-t border-ink-200/60 dark:border-night-600 pt-3">
                    <button onClick={() => navigateTo("projects", p.id)} className="btn-soft !py-1.5 !text-[13px]">
                      <Rocket size={14} /> 打开
                    </button>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-forest-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
                        aria-label="编辑项目"
                        title="编辑"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => archiveProject(p.id)}
                        className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-forest-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
                        aria-label={p.status === "archived" ? "取消归档" : "归档"}
                        title={p.status === "archived" ? "取消归档" : "归档"}
                      >
                        <FolderKanban size={15} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(p)}
                        className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer"
                        aria-label="删除项目"
                        title="删除"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 新建 / 编辑项目弹窗 */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "编辑项目" : "新建项目"}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setFormOpen(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={submit}>
              {editing ? "保存修改" : "创建并生成报告"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
              项目名称 <span className="text-coral">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              className={cn("input", errors.name && "input-error")}
              placeholder="如：AI 聊天机器人"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="mt-1 text-[13px] text-coral">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
              项目描述 / 目标 <span className="text-coral">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
                if (errors.description) setErrors({ ...errors, description: undefined });
              }}
              rows={3}
              className={cn("input resize-none", errors.description && "input-error")}
              placeholder="用一两句话描述项目要解决的问题与成功标准…"
              aria-invalid={!!errors.description}
            />
            {errors.description && <p className="mt-1 text-[13px] text-coral">{errors.description}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">项目类型</label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setForm({ ...form, type: t.id })}
                    aria-pressed={form.type === t.id}
                    className={cn(
                      "chip",
                      form.type === t.id
                        ? "border-forest-500 bg-forest-100 text-forest-700 dark:bg-night-700 dark:text-forest-200 dark:border-forest-500"
                        : "border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 text-ink-600 dark:text-forest-300/70"
                    )}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">目标完成日期（可选）</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="input cursor-pointer"
                aria-label="目标完成日期"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">开始日期（可选）</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input cursor-pointer"
                aria-label="开始日期"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">参考链接（可选）</label>
              <input
                value={form.refLink}
                onChange={(e) => {
                  setForm({ ...form, refLink: e.target.value });
                  if (errors.refLink) setErrors({ ...errors, refLink: undefined });
                }}
                className={cn("input", errors.refLink && "input-error")}
                placeholder="https://example.com（竞品 / 参考文档等）"
                aria-invalid={!!errors.refLink}
              />
              {errors.refLink && <p className="mt-1 text-[13px] text-coral">{errors.refLink}</p>}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteProject(pendingDelete.id)}
        title="删除项目"
        message={`确定要删除项目「${pendingDelete?.name}」吗？其任务与报告将一并删除，此操作不可恢复。`}
        confirmText="删除"
      />
    </div>
  );
}
