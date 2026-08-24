// ============================================================
// 顶部导航：Logo + 四个 Tab + 主题切换 + 用户下拉菜单
// ============================================================

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Moon, Settings as SettingsIcon, Sun, User } from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";
import type { Page } from "../types";
import { Avatar } from "./ui";
import { NAV_ITEMS } from "./navItems";

/** Re-exported for backward-compat with existing imports. */
export function navigateTo(page: Page, id?: string) {
  const hash = id ? `#/${page}/${id}` : `#/${page}`;
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

export function Header() {
  const { router, settings, updateSettings } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkActual, setIsDarkActual] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 计算实际生效的主题（含跟随系统）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setIsDarkActual(settings.theme === "dark" || (settings.theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const effectiveDark = isDarkActual; // 实际生效的深色状态

  return (
    <header className="no-print sticky top-0 z-40 h-16 bg-white/90 dark:bg-night-900/90 backdrop-blur border-b border-ink-200/70 dark:border-night-600 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Logo */}
        <button
          onClick={() => navigateTo("learn")}
          className="flex items-center gap-2.5 cursor-pointer"
          aria-label="回到首页"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-forest-600 to-forest-400 text-white text-lg font-extrabold shadow-hover">
            S²
          </span>
          <span className="hidden md:block text-left leading-tight">
            <span className="block bg-gradient-to-r from-forest-600 to-forest-400 bg-clip-text text-[15px] font-extrabold text-transparent">
              系统学习与执行
            </span>
            <span className="block text-[10px] font-medium tracking-wide text-ink-600 dark:text-forest-300/70">
              Systematically Learn and Do
            </span>
          </span>
        </button>

        {/* 桌面导航 */}
        <nav className="hidden md:flex items-center gap-1 rounded-full bg-forest-50 dark:bg-night-800 p-1 border border-ink-200/60 dark:border-night-600" aria-label="主导航">
          {NAV_ITEMS.map(({ page, label, icon: Icon }) => {
            const active = router.page === page;
            return (
              <button
                key={page}
                onClick={() => navigateTo(page)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-gradient-to-r from-forest-600 to-forest-500 text-white shadow-[0_2px_8px_rgba(45,80,22,0.3)]"
                    : "text-ink-600 dark:text-forest-300/80 hover:text-forest-600 dark:hover:text-forest-200 hover:bg-forest-100/70 dark:hover:bg-night-700"
                )}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* 右侧：主题 + 用户 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
            className="rounded-full p-2 text-ink-600 dark:text-forest-300 hover:bg-forest-100 dark:hover:bg-night-700 transition-colors cursor-pointer"
            aria-label={effectiveDark ? "切换到浅色模式" : "切换到深色模式"}
          >
            {effectiveDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 hover:bg-forest-100 dark:hover:bg-night-700 transition-colors cursor-pointer"
              aria-label="用户菜单"
              aria-expanded={menuOpen}
            >
              <Avatar name={settings.username} avatar={settings.avatar} size={30} />
              <ChevronDown size={14} className="hidden sm:block text-ink-600 dark:text-forest-300" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-night-800 border border-ink-200 dark:border-night-600 shadow-modal animate-pop-in p-2">
                <div className="px-3 py-2.5 border-b border-ink-200 dark:border-night-600 mb-1">
                  <p className="text-sm font-bold text-ink-900 dark:text-forest-100">{settings.username}</p>
                  <p className="text-xs text-ink-600 dark:text-forest-300/70">Systematically Learn and Do</p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigateTo("settings");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 dark:text-forest-200 hover:bg-forest-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
                >
                  <User size={15} /> 个人设置
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigateTo("settings");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 dark:text-forest-200 hover:bg-forest-50 dark:hover:bg-night-700 transition-colors cursor-pointer"
                >
                  <SettingsIcon size={15} /> Skill 配置
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
