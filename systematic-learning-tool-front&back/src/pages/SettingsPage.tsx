// ============================================================
// Settings 页面：用户配置 / 主题外观 / Skill 配置 / 数据管理
// ============================================================

import { useRef, useState } from "react";
import {
  Cloud,
  Database,
  Download,
  Gauge,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import type { AnalysisDepth, PlanningStyle, ThemePref } from "../types";
import { Avatar, ConfirmDialog } from "../components/ui";

const AVATAR_PRESETS = ["🌱", "🌿", "🍀", "🐢", "🐸", "📗", "🧑‍💻", "🎓"];

export function SettingsPage() {
  const { settings, updateSettings, exportData, importData, clearHistory, syncNow, toast } = useStore();
  const [username, setUsername] = useState(settings.username);
  const [saved, setSaved] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveProfile = () => {
    const name = username.trim() || "学习者";
    updateSettings({ username: name });
    setUsername(name);
    setSaved(true);
    toast("success", "个人信息已保存 ✓");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("error", "请选择图片文件");
      return;
    }
    if (file.size > 800 * 1024) {
      toast("error", "图片需小于 800KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ avatar: String(reader.result) });
      toast("success", "头像已更新 ✓");
    };
    reader.readAsDataURL(file);
  };

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sld-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "数据已导出 ✓");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await importData(String(reader.result));
      if (ok) toast("success", "数据导入成功 ✓");
      else toast("error", "文件格式不正确，导入失败");
    };
    reader.readAsText(file);
  };

  const ThemeOption = ({ value, label, icon }: { value: ThemePref; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => updateSettings({ theme: value })}
      aria-pressed={settings.theme === value}
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all cursor-pointer",
        settings.theme === value
          ? "border-forest-500 bg-forest-50 dark:bg-night-700"
          : "border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 hover:border-forest-300"
      )}
    >
      {icon}
      <span className="text-sm font-semibold text-ink-900 dark:text-forest-100">{label}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-ink-900 dark:text-forest-100">
          设置 <span className="inline-block">⚙️</span>
        </h1>
        <p className="mt-2 text-[15px] text-ink-600 dark:text-forest-300/80">
          管理个人信息、外观偏好、分析引擎参数与本地数据。
        </p>
      </div>

      <div className="space-y-8">
        {/* 用户配置 */}
        <section className="card p-6 sm:p-8" aria-label="用户配置">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
            <UserIcon size={19} className="text-forest-500" /> 用户配置
          </h2>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <Avatar name={settings.username} avatar={settings.avatar} size={72} />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                aria-label="上传头像"
              />
              <button onClick={() => fileRef.current?.click()} className="btn-outline !px-3 !py-1.5 !text-[13px]">
                <Upload size={14} /> 上传头像
              </button>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">用户名</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input flex-1"
                  placeholder="你的名字"
                  aria-label="用户名"
                  maxLength={20}
                />
                <button onClick={saveProfile} className="btn-primary shrink-0">
                  {saved ? "已保存 ✓" : "保存"}
                </button>
              </div>
              <p className="mt-3 mb-2 text-[13px] font-semibold text-ink-600 dark:text-forest-300/70">预设头像</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => updateSettings({ avatar: a })}
                    aria-pressed={settings.avatar === a}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-xl transition-all cursor-pointer",
                      settings.avatar === a
                        ? "bg-forest-100 dark:bg-night-700 ring-2 ring-forest-500 scale-110"
                        : "bg-forest-50 dark:bg-night-700 hover:scale-110"
                    )}
                    aria-label={`头像 ${a}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 外观 */}
        <section className="card p-6 sm:p-8" aria-label="外观设置">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
            <Palette size={19} className="text-forest-500" /> 主题与字体
          </h2>
          <div className="mb-6">
            <p className="mb-3 text-sm font-semibold text-ink-900 dark:text-forest-100">主题偏好</p>
            <div className="flex gap-3">
              <ThemeOption value="light" label="浅色" icon={<Sun size={20} className="text-amberx" />} />
              <ThemeOption value="dark" label="深色" icon={<Moon size={20} className="text-skyx" />} />
              <ThemeOption value="system" label="跟随系统" icon={<Monitor size={20} className="text-forest-500" />} />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-900 dark:text-forest-100">报告正文字号</p>
              <span className="rounded-md bg-forest-100 dark:bg-night-700 px-2 py-0.5 text-xs font-bold text-forest-600 dark:text-forest-300">
                {settings.fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={13}
              max={20}
              step={1}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-forest-500 cursor-pointer"
              aria-label="报告正文字号"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-600 dark:text-forest-300/60">
              <span>13px 小</span>
              <span>16px 标准</span>
              <span>20px 大</span>
            </div>
          </div>
        </section>

        {/* Skill 配置 */}
        <section className="card p-6 sm:p-8" aria-label="Skill 配置">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
            <SlidersHorizontal size={19} className="text-forest-500" /> Skill 配置（横纵分析法参数）
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-forest-100">
                <Gauge size={15} className="text-forest-500" /> 分析深度
              </label>
              <select
                value={settings.analysisDepth}
                onChange={(e) => updateSettings({ analysisDepth: e.target.value as AnalysisDepth })}
                className="input cursor-pointer"
                aria-label="分析深度"
              >
                <option value="basic">基础（约 2000 字）</option>
                <option value="standard">标准（约 4000 字）</option>
                <option value="deep">深度（约 8000 字）</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">调研资源数量</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={settings.researchSources}
                  onChange={(e) => updateSettings({ researchSources: Number(e.target.value) })}
                  className="flex-1 accent-forest-500 cursor-pointer"
                  aria-label="调研资源数量"
                />
                <span className="w-9 rounded-md bg-forest-100 dark:bg-night-700 px-2 py-0.5 text-center text-xs font-bold text-forest-600 dark:text-forest-300">
                  {settings.researchSources}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-900 dark:text-forest-100">规划模板</label>
              <select
                value={settings.planningStyle}
                onChange={(e) => updateSettings({ planningStyle: e.target.value as PlanningStyle })}
                className="input cursor-pointer"
                aria-label="规划模板"
              >
                <option value="agile">敏捷冲刺（4 阶段迭代）</option>
                <option value="waterfall">瀑布规划（线性格特）</option>
                <option value="hybrid">混合模式（推荐）</option>
              </select>
            </div>
          </div>
        </section>

        {/* 数据管理 */}
        <section className="card p-6 sm:p-8" aria-label="数据管理">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-ink-900 dark:text-forest-100">
            <Database size={19} className="text-forest-500" /> 数据管理
          </h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExport} className="btn-soft">
              <Download size={16} /> 导出数据（JSON）
            </button>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              id="import-file"
              onChange={(e) => {
                e.target.files?.[0] && handleImport(e.target.files[0]);
                e.target.value = "";
              }}
              aria-label="导入数据"
            />
            <label htmlFor="import-file" className="btn-outline cursor-pointer">
              <Upload size={16} /> 导入数据
            </label>
            <button onClick={() => setClearOpen(true)} className="btn-danger">
              <Trash2 size={16} /> 清除历史记录
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-forest-50 dark:bg-night-700 px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] text-ink-600 dark:text-forest-300/80">
              <Cloud size={15} className="text-forest-500" />
              数据已保存在本地浏览器（localStorage），不会上传服务器
            </p>
            <button onClick={syncNow} className="btn-ghost !py-1 !text-[13px]">
              <RefreshCw size={13} /> 立即同步
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearHistory}
        title="清除历史记录"
        message="将删除全部学习报告、项目与反馈数据（设置保留）。建议先导出备份。此操作不可恢复！"
        confirmText="全部清除"
      />
    </div>
  );
}
