// ============================================================
// Systematically Learn and Do — 核心数据类型定义
// ============================================================

export type Page = "learn" | "projects" | "feedback" | "settings" | "skills";

export interface RouterState {
  page: Page;
  reportId?: string;
  projectId?: string;
}

/** 报告生成三阶段 */
export type StageId = "analysis" | "research" | "planning";

export interface StageInfo {
  id: StageId;
  name: string;
  status: "pending" | "active" | "done";
  /** 该阶段当前进度 0-100（仅 active 时有意义） */
  progress: number;
}

export type ReportStatus = "generating" | "completed" | "archived" | "error";

export interface LearnReport {
  id: string;
  title: string;
  subject: string;
  category: CategoryId;
  status: ReportStatus;
  /** 整体进度 0-100 */
  progress: number;
  stages: StageInfo[];
  /** markdown 报告内容 */
  content: string;
  favorite: boolean;
  wordCount: number;
  versions: string[];
  createdAt: string;
  updatedAt: string;
  researchMeta?: ResearchMeta;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
  provider?: string;
}

export interface ResearchMeta {
  available: boolean;
  provider?: string | null;
  searchedAt?: string;
  queries?: string[];
  warning?: string;
  results: ResearchSource[];
}

export type ProjectTypeId = "product" | "tech" | "growth" | "general";
export type ProjectStatus = "generating" | "planning" | "in_progress" | "completed" | "archived" | "error";

export type TaskPhase = "准备" | "调研" | "执行" | "收尾";

export interface Task {
  id: string;
  title: string;
  phase: TaskPhase;
  done: boolean;
  dueDate?: string;
}

export interface Milestone {
  phase: TaskPhase;
  name: string;
  duration: string;
  goal: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectTypeId;
  status: ProjectStatus;
  progress: number;
  stages: StageInfo[];
  tasks: Task[];
  milestones: Milestone[];
  content: string;
  wordCount: number;
  cover: number; // 封面渐变索引
  createdAt: string;
  dueDate?: string;
  startDate?: string;
  refLink?: string;
  researchMeta?: ResearchMeta;
}

export interface FeedbackItem {
  id: string;
  reportId: string;
  reportTitle: string;
  rating: number; // 1-5
  strengths: string; // 满意点
  improvements: string; // 改进建议
  comment: string; // 附加评论
  createdAt: string;
}

export type ThemePref = "light" | "dark" | "system";

// Skill 相关类型
export type SkillStatus = 'active' | 'watch' | 'stale' | 'archived' | 'pinned';

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string; // markdown 内容
  category: CategoryId;
  status: SkillStatus;
  usageCount: number;
  rating: number; // 1-5
  createdAt: string;
  updatedAt: string;
  version: number;
  author: string;
  tags: string[];
}

export interface SkillVersion {
  id: string;
  skillId: string;
  version: number;
  name: string;
  description: string;
  content: string;
  category: CategoryId;
  createdAt: string;
}

export interface EvolutionLog {
  id: string;
  timestamp: string;
  type: 'skill_created' | 'skill_updated' | 'skill_archived' | 'skill_pinned' | 'feedback_processed';
  subject?: string;
  skillName?: string;
  description: string;
}
export type AnalysisDepth = "basic" | "standard" | "deep";
export type PlanningStyle = "agile" | "waterfall" | "hybrid";

export interface UserSettings {
  username: string;
  avatar: string; // dataURL 或预设 key
  theme: ThemePref;
  fontSize: number; // 13-20
  analysisDepth: AnalysisDepth;
  researchSources: number; // 3-20
  planningStyle: PlanningStyle;
}

export interface ToastMsg {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export type CategoryId = "ai" | "coding" | "design" | "business" | "general";

export const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: "ai", label: "人工智能", emoji: "🤖" },
  { id: "coding", label: "编程开发", emoji: "💻" },
  { id: "design", label: "设计创意", emoji: "🎨" },
  { id: "business", label: "商业管理", emoji: "📈" },
  { id: "general", label: "通用领域", emoji: "📚" },
];

export const PROJECT_TYPES: { id: ProjectTypeId; label: string; emoji: string }[] = [
  { id: "product", label: "产品项目", emoji: "🚀" },
  { id: "tech", label: "技术开发", emoji: "⚙️" },
  { id: "growth", label: "个人成长", emoji: "🌱" },
  { id: "general", label: "其他", emoji: "📌" },
];

export const SKILL_STATUS_LABEL: Record<SkillStatus, { label: string; cls: string }> = {
  active: { label: "活跃", cls: "bg-forest-100 text-forest-600 dark:bg-night-700 dark:text-forest-300" },
  watch: { label: "观察中", cls: "bg-sky-100 text-sky-600 dark:bg-night-700 dark:text-sky-300" },
  stale: { label: "陈旧", cls: "bg-amberx/15 text-amberx" },
  archived: { label: "已归档", cls: "bg-ink-200 text-ink-600 dark:bg-night-700 dark:text-forest-300/70" },
  pinned: { label: "已置顶", cls: "bg-purple-100 text-purple-600 dark:bg-night-700 dark:text-purple-300" },
};

export const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  generating: { label: "生成中", cls: "bg-amberx/15 text-amberx" },
  completed: { label: "已完成", cls: "bg-forest-100 text-forest-600 dark:bg-night-700 dark:text-forest-300" },
  archived: { label: "已归档", cls: "bg-ink-200 text-ink-600 dark:bg-night-700 dark:text-forest-300/70" },
  error: { label: "生成失败", cls: "bg-coral/15 text-coral" },
  planning: { label: "规划中", cls: "bg-skyx/15 text-skyx" },
  in_progress: { label: "进行中", cls: "bg-forest-100 text-forest-600 dark:bg-night-700 dark:text-forest-300" },
};

export const STAGE_NAMES: Record<StageId, string> = {
  analysis: "横纵分析",
  research: "深度调研",
  planning: "规划建议",
};

export const STAGE_DESCS: Record<StageId, string[]> = {
  analysis: ["正在界定领域边界…", "正在绘制知识版图…", "正在梳理历史脉络…"],
  research: ["正在检索核心术语…", "正在整理权威资料…", "正在提炼方法论…"],
  planning: ["正在制定学习路线…", "正在编排实践清单…", "正在生成报告…"],
};

export const TASK_PHASES: TaskPhase[] = ["准备", "调研", "执行", "收尾"];
