// ============================================================
// API Client — 统一对接后端
// ============================================================

declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request<T>(path: string, options?: RequestInit & { params?: Record<string, string> }): Promise<T> {
  const url = options?.params
    ? path + '?' + Object.entries(options.params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : path;
  const { params, ...rest } = (options || {}) as any;
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...rest?.headers },
    ...rest,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type SimpleResponse = { id: string };

export const api = {
  // ---- Learn Reports ----
  getReports: (params?: Record<string, string>) =>
    request<any[]>('/api/learn', { params }),
  getReport: (id: string) => request<any>(`/api/learn/${id}`),
  createReport: (subject: string, category: string, depth = 'standard') =>
    request<SimpleResponse>('/api/learn', {
      method: 'POST',
      body: JSON.stringify({ subject, category, depth }),
    }),
  updateReport: (id: string, patch: Partial<{ favorite: boolean; content: string; status: string; title: string }>) =>
    request<void>(`/api/learn/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteReport: (id: string) => request<void>(`/api/learn/${id}`, { method: 'DELETE' }),

  // ---- Projects ----
  getProjects: () => request<any[]>('/api/projects'),
  getProject: (id: string) => request<any>(`/api/projects/${id}`),
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
    request<any[]>(`/api/feedback${reportId ? '?reportId=' + reportId : ''}`),
  addFeedback: (data: { reportId?: string; reportTitle: string; rating: number; strengths: string; improvements: string; comment: string }) =>
    request<SimpleResponse>('/api/feedback', { method: 'POST', body: JSON.stringify(data) }),
  deleteFeedback: (id: string) => request<void>(`/api/feedback/${id}`, { method: 'DELETE' }),

  // ---- Skills ----
  getSkills: (params?: Record<string, string>) =>
    request<any[]>('/api/skills', { params }),
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
    request<any[]>(`/api/skills/evolution/logs?limit=${limit}`),

  // ---- Settings ----
  getSettings: () => request<any>('/api/settings'),
  updateSettings: (patch: Record<string, unknown>) =>
    request<void>('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};
