// ============================================================
// 项目详情页：调研报告 + 任务追踪 + 时间线 / 进度统计
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Circle, Flag, ListTodo, Plus, Trash2, TrendingUp } from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import type { TaskPhase } from "../types";
import { PROJECT_TYPES, TASK_PHASES } from "../types";
import { ConfirmDialog, ProgressBar, StatusBadge } from "../components/ui";
import { StageProgress } from "../components/StageProgress";
import { ReportViewer } from "../components/ReportViewer";
import { navigateTo } from "../components/Header";

export function ProjectDetailPage({ id }: { id: string }) {
  const { projects, loadProject, addTask, toggleTask, deleteTask, markProjectDone, toast } = useStore();
  const [newTask, setNewTask] = useState("");
  const [newPhase, setNewPhase] = useState<TaskPhase>("准备");
  const [confirmDone, setConfirmDone] = useState(false);

  const project = projects.find((p) => p.id === id);

  useEffect(() => {
    loadProject(id).catch(error => {
      toast("error", `项目详情加载失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    });
  }, [id, loadProject, toast]);

  const stats = useMemo(() => {
    if (!project) return { total: 0, done: 0 };
    return { total: project.tasks.length, done: project.tasks.filter((t) => t.done).length };
  }, [project]);

  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-ink-600 dark:text-forest-300">未找到该项目，可能已被删除。</p>
        <button onClick={() => navigateTo("projects")} className="btn-soft mt-4">
          <ArrowLeft size={15} /> 返回项目列表
        </button>
      </div>
    );
  }

  const type = PROJECT_TYPES.find((t) => t.id === project.type);
  const daysLeft = project.dueDate
    ? Math.ceil((+new Date(project.dueDate) - Date.now()) / 86400000)
    : null;

  const submitTask = () => {
    const v = newTask.trim();
    if (!v) {
      toast("error", "请输入任务内容");
      return;
    }
    addTask(project.id, v, newPhase);
    setNewTask("");
    toast("success", "任务已添加 ✓");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 页头 */}
      <div className="no-print mb-6">
        <button onClick={() => navigateTo("projects")} className="btn-ghost !px-2.5 -ml-2 mb-4">
          <ArrowLeft size={16} /> 返回项目列表
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              {type && (
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 dark:bg-night-700 px-2.5 py-0.5 text-xs font-medium text-forest-600 dark:text-forest-300">
                  {type.emoji} {type.label}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-ink-600 dark:text-forest-300/70">
                <CalendarDays size={13} />
                {project.startDate && `${project.startDate} 起 · `}
                {project.dueDate ? `目标日期 ${project.dueDate}` : "未设置截止日期"}
                {daysLeft !== null && (
                  <b className={cn(daysLeft < 0 ? "text-coral" : daysLeft <= 7 ? "text-amberx" : "text-forest-500")}>
                    （{daysLeft < 0 ? `已超期 ${-daysLeft} 天` : `剩余 ${daysLeft} 天`}）
                  </b>
                )}
              </span>
            </div>
            <div className="mt-2">
              {project.refLink && (
                <a
                  href={project.refLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-skyx underline underline-offset-2 hover:text-forest-600 dark:hover:text-forest-300 transition-colors"
                >
                  🔗 参考链接
                </a>
              )}
            </div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-ink-900 dark:text-forest-100">{project.name}</h1>
            <p className="mt-1 max-w-xl text-[14px] text-ink-600 dark:text-forest-300/80">{project.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {project.status !== "completed" && project.status !== "generating" && (
              <button onClick={() => setConfirmDone(true)} className="btn-soft">
                <CheckCircle2 size={16} /> 标记完成
              </button>
            )}
            <button onClick={() => window.print()} className="btn-outline">
              📄 导出报告
            </button>
          </div>
        </div>
      </div>

      {/* 报告内容 */}
      {project.status === "generating" ? (
        <StageProgress stages={project.stages} overall={project.progress} />
      ) : project.status === "error" ? (
        <section className="card p-8 text-center" role="alert">
          <h2 className="text-lg font-bold text-coral">项目报告生成失败</h2>
          <p className="mt-2 text-sm text-ink-600 dark:text-forest-300/70">请检查 AI 配置或网络连接后重新创建项目。</p>
        </section>
      ) : (
        <>
          <ReportViewer content={project.content} />

          {/* 任务追踪 + 统计 */}
          <section className="no-print mt-8 grid gap-6 lg:grid-cols-3" aria-label="任务追踪">
            {/* 任务列表 */}
            <div className="card p-6 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
                  <ListTodo size={19} className="text-forest-500" /> 任务追踪
                </h2>
                <span className="text-[13px] text-ink-600 dark:text-forest-300/70">
                  已完成 <b className="text-forest-600 dark:text-forest-300">{stats.done}</b> / {stats.total} 项
                </span>
              </div>

              {/* 添加任务 */}
              <div className="mb-5 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTask()}
                  className="input flex-1"
                  placeholder="添加新任务，如：完成用户访谈…"
                  aria-label="新任务内容"
                />
                <div className="flex gap-2">
                  <select
                    value={newPhase}
                    onChange={(e) => setNewPhase(e.target.value as TaskPhase)}
                    className="input !w-24 cursor-pointer"
                    aria-label="任务所属阶段"
                  >
                    {TASK_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <button onClick={submitTask} className="btn-primary shrink-0" aria-label="添加任务">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* 按阶段分组 */}
              <div className="space-y-5">
                {TASK_PHASES.map((phase) => {
                  const tasks = project.tasks.filter((t) => t.phase === phase);
                  if (tasks.length === 0) return null;
                  const phaseDone = tasks.filter((t) => t.done).length;
                  return (
                    <div key={phase}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-[13px] font-bold text-forest-600 dark:text-forest-300">
                          <Flag size={13} /> {phase}阶段
                        </p>
                        <ProgressBar value={(phaseDone / tasks.length) * 100} className="!w-24" />
                      </div>
                      <ul className="space-y-1.5">
                        {tasks.map((t) => (
                          <li
                            key={t.id}
                            className="group flex items-center gap-3 rounded-lg border border-ink-200/70 dark:border-night-600 bg-forest-50/50 dark:bg-night-700/40 px-3 py-2.5 transition-colors hover:border-forest-300"
                          >
                            <button
                              onClick={() => toggleTask(project.id, t.id)}
                              aria-label={t.done ? "标记未完成" : "标记完成"}
                              className="shrink-0 cursor-pointer"
                            >
                              {t.done ? (
                                <CheckCircle2 size={20} className="text-forest-500" />
                              ) : (
                                <Circle size={20} className="text-ink-300 dark:text-night-600" />
                              )}
                            </button>
                            <span
                              className={cn(
                                "flex-1 text-[14px] transition-colors",
                                t.done
                                  ? "text-ink-600 dark:text-forest-300/50 line-through"
                                  : "text-ink-900 dark:text-forest-100"
                              )}
                            >
                              {t.title}
                            </span>
                            {t.dueDate && <span className="text-xs text-ink-600 dark:text-forest-300/60">{t.dueDate}</span>}
                            <button
                              onClick={() => deleteTask(project.id, t.id)}
                              className="rounded p-1 text-ink-600/50 opacity-0 transition-all hover:bg-coral/10 hover:text-coral group-hover:opacity-100 cursor-pointer"
                              aria-label="删除任务"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {project.tasks.length === 0 && (
                  <p className="rounded-lg border border-dashed border-ink-300 dark:border-night-600 p-6 text-center text-[13px] text-ink-600 dark:text-forest-300/70">
                    还没有任务，从上方添加第一个任务开始执行吧 ✍️
                  </p>
                )}
              </div>
            </div>

            {/* 统计 + 时间线 */}
            <div className="space-y-6">
              {/* 进度统计 */}
              <div className="card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
                  <TrendingUp size={19} className="text-forest-500" /> 进度统计
                </h2>
                <div className="mb-1.5 flex items-end justify-between">
                  <span className="text-3xl font-extrabold text-forest-600 dark:text-forest-300">{project.progress}%</span>
                  <span className="text-xs text-ink-600 dark:text-forest-300/70">总体进度</span>
                </div>
                <ProgressBar value={project.progress} className="h-2" />
                <dl className="mt-5 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-forest-50 dark:bg-night-700 p-3">
                    <dt className="text-xs text-ink-600 dark:text-forest-300/70">总任务</dt>
                    <dd className="mt-0.5 text-xl font-extrabold text-ink-900 dark:text-forest-100">{stats.total}</dd>
                  </div>
                  <div className="rounded-lg bg-forest-50 dark:bg-night-700 p-3">
                    <dt className="text-xs text-ink-600 dark:text-forest-300/70">已完成</dt>
                    <dd className="mt-0.5 text-xl font-extrabold text-forest-600 dark:text-forest-300">{stats.done}</dd>
                  </div>
                  <div className="rounded-lg bg-forest-50 dark:bg-night-700 p-3">
                    <dt className="text-xs text-ink-600 dark:text-forest-300/70">里程碑</dt>
                    <dd className="mt-0.5 text-xl font-extrabold text-ink-900 dark:text-forest-100">{project.milestones.length || 4}</dd>
                  </div>
                  <div className="rounded-lg bg-forest-50 dark:bg-night-700 p-3">
                    <dt className="text-xs text-ink-600 dark:text-forest-300/70">报告字数</dt>
                    <dd className="mt-0.5 text-xl font-extrabold text-ink-900 dark:text-forest-100">
                      {(project.wordCount / 1000).toFixed(1)}k
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 时间线 */}
              <div className="card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
                  <CalendarDays size={19} className="text-forest-500" /> 实施时间线
                </h2>
                <ol className="relative space-y-5 border-l-2 border-forest-200 dark:border-night-600 pl-5">
                  {(project.milestones.length ? project.milestones : TASK_PHASES.map((p) => ({ phase: p, name: `${p}阶段`, duration: "待定", goal: "" }))).map(
                    (m, i) => {
                      const phaseTasks = project.tasks.filter((t) => t.phase === m.phase);
                      const done = phaseTasks.filter((t) => t.done).length;
                      const isPhaseDone = phaseTasks.length > 0 && done === phaseTasks.length;
                      return (
                        <li key={m.phase + i} className="relative">
                          <span
                            className={cn(
                              "absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-night-800",
                              isPhaseDone ? "bg-forest-500" : phaseTasks.length > 0 ? "bg-amberx" : "bg-ink-300 dark:bg-night-600"
                            )}
                            aria-hidden
                          />
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <p className="text-sm font-bold text-ink-900 dark:text-forest-100">
                              {i + 1}. {m.name}
                            </p>
                            <span className="text-xs font-semibold text-forest-500 dark:text-forest-300">{m.duration}</span>
                          </div>
                          <p className="mt-0.5 text-[13px] text-ink-600 dark:text-forest-300/70">{m.goal}</p>
                          {phaseTasks.length > 0 && (
                            <p className="mt-1 text-xs text-ink-600 dark:text-forest-300/60">
                              任务进度：{done}/{phaseTasks.length}
                            </p>
                          )}
                        </li>
                      );
                    }
                  )}
                </ol>
              </div>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmDone}
        onClose={() => setConfirmDone(false)}
        onConfirm={() => {
          markProjectDone(project.id);
          toast("success", "恭喜完成项目！🎉");
        }}
        title="标记项目完成"
        message={`确定将「${project.name}」标记为已完成吗？进度将更新为 100%。`}
        confirmText="标记完成"
      />
    </div>
  );
}
