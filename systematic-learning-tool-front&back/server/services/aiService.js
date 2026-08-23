// ============================================================
// AI Research Service - Three Stage Research Engine
// Integrates with: horizontal-vertical-analysis, deep-research-workflow, plan
// ============================================================

import fetch from 'node-fetch';
import https from 'node:https';
import { config } from '../config.js';

const API_KEY = config.apiKey;
const API_BASE_URL = config.apiBaseUrl;
const MODEL = config.aiModel;

// Bypass system proxy for AI API calls
const httpsAgent = new https.Agent({ proxy: false });

/**
 * Call AI API with error handling (proxy bypass)
 */
async function callAI(messages, options = {}) {
  const { maxTokens = 4000, temperature = 0.7 } = options;
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      agent: httpsAgent,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('AI service error:', error);
    throw error;
  }
}

/**
 * Stage 1: Horizontal-Vertical Analysis
 * Uses horizontal-vertical-analysis skill
 */
export async function stage1HorizontalVerticalAnalysis(subject, category, options = {}) {
  const { depth = 'standard' } = options;
  
  const systemPrompt = `你是一位资深的技术与商业研究分析师，擅长使用「横纵分析法」进行深度研究。请用中文输出结构化的研究报告。

## 横纵分析法说明
- 纵向分析：沿时间轴还原研究对象从诞生到现在的发展全貌
- 横向分析：以当前时间点为切面，与同赛道竞品进行全面对比
- 交叉定位：结合纵向和横向分析，给出切入点建议`;

  const userPrompt = `请使用「横纵分析法」对「${subject}」进行深度研究。

## 研究对象
${subject}（属于 ${category} 领域）

## 纵向分析要求
1. 起源追溯：诞生的背景、技术/理念/需求
2. 诞生节点：首次发布/成立时间，最初形态
3. 演进历程：按时间顺序梳理关键节点
4. 决策逻辑：还原关键决策背后的原因

## 横向分析要求
1. 核心差异对比：技术路线、产品形态、目标用户、优劣势
2. 用户视角：真实用户口碑和评价
3. 生态位分析：在赛道中的位置
4. 趋势判断：未来走向

## 输出格式
请输出完整的 Markdown 格式报告，包含：
- 纵向发展历程
- 横向现状对比
- 交叉定位与建议

篇幅：${depth === 'deep' ? '8000-15000字' : depth === 'standard' ? '4000-8000字' : '2000-4000字'}`;

  const content = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { maxTokens: depth === 'deep' ? 8000 : 4000 });

  return {
    stage: 'analysis',
    content,
    wordCount: content.replace(/\s/g, '').length,
  };
}

/**
 * Stage 2: Deep Research
 * Searches for related practices and extracts key patterns
 */
export async function stage2DeepResearch(subject, analysisContent, options = {}) {
  const { sources = 8, searchQueries = [] } = options;
  
  // Build search queries based on subject
  const queries = searchQueries.length > 0 
    ? searchQueries 
    : [
        `${subject} best practices 2024`,
        `${subject} common mistakes pitfalls`,
        `${subject} implementation guide`,
      ];

  // Note: In production, you would use web search API here
  // For now, we'll generate research content based on analysis
  
  const systemPrompt = `你是一位资深的研究分析师，擅长从实践中提取关键模式和常见坑点。`;

  const userPrompt = `基于以下横纵分析结果，请为「${subject}」补充深度调研内容：

## 已有分析
${analysisContent.slice(0, 3000)}

## 调研要求
1. 提取关键模式（Key Patterns）：该领域最重要的实践模式
2. 识别常见坑点（Common Pitfalls）：新手容易犯的错误
3. 整理最佳实践（Best Practices）：推荐的做法

## 输出格式
${'```markdown'}
## 2.1 关键模式
[提取的3-5个关键模式]

## 2.2 常见坑点
[识别3-5个常见坑点及解决方案]

## 2.3 最佳实践
[推荐的具体做法]
${'```'}

请输出 Markdown 格式内容。`;

  const content = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { maxTokens: 3000 });

  return {
    stage: 'research',
    content,
    wordCount: content.replace(/\s/g, '').length,
  };
}

/**
 * Stage 3: Planning
 * Generates actionable plan based on research
 */
export async function stage3Planning(subject, analysisContent, researchContent, options = {}) {
  const { style = 'hybrid' } = options;
  
  const systemPrompt = `你是一位资深的项目规划专家，擅长将调研结果转化为可执行的计划。`;

  const userPrompt = `基于以下调研结果，请为「${subject}」生成实施规划：

## 横纵分析
${analysisContent.slice(0, 2000)}

## 深度调研
${researchContent.slice(0, 2000)}

## 规划要求
1. 实施路线：分阶段的实现路径
2. 避坑指南：各阶段可能遇到的问题及应对
3. 时间规划：建议的时间分配
4. 锦囊妙计：帮助快速推进的小技巧

## 输出格式
${'```markdown'}
## 3.1 实施路线
[阶段1: ...]
[阶段2: ...]
[阶段3: ...]

## 3.2 避坑指南
[各阶段的潜在问题和解决方案]

## 3.3 时间规划
[建议的里程碑和时间点]

## 3.4 锦囊妙计
[实用的小技巧和资源]
${'```'}

风格：${style}（agile=敏捷迭代，waterfall=瀑布流程，hybrid=混合）

请输出 Markdown 格式内容。`;

  const content = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { maxTokens: 3000 });

  return {
    stage: 'planning',
    content,
    wordCount: content.replace(/\s/g, '').length,
  };
}

/**
 * 学习报告流程 —— 只做「横纵分析」
 * 针对：学习新概念 / 新领域
 */
export async function runLearnAnalysis(subject, category, options = {}) {
  const { depth = 'standard' } = options;
  console.log(`[Learn] 横纵分析: ${subject}`);

  let stage1;
  try {
    stage1 = await stage1HorizontalVerticalAnalysis(subject, category, { depth });
  } catch (e) {
    console.warn('[Learn] AI 不可用，使用模板:', e.message);
    stage1 = generateTemplateReport(subject, category);
  }

  return {
    content: stage1.content,
    stages: { analysis: stage1 },
    wordCount: stage1.wordCount,
  };
}

/**
 * 项目流程 —— 只做「深度调研 + 规划」
 * 针对：执行 project / 制定 plan
 */
export async function runProjectResearch(name, description, options = {}) {
  const { sources = 8, style = 'hybrid' } = options;
  console.log(`[Project] 深度调研+规划: ${name}`);

  let stage2;
  try {
    stage2 = await stage2DeepResearch(name, description, { sources });
  } catch (e) {
    console.warn('[Project] 调研 AI 不可用，使用模板:', e.message);
    stage2 = { stage: 'research', content: `## 深度调研（模板）\n\nAI 服务暂时不可用，以下为模板调研内容。`, wordCount: 100 };
  }

  let stage3;
  try {
    stage3 = await stage3Planning(name, description, stage2.content, { style });
  } catch (e) {
    console.warn('[Project] 规划 AI 不可用，使用模板:', e.message);
    stage3 = { stage: 'planning', content: `## 规划建议（模板）\n\nAI 服务暂时不可用，以下为模板规划内容。`, wordCount: 100 };
  }

  const fullContent = `# ${name} · 项目调研与规划\n\n${stage2.content}\n\n---\n\n${stage3.content}\n\n---\n\n*本报告由 Systematically Learn and Do 自动生成*`;

  return {
    content: fullContent,
    stages: { research: stage2, planning: stage3 },
    wordCount: fullContent.replace(/\s/g, '').length,
  };
}

// ============================================================
// Template Fallback — used when AI API is unavailable
// ============================================================

const CATEGORY_META = {
  general: {
    adjacent: [['相邻领域A', '关系描述'], ['相邻领域B', '关系描述']],
    history: [['起步', '早期', '初步探索'], ['发展', '中期', '快速成长'], ['成熟', '近期', '稳定应用']],
    core: ['核心概念', '关键方法', '实践应用'],
    pitfalls: ['避免概念空转', '先做项目再学理论'],
    summary: '建议以真实项目为锚点反向学习，用输出倒逼输入。',
  },
};

/** Generate a structured report from template when AI is unavailable */
export function generateTemplateReport(subject, category = 'general') {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.general;
  const now = new Date().toLocaleDateString('zh-CN');

  const adjacentRows = meta.adjacent.map(([a, b]) => `| ${a} | ${b} |`).join('\n');
  const historyRows = meta.history.map(([s, t, d]) => `| ${s} | ${t} | ${d} |`).join('\n');
  const coreRows = meta.core.map(c => `- ${c}`).join('\n');
  const pitfallRows = meta.pitfalls.map(p => `- ${p}`).join('\n');

  const content = `# 《${subject}》深度研究报告

> 本报告采用「横纵分析法」自动生成。
> 生成时间：${now}

## 一、横向分析：领域边界与知识版图

### 1.1 与相邻领域的对比

| 相邻领域 | 关系 |
| --- | --- |
${adjacentRows}

### 1.2 核心知识要素

${coreRows}

## 二、纵向分析：历史沿革

### 2.1 发展阶段

| 阶段 | 时期 | 特征 |
| --- | --- | --- |
${historyRows}

## 三、常见坑点与避坑建议

${pitfallRows}

## 四、总结

${meta.summary}

---
*本报告由 Systematically Learn and Do 自动生成*`;

  return { content, wordCount: content.replace(/\s/g, '').length };
}
