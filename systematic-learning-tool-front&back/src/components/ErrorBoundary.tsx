// ============================================================
// React error boundary — catches uncaught render-time errors and
// shows a fallback UI instead of leaving the whole app blank.
// ============================================================

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useStore } from "../store/useStore";

interface Props {
  children: ReactNode;
  /** Optional section name to show in the fallback (e.g. "Learn", "Skill") */
  scope?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions. Logs to console + shows an error
 * toast so the user can keep navigating other sections. A 'Reload'
 * button recovers by resetting state and forcing a window reload.
 *
 * Wraps each route so a broken page doesn't blank the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console; could also POST to /api/log in future.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.scope ?? "app", error, info.componentStack);
    // Fire a toast so the user knows something broke.
    try {
      useStore.getState().toast("error", `${this.props.scope ?? "页面"}渲染失败：${error.message}`);
    } catch {
      // store may not be available in tests
    }
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    // Hard reload to clear any stale state in children that mounted.
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const scope = this.props.scope ?? "页面";
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="card p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral/15 text-coral text-2xl" aria-hidden>
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-forest-100">
            {scope} 渲染失败
          </h2>
          <p className="mx-auto max-w-md text-[14px] text-ink-600 dark:text-forest-300/80">
            该页面遇到了一个未预期的错误。下方是错误详情，请截图反馈给我们。
          </p>
          <pre className="max-h-48 overflow-auto rounded-lg bg-cream dark:bg-night-700 px-4 py-3 text-left text-xs text-ink-700 dark:text-forest-200 font-mono">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack?.split("\n").slice(0, 6).join("\n")}
          </pre>
          <button onClick={this.handleReload} className="btn-primary">
            <RotateCw size={16} /> 重新加载页面
          </button>
        </div>
      </div>
    );
  }
}