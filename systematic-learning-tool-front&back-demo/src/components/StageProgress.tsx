// ============================================================
// 三阶段生成进度条（横纵分析 → 深度调研 → 规划建议）
// ============================================================

import { Check, CircleDashed, Loader2, RefreshCw } from "lucide-react";
import { cn } from "../utils/cn";
import type { StageInfo } from "../types";
import { STAGE_DESCS } from "../types";
import { ProgressBar } from "./ui";

const STAGE_ICONS = [RefreshCw, Loader2, Check];

export function StageProgress({ stages, overall }: { stages: StageInfo[]; overall: number }) {
  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink-900 dark:text-forest-100">
          <RefreshCw size={17} className="text-forest-500 animate-[spin_2.5s_linear_infinite]" />
          报告生成中
        </h3>
        <span className="text-sm font-extrabold text-forest-600 dark:text-forest-300">{overall}%</span>
      </div>

      {/* 三阶段 */}
      <div className="grid gap-3 sm:grid-cols-3" role="status" aria-label="报告生成进度">
        {stages.map((stage, i) => {
          const isActive = stage.status === "active";
          const isDone = stage.status === "done";
          const Icon = STAGE_ICONS[isDone ? 2 : isActive ? 1 : 0];
          const subText = STAGE_DESCS[stage.id][Math.floor((stage.progress * STAGE_DESCS[stage.id].length) / 101) % STAGE_DESCS[stage.id].length];
          return (
            <div
              key={stage.id}
              className={cn(
                "rounded-xl border p-4 transition-all duration-300",
                isActive
                  ? "border-forest-500/60 bg-forest-50 dark:bg-night-700 shadow-hover"
                  : isDone
                    ? "border-forest-200 bg-forest-100/50 dark:border-night-600 dark:bg-night-800"
                    : "border-ink-200 bg-white/60 dark:border-night-600 dark:bg-night-800/60 opacity-70"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      isDone
                        ? "bg-forest-500 text-white"
                        : isActive
                          ? "bg-forest-100 text-forest-600 dark:bg-night-600 dark:text-forest-300"
                          : "bg-ink-200/70 text-ink-600 dark:bg-night-600 dark:text-forest-300/60"
                    )}
                  >
                    {isDone ? (
                      <Check size={14} />
                    ) : isActive ? (
                      <Icon size={14} className="animate-[spin_1.6s_linear_infinite]" />
                    ) : (
                      <CircleDashed size={14} />
                    )}
                  </span>
                  <span className="text-sm font-bold text-ink-900 dark:text-forest-100">
                    {i + 1}. {stage.name}
                  </span>
                </div>
                <span className="text-xs font-bold text-ink-600 dark:text-forest-300/70">
                  {isDone ? "100%" : isActive ? `${stage.progress}%` : "—"}
                </span>
              </div>
              {isActive ? (
                <>
                  <p className="mb-2 text-xs text-forest-600 dark:text-forest-300/80">{subText}</p>
                  <ProgressBar value={stage.progress} className="h-1" />
                </>
              ) : (
                <p className="text-xs text-ink-600 dark:text-forest-300/60">
                  {isDone ? "阶段完成" : "等待中"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 总进度 */}
      <div className="mt-5">
        <ProgressBar value={overall} className="h-2" />
        <p className="mt-2 text-xs text-ink-600 dark:text-forest-300/70">
          横纵分析法引擎正在工作：横向对比界定边界，纵向梳理发展脉络，随后完成深度调研与规划建议。请稍候…
        </p>
      </div>
    </div>
  );
}
