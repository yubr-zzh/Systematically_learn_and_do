// ============================================================
// API Client — 统一对接后端
// ============================================================

declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL || '';
type ApiRow = Record<string, unknown>;
export type ReportVersionRow = { id: string; version: number; created_at: string; content: string };

async function request<T>(path: string, options?: RequestInit & { params?: Record<string, string> }): Promise<T> {
  const params = options?.params;
  const url = params
    ? path + '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : path;
  const { params: _ignored, ...rest } = options || {};
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...rest?.headers },
    ...rest,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Surface the backend's validator details (Step 3.2) when present so
    // the user sees e.g. "rating 必须在 1-5 之间" instead of the generic
    // "Validation failed".
    const detail = Array.isArray(err?.details) && err.details.length
      ? err.details.join("; ")
      : null;
    const message = detail ? `${err.error || "Request failed"}: ${detail}` : (err.error || `HTTP ${res.status}`);
    throw new Error(message);
  }
  return res.json();
}

type SimpleResponse = { id: string };

export const api = {
  // ---- Learn Reports ----
  getReports: (params?: Record<string, string>) =>
    request<ApiRow[]>('/api/learn', { params }),
  getReport: (id: string) => request<ApiRow & { content: string }>(`/api/learn/${id}`),
  createReport: (subject: string, category: string, depth = 'standard', skillId?: string) =>
    request<SimpleResponse>('/api/learn', {
      method: 'POST',
      body: JSON.stringify({ subject, category, depth, ...(skillId ? { skillId } : {}) }),
    }),
  updateReport: (id: string, patch: Partial<{ favorite: boolean; content: string; status: string; title: string }>) =>
    request<void>(`/api/learn/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteReport: (id: string) => request<void>(`/api/learn/${id}`, { method: 'DELETE' }),
  getReportVersions: (id: string) => request<ReportVersionRow[]>(`/api/learn/${id}/versions`),
  restoreReportVersion: (id: string, versionId: string) =>
    request<void>(`/api/learn/${id}/versions/${versionId}/restore`, { method: 'POST' }),

  /**
   * Open an SSE stream to /api/learn/:id/stream. Returns a controller
   * with .close(). The caller is responsible for invoking close() on
   * 'complete' / 'error' to prevent EventSource's built-in auto-reconnect
   * from re-attaching to the now-terminal DB row.
   *
   * Handlers are typed as plain callbacks so callers can wire Zustand
   * updates without importing any extra types.
   *
   * onError receives a `server` flag: true when the backend sent a
   * terminal 'error' event (the report is permanently failed), false
   * when the connection itself dropped mid-stream (transient — the
   * stale timer / manual retry should own recovery).
   */
  openLearnStream: (
    id: string,
    handlers: {
      onProgress?: (p: { progress: number }) => void;
      onComplete?: (p: { content: string; wordCount: number }) => void;
      onError?: (e: { message: string; server: boolean }) => void;
    }
  ): { close: () => void } => {
    const url = `${BASE}/api/learn/${id}/stream`;
    const es = new EventSource(url);

    if (handlers.onProgress) es.addEventListener('progress', (ev) => {
      try { handlers.onProgress!(JSON.parse((ev as MessageEvent).data)); } catch {}
    });
    if (handlers.onComplete) es.addEventListener('complete', (ev) => {
      try { handlers.onComplete!(JSON.parse((ev as MessageEvent).data)); } catch {}
    });
    if (handlers.onError) {
      // Server-authored error events come through as MessageEvent with
      // .data; transient network errors come through as bare Event with
      // no .data.
      es.addEventListener('error', (ev) => {
        const me = ev as MessageEvent;
        if (me?.data) {
          try {
            handlers.onError!({ ...JSON.parse(me.data), server: true });
            return;
          } catch { /* fall through */ }
        }
        handlers.onError!({ message: 'Stream connection interrupted', server: false });
      });
    }

    return {
      close: () => es.close(),
    };
  },

  // ---- Projects ----
  getProjects: () => request<ApiRow[]>('/api/projects'),
  getProject: (id: string) => request<ApiRow>(`/api/projects/${id}`),
  createProject: (data: { name: string; description: string; type: string; dueDate?: string; startDate?: string; refLink?: string }) =>
    request<SimpleResponse>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, patch: Record<string, unknown>) =>
    request<void>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  addTask: (projectId: string, title: string, phase: string, dueDate?: string) =>
    request<SimpleResponse>("/api/projects/" + projectId + "/tasks", { method: 'POST', body: JSON.stringify({ title, phase, dueDate }) }),
  toggleTask: (projectId: string, taskId: string, done: boolean) =>
    request<void>(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  deleteTask: (projectId: string, taskId: string) =>
    request<void>(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),

  // ---- Feedback ----
  getFeedback: (reportId?: string) =>
    request<ApiRow[]>(`/api/feedback${reportId ? '?reportId=' + reportId : ''}`),
  addFeedback: (data: { reportId?: string; reportTitle: string; rating: number; strengths: string; improvements: string; comment: string }) =>
    request<SimpleResponse>('/api/feedback', { method: 'POST', body: JSON.stringify(data) }),
  deleteFeedback: (id: string) => request<void>(`/api/feedback/${id}`, { method: 'DELETE' }),

  // ---- Skills ----
  getSkills: (params?: Record<string, string>) =>
    request<ApiRow[]>('/api/skills', { params }),
  createSkill: (data: Record<string, unknown>) =>
    request<SimpleResponse>('/api/skills', { method: 'POST', body: JSON.stringify(data) }),
  updateSkill: (id: string, patch: Record<string, unknown>) =>
    request<void>(`/api/skills/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  archiveSkill: (id: string) =>
    request<void>(`/api/skills/${id}/archive`, { method: 'POST' }),
  pinSkill: (id: string, pinned: boolean) =>
    request<void>(`/api/skills/${id}/pin`, { method: 'POST', body: JSON.stringify({ pinned }) }),
  deleteSkill: (id: string) => request<void>(`/api/skills/${id}`, { method: 'DELETE' }),
  incrementSkillUsage: (id: string) =>
    request<void>(`/api/skills/${id}/use`, { method: 'POST' }),

  // ---- Evolution Logs ----
  getEvolutionLogs: (limit = 50) =>
    request<ApiRow[]>(`/api/skills/evolution/logs?limit=${limit}`),

  // ---- Settings ----
  getSettings: () => request<ApiRow>('/api/settings'),
  updateSettings: (patch: Record<string, unknown>) =>
    request<void>('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
  importData: (payload: unknown) =>
    request<{ success: boolean }>('/api/settings/import', { method: 'POST', body: JSON.stringify(payload) }),
  clearData: () =>
    request<{ success: boolean }>('/api/settings/clear', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }),
    }),
};
