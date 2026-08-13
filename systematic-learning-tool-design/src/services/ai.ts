// AI API Service — 已迁移到后端 server/services/aiService.js
// 前端现在通过 /api/learn 接口调用，保留此文件仅供兼容
export const generateReportWithAI = async () => {
  throw new Error('AI generation has moved to the backend. Use /api/learn endpoint.');
};
export const getRelatedSuggestions = () => [];
export type GenerateReportOptions = { subject: string; category: string; depth?: 'basic' | 'standard' | 'deep' };
export type ReportResult = { content: string; wordCount: number };
