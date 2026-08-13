// ============================================================
// 初始示例数据（首次启动时注入）
// ============================================================

import type { CategoryId, FeedbackItem, LearnReport, Project, ProjectTypeId, Task, TaskPhase } from "../types";
import { generateLearnReport, generateProjectReport } from "./reportGenerator";

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

function makeReport(id: string, subject: string, category: CategoryId, createdAt: string, favorite = false): LearnReport {
  const content = generateLearnReport(subject, category);
  return {
    id,
    title: `${subject} · 系统研究报告`,
    subject,
    category,
    status: "completed",
    progress: 100,
    stages: [
      { id: "analysis", name: "横纵分析", status: "done", progress: 100 },
      { id: "research", name: "深度调研", status: "done", progress: 100 },
      { id: "planning", name: "规划建议", status: "done", progress: 100 },
    ],
    content,
    favorite,
    wordCount: content.replace(/\s/g, "").length,
    versions: [createdAt, daysAgo(1)],
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildSeedReports(): LearnReport[] {
  return [
    makeReport("seed-r1", "人工智能基础", "ai", daysAgo(2), true),
    makeReport("seed-r2", "React 框架系统学习", "coding", daysAgo(6)),
    makeReport("seed-r3", "产品设计思维", "design", daysAgo(13), true),
    makeReport("seed-r4", "商业分析与精益创业", "business", daysAgo(21)),
  ];
}

const TASK_LIB: Record<string, Task[]> = {
  chatbot: [
    { id: "t1", title: "调研主流对话模型与 API 选型", phase: "调研", done: true },
    { id: "t2", title: "确定产品定位与目标用户", phase: "准备", done: true },
    { id: "t3", title: "搭建对话原型（Prompt 版）", phase: "执行", done: true },
    { id: "t4", title: "接入向量数据库实现知识问答", phase: "执行", done: false },
    { id: "t5", title: "多轮对话与上下文管理优化", phase: "执行", done: false },
    { id: "t6", title: "用户测试与反馈收集", phase: "收尾", done: false },
  ],
  kb: [
    { id: "t1", title: "确定知识库信息架构", phase: "准备", done: true },
    { id: "t2", title: "调研笔记工具与双链方法", phase: "调研", done: true },
    { id: "t3", title: "搭建笔记分类与标签体系", phase: "执行", done: true },
    { id: "t4", title: "迁移存量笔记", phase: "执行", done: true },
    { id: "t5", title: "制定每周回顾机制", phase: "收尾", done: true },
  ],
  ecommerce: [
    { id: "t1", title: "市场调研与竞品分析", phase: "调研", done: false },
    { id: "t2", title: "确定选品方向", phase: "准备", done: false },
    { id: "t3", title: "搭建独立站框架", phase: "执行", done: false },
  ],
};

function makeProject(
  id: string,
  name: string,
  description: string,
  type: ProjectTypeId,
  status: Project["status"],
  progress: number,
  tasks: Task[],
  cover: number,
  createdAt: string,
  dueDate?: string
): Project {
  const { content, milestones } = generateProjectReport({ name, description, type, dueDate });
  return {
    id,
    name,
    description,
    type,
    status,
    progress,
    stages:
      progress >= 100
        ? [
            { id: "analysis", name: "横纵分析", status: "done", progress: 100 },
            { id: "research", name: "深度调研", status: "done", progress: 100 },
            { id: "planning", name: "规划建议", status: "done", progress: 100 },
          ]
        : [
            { id: "analysis", name: "横纵分析", status: "done", progress: 100 },
            { id: "research", name: "深度调研", status: "done", progress: 100 },
            { id: "planning", name: "规划建议", status: "pending", progress: 0 },
          ],
    tasks,
    milestones,
    content,
    wordCount: content.replace(/\s/g, "").length,
    cover,
    createdAt,
    dueDate,
  };
}

export function buildSeedProjects(): Project[] {
  return [
    makeProject(
      "seed-p1",
      "AI 聊天机器人",
      "打造一个支持知识库问答的智能客服助手，降低人工客服成本 60%",
      "tech",
      "in_progress",
      65,
      TASK_LIB.chatbot,
      0,
      daysAgo(15),
      daysAgo(-20)
    ),
    makeProject(
      "seed-p2",
      "个人知识库系统",
      "搭建可检索、可复用的第二大脑，沉淀学习与工作产出",
      "growth",
      "completed",
      100,
      TASK_LIB.kb,
      1,
      daysAgo(40),
      daysAgo(2)
    ),
    makeProject(
      "seed-p3",
      "跨境电商独立站",
      "从 0 到 1 启动一个小众品类的独立站，验证跨境业务可行性",
      "product",
      "planning",
      20,
      TASK_LIB.ecommerce,
      2,
      daysAgo(4),
      daysAgo(-60)
    ),
  ];
}

export function buildSeedFeedback(): FeedbackItem[] {
  return [
    {
      id: "fb1",
      reportId: "seed-r1",
      reportTitle: "人工智能基础 · 系统研究报告",
      rating: 5,
      strengths: "横向对比和纵向历史梳理非常清晰，学习路线图可直接执行",
      improvements: "希望能补充更多实操案例和视频资源",
      comment: "整体超出预期，报告结构正是我需要的。",
      createdAt: daysAgo(1),
    },
    {
      id: "fb2",
      reportId: "seed-r2",
      reportTitle: "React 框架系统学习 · 系统研究报告",
      rating: 4,
      strengths: "知识版图划分合理，误区提醒很实用",
      improvements: "框架对比部分可以更深入一些",
      comment: "",
      createdAt: daysAgo(5),
    },
    {
      id: "fb3",
      reportId: "seed-r3",
      reportTitle: "产品设计思维 · 系统研究报告",
      rating: 5,
      strengths: "方法论部分非常有启发，资源推荐质量高",
      improvements: "",
      comment: "已推荐给团队其他成员。",
      createdAt: daysAgo(12),
    },
  ];
}

export function getSeedTaskPhases(): TaskPhase[] {
  return ["准备", "调研", "执行", "收尾"];
}
