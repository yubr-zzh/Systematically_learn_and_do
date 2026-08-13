// ============================================================
// 报告阅读器：目录导航（滚动高亮）+ Markdown 渲染 +
// 阅读体验控制（字号 / 深浅阅读模式）+ 打印导出
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ListTree, Minus, Moon, Plus, Printer, Sun } from "lucide-react";
import { cn } from "../utils/cn";
import { useStore } from "../store/useStore";

interface HeadingItem {
  id: string;
  level: number;
  text: string;
}

/** 从 markdown 提取 h2/h3 标题生成目录 */
function extractHeadings(content: string): HeadingItem[] {
  const list: HeadingItem[] = [];
  const re = /^(#{2,3})\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    list.push({ level: m[1].length, text: m[2].replace(/\*\*/g, "").trim(), id: slugify(m[2]) });
  }
  return list;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`~]/g, "")
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 从 ReactNode 提取纯文本 */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    const p = node.props as { children?: ReactNode };
    return textOf(p.children);
  }
  return "";
}

export function ReportViewer({
  content,
  extraActions,
  footer,
}: {
  content: string;
  extraActions?: ReactNode;
  footer?: ReactNode;
}) {
  const { settings, updateSettings } = useStore();
  const [readingDark, setReadingDark] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);

  const headings = useMemo(() => extractHeadings(content), [content]);

  // 滚动高亮：监听标题进入视口
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-heading]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId((e.target as HTMLElement).dataset.heading ?? "");
            break;
          }
        }
      },
      { rootMargin: "-64px 0px -72% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [content]);

  const jumpTo = (id: string) => {
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-heading="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  return (
    <div className="flex gap-6">
      {/* 桌面端目录 */}
      <aside className="no-print hidden lg:block w-60 shrink-0" aria-label="报告目录">
        <div className="sticky top-24 max-h-[calc(100vh-110px)] overflow-y-auto rounded-xl border border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 p-3">
          <p className="flex items-center gap-1.5 px-2 pb-2 text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-forest-300/70">
            <ListTree size={14} className="text-forest-500" /> 报告目录
          </p>
          <nav className="space-y-0.5">
            {headings.map((h) => (
              <button
                key={h.id}
                onClick={() => jumpTo(h.id)}
                className={cn(
                  "block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] leading-snug transition-colors cursor-pointer",
                  h.level === 2 ? "pl-2.5" : "pl-6",
                  activeId === h.id
                    ? "bg-forest-100 dark:bg-night-700 font-bold text-forest-700 dark:text-forest-200"
                    : "text-ink-700 dark:text-forest-300/70 hover:bg-forest-50 dark:hover:bg-night-700/60"
                )}
                aria-current={activeId === h.id ? "true" : undefined}
              >
                {h.level === 3 && <span className="mr-1 text-ink-600/50">·</span>}
                {h.text}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* 内容区 */}
      <div className="min-w-0 flex-1">
        {/* 阅读工具栏 */}
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* 移动端目录折叠面板 */}
          <details className="lg:hidden rounded-xl border border-ink-200 dark:border-night-600 bg-white dark:bg-night-800 w-full">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink-900 dark:text-forest-100 select-none">
              <ListTree size={15} className="text-forest-500" /> 目录导航
            </summary>
            <nav className="space-y-0.5 border-t border-ink-200 dark:border-night-600 p-2">
              {headings.map((h) => (
                <button
                  key={h.id}
                  onClick={() => jumpTo(h.id)}
                  className={cn(
                    "block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors cursor-pointer",
                    h.level === 2 ? "pl-2.5" : "pl-6",
                    activeId === h.id
                      ? "bg-forest-100 dark:bg-night-700 font-bold text-forest-700 dark:text-forest-200"
                      : "text-ink-700 dark:text-forest-300/70"
                  )}
                >
                  {h.level === 3 && <span className="mr-1 text-ink-600/50">·</span>}
                  {h.text}
                </button>
              ))}
            </nav>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-ink-300 dark:border-night-600 bg-white dark:bg-night-800 px-1 py-0.5" aria-label="字体大小">
              <button
                onClick={() => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })}
                className="rounded-md p-1.5 text-ink-600 dark:text-forest-300 hover:bg-forest-50 dark:hover:bg-night-700 cursor-pointer"
                aria-label="减小字号"
              >
                <Minus size={15} />
              </button>
              <span className="w-9 text-center text-xs font-bold text-ink-700 dark:text-forest-200">{settings.fontSize}px</span>
              <button
                onClick={() => updateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
                className="rounded-md p-1.5 text-ink-600 dark:text-forest-300 hover:bg-forest-50 dark:hover:bg-night-700 cursor-pointer"
                aria-label="增大字号"
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              onClick={() => setReadingDark((v) => !v)}
              className="btn-soft !px-2.5"
              aria-label={readingDark ? "切换到浅色阅读" : "切换到深色阅读"}
              title={readingDark ? "浅色阅读" : "深色阅读"}
            >
              {readingDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => window.print()} className="btn-soft !px-2.5" aria-label="导出 PDF" title="导出 PDF（打印）">
              <Printer size={16} />
            </button>
            {extraActions}
          </div>
        </div>

        {/* 报告正文（打印区域） */}
        <div
          ref={contentRef}
          className={cn(
            "print-area card p-6 sm:p-8 max-h-[68vh] lg:max-h-none overflow-y-auto rounded-xl",
            readingDark && "!bg-night-800 !border-night-600"
          )}
        >
          <article className={cn("md-body", readingDark && "md-dark")} style={{ "--md-fs": `${settings.fontSize}px` } as React.CSSProperties}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const text = textOf(children);
                  return (
                    <h2 id={slugify(text)} data-heading={slugify(text)}>
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const text = textOf(children);
                  return (
                    <h3 id={slugify(text)} data-heading={slugify(text)}>
                      {children}
                    </h3>
                  );
                },
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                input: ({ type, checked, disabled }) => (
                  <input type={type} checked={checked} disabled={disabled ?? true} readOnly />
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto -mx-1 px-1">
                    <table>{children}</table>
                  </div>
                ),
                img: ({ src, alt }) => <img src={src} alt={alt} className="my-3 max-w-full rounded-lg" loading="lazy" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
          {footer}
        </div>
      </div>
    </div>
  );
}
