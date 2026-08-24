// ============================================================
// App 入口：哈希路由 + 深色模式 + 移动端底部导航
// ============================================================

import { useEffect, useMemo } from "react";
import { cn } from "./utils/cn";
import { useStore } from "./store/useStore";
import type { Page, RouterState } from "./types";
import { Header } from "./components/Header";
import { Toasts } from "./components/ui";
import { NAV_ITEMS } from "./components/navItems";
import { LearnPage } from "./pages/LearnPage";
import { LearnDetailPage } from "./pages/LearnDetailPage";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SkillPage } from "./pages/SkillPage";

/** 解析 URL 哈希为路由状态 */
function parseHash(): RouterState {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [seg, id] = h.split("/");
  switch (seg) {
    case "projects":
      return id ? { page: "projects", projectId: id } : { page: "projects" };
    case "feedback":
      return { page: "feedback" };
    case "settings":
      return { page: "settings" };
    case "skills":
      return { page: "skills" };
    case "learn":
      return id ? { page: "learn", reportId: id } : { page: "learn" };
    default:
      return { page: "learn" };
  }
}

const MOBILE_NAV = NAV_ITEMS;

export default function App() {
  const router = useStore((s) => s.router);
  const setRouter = useStore((s) => s.setRouter);
  const theme = useStore((s) => s.settings.theme);
  const loadAll = useStore((s) => s.loadAll);

  // 初始化：加载所有数据
  useEffect(() => { loadAll(); }, [loadAll]);

  // 路由监听：同时响应 hash 变化、pushState 后发出的 sl:d:navigate 事件、
  // 以及浏览器的 back/forward (popstate)。
  useEffect(() => {
    const sync = () => setRouter(parseHash());
    const onNavigate = (ev: Event) => {
      const detail = (ev as CustomEvent<{ page: Page; id?: string }>).detail;
      if (detail) {
        // Mirror parseHash: only set the page-relevant id field so
        // a /learn/123 navigation doesn't transiently expose
        // projectId=123 in the store.
        const next: RouterState = { page: detail.page };
        if (detail.id) {
          if (detail.page === "learn") next.reportId = detail.id;
          else if (detail.page === "projects") next.projectId = detail.id;
        }
        setRouter(next);
      } else {
        sync();
      }
    };
    window.addEventListener("hashchange", sync);
    window.addEventListener("sl:d:navigate", onNavigate as EventListener);
    window.addEventListener("popstate", sync);
    sync();
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("sl:d:navigate", onNavigate as EventListener);
      window.removeEventListener("popstate", sync);
    };
  }, [setRouter]);

  // 深色模式
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // 页面切换淡入动画
  const pageKey = useMemo(() => {
    const { page, reportId, projectId } = router;
    return `${page}-${reportId ?? ""}-${projectId ?? ""}`;
  }, [router]);

  const renderPage = () => {
    const { page, reportId, projectId } = router;
    switch (page) {
      case "learn":
        return reportId ? <LearnDetailPage id={reportId} /> : <LearnPage />;
      case "projects":
        return projectId ? <ProjectDetailPage id={projectId} /> : <ProjectPage />;
      case "skills":
        return <SkillPage />;
      case "feedback":
        return <FeedbackPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <LearnPage />;
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main key={pageKey} className="animate-fade-in pb-24 md:pb-8">
        {renderPage()}
      </main>

      {/* 移动端底部 Tab 导航 */}
      <nav
        className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200/70 dark:border-night-600 bg-white/95 dark:bg-night-900/95 backdrop-blur md:hidden"
        aria-label="底部导航"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map(({ page, label, icon: Icon }) => {
            const active = router.page === page;
            return (
              <button
                key={page}
                onClick={() => (window.location.hash = `#/${page}`)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer",
                  active ? "text-forest-600 dark:text-forest-300" : "text-ink-600 dark:text-forest-300/50"
                )}
              >
                <Icon size={20} />
                {label}
                <span className={cn("h-1 w-8 rounded-full transition-all", active ? "bg-forest-500" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </nav>

      <Toasts />
    </div>
  );
}
