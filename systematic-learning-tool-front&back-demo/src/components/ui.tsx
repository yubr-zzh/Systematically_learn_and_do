// ============================================================
// 通用 UI 组件：徽章、进度条、星级评分、模态框、骨架屏、
// 空状态、Toast 通知、头像
// ============================================================

import { useEffect, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Star, X } from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import { STATUS_LABEL } from "../types";

/** 状态徽章 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_LABEL[status] ?? STATUS_LABEL.completed;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.cls, className)}>
      {status === "generating" && <span className="h-1.5 w-1.5 rounded-full bg-amberx animate-pulse" />}
      {meta.label}
    </span>
  );
}

/** 分类徽章 */
export function CategoryBadge({ label, emoji }: { label: string; emoji: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 dark:bg-night-700 px-2.5 py-0.5 text-xs font-medium text-forest-600 dark:text-forest-300">
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  );
}

/** 进度条 */
export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-200/70 dark:bg-night-600", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn("h-full rounded-full transition-all duration-300 ease-in-out", color ?? "bg-gradient-to-r from-forest-600 to-forest-400")}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** 星级评分（展示 + 交互） */
export function StarRating({
  value,
  onChange,
  size = 22,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role={readOnly ? "img" : "radiogroup"} aria-label={`${value} 星评分`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(i)}
          aria-label={`${i} 星`}
          className={cn("transition-transform", !readOnly && "cursor-pointer hover:scale-125 active:scale-95", i <= value && "scale-100")}
        >
          <Star
            size={size}
            className={cn(
              "transition-colors",
              i <= value ? "fill-amberx text-amberx" : "fill-transparent text-ink-300 dark:text-night-600"
            )}
          />
        </button>
      ))}
    </div>
  );
}

/** 模态框 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-900/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          "relative w-full rounded-t-2xl sm:rounded-2xl bg-white dark:bg-night-800 shadow-modal animate-pop-in max-h-[90vh] overflow-y-auto",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-ink-200 dark:border-night-600">
          <h3 className="text-lg font-bold text-ink-900 dark:text-forest-100">{title}</h3>
          <button onClick={onClose} aria-label="关闭" className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-200/60 dark:hover:bg-night-700 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 pb-5">{footer}</div>}
      </div>
    </div>
  );
}

/** 确认对话框 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "确认",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn bg-coral text-white hover:brightness-110"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="flex items-start gap-2.5 text-[15px] text-ink-700 dark:text-forest-200">
        <AlertTriangle className="mt-0.5 shrink-0 text-coral" size={20} />
        {message}
      </p>
    </Modal>
  );
}

/** 骨架屏 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** 空状态 */
export function EmptyState({
  emoji = "🍃",
  title,
  desc,
  action,
}: {
  emoji?: string;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 dark:border-night-600 py-14 px-6 text-center">
      <div className="mb-3 text-5xl" aria-hidden>
        {emoji}
      </div>
      <p className="text-base font-bold text-ink-900 dark:text-forest-100">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-ink-600 dark:text-forest-300/70">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Toast 通知容器 */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="no-print fixed top-20 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-modal animate-slide-up max-w-xs",
            t.type === "success" && "bg-forest-600 text-white",
            t.type === "error" && "bg-coral text-white",
            t.type === "info" && "bg-white dark:bg-night-700 text-ink-900 dark:text-forest-100 border border-ink-200 dark:border-night-600"
          )}
        >
          {t.type === "success" && <CheckCircle2 size={17} className="shrink-0" />}
          {t.type === "error" && <AlertTriangle size={17} className="shrink-0" />}
          {t.type === "info" && <Info size={17} className="shrink-0 text-skyx" />}
          <span className="leading-snug">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="关闭通知" className="ml-1 opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** 头像 */
export function Avatar({ name, avatar, size = 32 }: { name: string; avatar: string; size?: number }) {
  const isDataUrl = avatar.startsWith("data:");
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-forest-400 to-forest-600 text-white font-bold ring-2 ring-white/60 dark:ring-night-600"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-label={name}
    >
      {isDataUrl ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : avatar}
    </div>
  );
}

/** 封面渐变（项目卡片） */
export const COVER_GRADIENTS = [
  "from-forest-600 via-forest-500 to-forest-400",
  "from-skyx via-forest-500 to-forest-600",
  "from-forest-700 via-forest-500 to-amberx/80",
  "from-forest-600 via-forest-400 to-forest-300",
];
