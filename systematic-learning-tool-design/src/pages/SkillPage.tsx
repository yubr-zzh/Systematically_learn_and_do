// ============================================================
// Skill 页面：Skill 管理、进化日志、模板库
// ============================================================

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CalendarDays,
  Edit3,
  Filter,
  Loader2,
  Plus,
  Star,
  Tag,
  Thermometer,
  Timer,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import type { CategoryId, EvolutionLog, Skill, SkillStatus } from "../types";
import { CATEGORIES, SKILL_STATUS_LABEL } from "../types";
import { ConfirmDialog, EmptyState, MarkdownRenderer, StatusBadge } from "../components/ui";
import { navigateTo } from "../components/Header";

type SkillFilter = "all" | SkillStatus;
type LogFilter = "all" | EvolutionLog["type"];

export function SkillPage() {
  const {
    skills,
    evolutionLogs,
    reports,
    addSkill,
    updateSkill,
    archiveSkill,
    pinSkill,
    deleteSkill,
    incrementSkillUsage,
    addEvolutionLog,
    toast,
  } = useStore();

  const [filter, setFilter] = useState<SkillFilter>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");

  // 创建表单状态
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryId>("general");
  const [newTags, setNewTags] = useState("");
  const [newContent, setNewContent] = useState("");

  // 编辑表单状态
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState<CategoryId>("general");
  const [editTags, setEditTags] = useState("");
  const [editContent, setEditContent] = useState("");

  const generating = reports.filter((r) => r.status === "generating");

  // 过滤后的 Skill 列表
  const filteredSkills = useMemo(() => {
    let list = skills;
    if (filter !== "all") {
      list = list.filter((s) => s.status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      // pinned 置顶，然后按使用次数降序
      if (a.status === "pinned" && b.status !== "pinned") return -1;
      if (b.status === "pinned" && a.status !== "pinned") return 1;
      return b.usageCount - a.usageCount;
    });
  }, [skills, filter, search]);

  // 过滤后的进化日志
  const filteredLogs = useMemo(() => {
    let list = evolutionLogs;
    if (logFilter !== "all") {
      list = list.filter((l) => l.type === logFilter);
    }
    return list.slice(0, 50);
  }, [evolutionLogs, logFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const active = skills.filter((s) => s.status === "active").length;
    const watch = skills.filter((s) => s.status === "watch").length;
    const stale = skills.filter((s) => s.status === "stale").length;
    const archived = skills.filter((s) => s.status === "archived").length;
    const pinned = skills.filter((s) => s.status === "pinned").length;
    const totalUsage = skills.reduce((sum, s) => sum + s.usageCount, 0);
    const avgRating =
      skills.filter((s) => s.rating > 0).length > 0
        ? (skills.reduce((sum, s) => sum + s.rating, 0) / skills.filter((s) => s.rating > 0).length).toFixed(1)
        : "0";
    return { active, watch, stale, archived, pinned, totalUsage, avgRating };
  }, [skills]);

  // 创建 Skill
  const handleCreate = () => {
    if (!newName.trim()) {
      toast("error", "请输入 Skill 名称");
      return;
    }
    const tags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    addSkill({
      name: newName.trim(),
      description: newDesc.trim(),
      category: newCategory,
      content: newContent.trim(),
      author: "用户自定义",
      tags,
    });
    setNewName("");
    setNewDesc("");
    setNewCategory("general");
    setNewTags("");
    setNewContent("");
    setShowCreate(false);
  };

  // 打开编辑
  const openEdit = (skill: Skill) => {
    setEditSkill(skill);
    setEditName(skill.name);
    setEditDesc(skill.description);
    setEditCategory(skill.category);
    setEditTags(skill.tags.join(", "));
    setEditContent(skill.content);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editSkill) return;
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateSkill(editSkill.id, {
      name: editName.trim() || editSkill.name,
      description: editDesc.trim(),
      category: editCategory,
      content: editContent.trim(),
      tags,
    });
    setEditSkill(null);
    toast("success", "Skill 已更新");
  };

  // 使用 Skill
  const handleUseSkill = (skill: Skill) => {
    incrementSkillUsage(skill.id);
    navigateTo("learn");
    toast("info", `正在使用「${skill.name}」模板...`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* 页头 */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-ink-900 dark:text-forest-100">
            Skill 库 <span className="inline-block">🧩</span>
          </h1>
          <p className="mt-2 text-[15px] text-ink-600 dark:text-forest-300/80">
            管理你的学习模板，查看进化日志。Skill 会根据你的反馈自动优化。
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0">
          <Plus size={18} /> 创建 Skill
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <StatCard label="活跃 Skill" value={stats.active} icon={Zap} color="text-forest-500" />
        <StatCard label="观察中" value={stats.watch} icon={Thermometer} color="text-sky-500" />
        <StatCard label="总使用次数" value={stats.totalUsage} icon={TrendingUp} color="text-purple-500" />
        <StatCard label="平均评分" value={stats.avgRating} icon={Star} color="text-amberx" />
      </div>

      {/* 筛选栏 */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-ink-600 dark:text-forest-300/70" />
          <span className="text-sm font-semibold text-ink-900 dark:text-forest-100">状态：</span>
        </div>
        {(
          [
            ["all", "全部"],
            ["active", "活跃"],
            ["watch", "观察中"],
            ["pinned", "置顶"],
            ["stale", "陈旧"],
            ["archived", "已归档"],
          ] as [SkillFilter, string][]
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
        <div className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input !w-48 !py-2 !text-[13px]"
          placeholder="搜索 Skill…"
          aria-label="搜索 Skill"
        />
      </div>

      {/* Skill 列表 */}
      {filteredSkills.length === 0 ? (
        <EmptyState
          emoji="📦"
          title={search ? "没有找到匹配的 Skill" : "还没有 Skill"}
          desc={
            search
              ? "换个关键词试试，或清除搜索条件"
              : "创建你的第一个学习模板，或等待 AI 自动生成"
          }
          action={
            !search ? (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus size={16} /> 创建第一个 Skill
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onUse={() => handleUseSkill(skill)}
              onEdit={() => openEdit(skill)}
              onArchive={() => archiveSkill(skill.id)}
              onPin={() => pinSkill(skill.id)}
              onDelete={() => setPendingDelete(skill)}
            />
          ))}
        </div>
      )}

      {/* 进化日志 */}
      <section className="mt-12" aria-label="进化日志">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
            <Timer size={18} className="text-forest-500" />
            进化日志
          </h2>
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value as LogFilter)}
            className="input !w-36 !py-1.5 !text-[13px] cursor-pointer"
            aria-label="筛选日志类型"
          >
            <option value="all">全部类型</option>
            <option value="skill_created">Skill 创建</option>
            <option value="skill_updated">Skill 更新</option>
            <option value="skill_archived">Skill 归档</option>
            <option value="skill_pinned">Skill 置顶</option>
            <option value="feedback_processed">反馈处理</option>
          </select>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 dark:border-night-600 p-6 text-center">
            <p className="text-sm text-ink-600 dark:text-forest-300/70">暂无进化记录</p>
            <p className="mt-1 text-xs text-ink-500 dark:text-forest-300/50">
              生成报告或提交反馈后会自动记录进化事件
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <LogItem key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>

      {/* 创建对话框 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-pop-in">
            <div className="sticky top-0 bg-white dark:bg-night-800 pb-4 border-b border-ink-200 dark:border-night-600">
              <h2 className="text-lg font-bold text-ink-900 dark:text-forest-100">创建新 Skill</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                  名称 <span className="text-coral">*</span>
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input w-full"
                  placeholder="如：React 学习模板"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">描述</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="input w-full resize-none"
                  rows={2}
                  placeholder="简要描述这个 Skill 的用途…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">领域</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CategoryId)}
                    className="input w-full cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">标签</label>
                  <input
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="input w-full"
                    placeholder="用逗号分隔"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                  内容模板
                </label>
                <div className="rounded-lg border border-ink-200 dark:border-night-600">
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full resize-none bg-transparent p-3 font-mono text-sm"
                    rows={12}
                    placeholder="输入 Markdown 格式的模板内容…"
                  />
                </div>
                <p className="mt-1 text-xs text-ink-600 dark:text-forest-300/60">
                  支持使用 {`{subject}`}, {`{category}`} 等占位符
                </p>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 p-4">
              <button onClick={() => setShowCreate(false)} className="btn-outline">
                取消
              </button>
              <button onClick={handleCreate} className="btn-primary">
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑对话框 */}
      {editSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-pop-in">
            <div className="sticky top-0 bg-white dark:bg-night-800 pb-4 border-b border-ink-200 dark:border-night-600">
              <h2 className="text-lg font-bold text-ink-900 dark:text-forest-100">编辑 Skill</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                  名称 <span className="text-coral">*</span>
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input w-full"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">描述</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input w-full resize-none"
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">领域</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CategoryId)}
                    className="input w-full cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">标签</label>
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="input w-full"
                    placeholder="用逗号分隔"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">
                  内容模板
                </label>
                <div className="rounded-lg border border-ink-200 dark:border-night-600">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full resize-none bg-transparent p-3 font-mono text-sm"
                    rows={12}
                  />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 p-4">
              <button onClick={() => setEditSkill(null)} className="btn-outline">
                取消
              </button>
              <button onClick={handleSaveEdit} className="btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteSkill(pendingDelete.id);
          setPendingDelete(null);
        }}
        title="删除 Skill"
        message={`确定要删除「${pendingDelete?.name}」吗？此操作不可恢复。`}
        confirmText="删除"
      />
    </div>
  );
}

/** Stat 统计卡片 */
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color.replace("text", "bg"))}>
          <Icon size={20} className={color} />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-ink-900 dark:text-forest-100">{value}</p>
          <p className="text-xs text-ink-600 dark:text-forest-300/70">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** Skill 卡片 */
function SkillCard({
  skill,
  onUse,
  onEdit,
  onArchive,
  onPin,
  onDelete,
}: {
  skill: Skill;
  onUse: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const category = CATEGORIES.find((c) => c.id === skill.category);
  const statusLabel = SKILL_STATUS_LABEL[skill.status];

  return (
    <article className="card card-hover p-5 group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className={cn("chip", statusLabel.cls)}>{statusLabel.label}</span>
            <span className="text-xs text-ink-600 dark:text-forest-300/70">
              {category?.emoji} {category?.label}
            </span>
            {skill.status === "pinned" && <span className="chip bg-purple-100 text-purple-600 dark:bg-night-700 dark:text-purple-300">📌 置顶</span>}
          </div>
          <h3 className="text-lg font-bold text-ink-900 dark:text-forest-100 line-clamp-1">{skill.name}</h3>
          <p className="mt-1 text-[13px] text-ink-600 dark:text-forest-300/70 line-clamp-2">{skill.description || "暂无描述"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-ink-600 dark:text-forest-300/60">
          <span>v{skill.version}</span>
          <span className="flex items-center gap-1">
            <Timer size={11} /> {skill.usageCount}
          </span>
          {skill.rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star size={11} className="fill-amberx text-amberx" /> {skill.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {skill.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="chip !py-0.5 !text-[11px] border-ink-200 dark:border-night-600">
              <Tag size={10} /> {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-ink-200/60 dark:border-night-600 pt-3">
        <button onClick={onUse} className="btn-soft !py-1.5 !text-[13px]">
          <BookOpen size={14} /> 使用模板
        </button>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-forest-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
            title="编辑"
          >
            <Edit3 size={15} />
          </button>
          {skill.status === "pinned" ? (
            <button
              onClick={onArchive}
              className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-ink-100 dark:hover:bg-night-700 transition-colors cursor-pointer"
              title="取消置顶"
            >
              <ArchiveRestore size={15} />
            </button>
          ) : (
            <button
              onClick={onPin}
              className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-purple-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
              title="置顶"
            >
              <Archive size={15} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-ink-600 dark:text-forest-300/70 hover:bg-coral/10 hover:text-coral transition-colors cursor-pointer"
            title="删除"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

/** 进化日志条目 */
function LogItem({ log }: { log: EvolutionLog }) {
  const typeLabels: Record<EvolutionLog["type"], string> = {
    skill_created: "Skill 创建",
    skill_updated: "Skill 更新",
    skill_archived: "Skill 归档",
    skill_pinned: "Skill 置顶",
    feedback_processed: "反馈处理",
  };
  const typeIcons: Record<EvolutionLog["type"], string> = {
    skill_created: "🆕",
    skill_updated: "✏️",
    skill_archived: "📦",
    skill_pinned: "📌",
    feedback_processed: "💬",
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-ink-200/60 dark:border-night-600 p-3 hover:bg-forest-50/50 dark:hover:bg-night-700/50 transition-colors">
      <span className="text-xl">{typeIcons[log.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-ink-900 dark:text-forest-100">{typeLabels[log.type]}</span>
          {log.subject && (
            <span className="chip !py-0.5 !text-[11px] border-ink-200 dark:border-night-600">{log.subject}</span>
          )}
          {log.skillName && (
            <span className="chip !py-0.5 !text-[11px] bg-forest-100 text-forest-600 dark:bg-night-700 dark:text-forest-300">
              {log.skillName}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-ink-600 dark:text-forest-300/80 line-clamp-1">{log.description}</p>
        <p className="mt-1 text-xs text-ink-500 dark:text-forest-300/50 flex items-center gap-1">
          <CalendarDays size={11} />
          {new Date(log.timestamp).toLocaleString("zh-CN")}
        </p>
      </div>
    </div>
  );
}
