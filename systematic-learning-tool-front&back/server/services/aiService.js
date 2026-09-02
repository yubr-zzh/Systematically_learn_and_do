// ============================================================
// AI Research Service - Three Stage Research Engine
// Integrates with: horizontal-vertical-analysis, deep-research-workflow, plan
// ============================================================

import nodeFetch from 'node-fetch';
import https from 'node:https';
// `fetch` resolves lazily: tests inject a stub via globalThis.fetch.
// At runtime we always fall back to the bundled node-fetch.
const getFetch = () => (typeof globalThis.fetch === 'function' ? globalThis.fetch : nodeFetch);
import { config } from '../config.js';
import { formatEvidenceForPrompt, searchWeb } from './webSearch.js';

const API_KEY = config.apiKey;
const API_BASE_URL = config.apiBaseUrl;
const MODEL = config.aiModel;

// Bypass system proxy for AI API calls
const httpsAgent = new https.Agent({ proxy: false });

/**
 * Streaming AI call (DeepSeek Chat Completions, OpenAI-compatible SSE).
 *
 * Returns the fully accumulated content as a string. Every chunk also
 * triggers `onChunk({ delta, accumulated, stage })` so callers can map
 * real bytes-arrived into a 0..1 ratio and surface truthful progress
 * to the UI.
 *
 * Why stream: with non-streaming `callAI` the network call holds the
 * socket for 60-120s before the response body lands. SSE gives us
 * intermediate events so we can show "stage X at 42%" instead of
 * waiting for the full body. Also gets us out of the
 * fake-elapsed-time-progress trap that used to live in learnStream.js.
 *
 * Back-compat: `callAI(messages, options)` is still exported below as
 * a thin wrapper that just drains the stream.
 */
export async function callAIStream(messages, options = {}, onChunk = null) {
  const { maxTokens = 4000, temperature = 0.7, stage = 'unknown' } = options;
  if (!API_KEY) {
    throw new Error('AI API key is not configured (DEEPSEEK_API_KEY)');
  }

  const response = await getFetch()(`${API_BASE_URL}/chat/completions`, {
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
      stream: true,
    }),
    agent: httpsAgent,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  let accumulated = '';
  // SSE framing: lines starting with "data: " until the terminating
  // sentinel "data: [DONE]". node-fetch exposes response.body as a
  // WHATWG ReadableStream.
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Process all complete SSE events currently in the buffer.
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          // Final chunk.
          if (onChunk) onChunk({ delta: '', accumulated, stage });
          return accumulated;
        }
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulated += delta;
            if (onChunk) onChunk({ delta, accumulated, stage });
          }
        } catch {
          // Malformed chunk — skip rather than abort the whole call.
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  // If the server closes the stream without sending [DONE], still
  // hand back whatever we accumulated.
  if (onChunk) onChunk({ delta: '', accumulated, stage });
  return accumulated;
}

/**
 * Non-streaming wrapper retained for back-compat with any caller that
 * doesn't care about intermediate chunks. Internally still streams —
 * just discards onChunk.
 */
async function callAI(messages, options = {}) {
  return callAIStream(messages, options, null);
}

/**
 * Stage 1: Horizontal-Vertical Analysis
 * Uses horizontal-vertical-analysis skill
 */
export async function stage1HorizontalVerticalAnalysis(subject, category, options = {}) {
  const { depth = 'standard', template, sources = config.webSearchMaxResults, searchQueries = [], timeRange } = options;
  const currentDate = new Date().toISOString().slice(0, 10);
  const queries = searchQueries.length > 0 ? searchQueries : [
    `${subject} latest developments ${new Date().getUTCFullYear()}`,
    `${subject} official documentation guide`,
    `${subject} best practices pitfalls`,
  ];
  const evidence = await searchWeb(queries, { maxResults: sources, depth, timeRange });

  // If a Skill template is provided, replace {subject} / {category}
  // placeholders and use it as the system prompt. This is how
  // pre-existing Skill knowledge is reused for new research.
  let systemPrompt = `你是一位资深的技术与商业研究分析师，擅长使用「横纵分析法」进行深度研究。请用中文输出结构化的研究报告。

## 横纵分析法说明
- 纵向分析：沿时间轴还原研究对象从诞生到现在的发展全貌
- 横向分析：以当前时间点为切面，与同赛道竞品进行全面对比
- 交叉定位：结合纵向和横向分析，给出切入点建议`;
  if (template) {
    systemPrompt = template
      .replace(/\{subject\}/g, subject)
      .replace(/\{category\}/g, category);
  }

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

  const enrichedUserPrompt = `${userPrompt}\n\n## 时效性与来源要求\n当前日期：${currentDate}\n- 涉及版本、价格、政策、发布日期、当前趋势等易变事实时，优先使用联网资料。\n- 使用联网资料时在相关句子末尾保留 [n] 引用，并在报告末尾输出来源与检索时间。\n- 如果联网资料不可用，不要编造引用，并明确标注哪些内容可能已过时。\n\n## 联网检索证据\n${formatEvidenceForPrompt(evidence)}`;

  const stageMaxTokens = depth === 'deep' ? 8000 : 4000;
  const content = await callAIStream(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enrichedUserPrompt },
    ],
    { maxTokens: stageMaxTokens, stage: 'analysis' },
    options.onChunk || null
  );

  return {
    stage: 'analysis',
    content,
    wordCount: content.replace(/\s/g, '').length,
    researchMeta: evidence,
  };
}

/**
 * Stage 2: Deep Research
 * Searches for related practices and extracts key patterns
 */
export async function stage2DeepResearch(subject, analysisContent, options = {}) {
  const { sources = config.webSearchMaxResults, searchQueries = [], timeRange } = options;
  
  // Build search queries based on subject
  const queries = searchQueries.length > 0 
    ? searchQueries 
    : [
        `${subject} latest developments ${new Date().getUTCFullYear()}`,
        `${subject} common mistakes pitfalls`,
        `${subject} implementation guide`,
      ];

  const evidence = await searchWeb(queries, { maxResults: sources, depth: 'deep', timeRange });
  
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

  const enrichedUserPrompt = `${userPrompt}\n\n## 联网检索证据\n${formatEvidenceForPrompt(evidence)}\n\n请在使用联网资料时保留 [n] 引用和来源列表。`;
  const content = await callAIStream(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enrichedUserPrompt },
    ],
    { maxTokens: 3000, stage: 'research' },
    options.onChunk || null
  );

  return {
    stage: 'research',
    content,
    wordCount: content.replace(/\s/g, '').length,
    researchMeta: evidence,
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

  const content = await callAIStream(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 3000, stage: 'planning' },
    options.onChunk || null
  );

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
/**
 * Run the three-stage research pipeline with truthful progress reporting.
 *
 * Caller passes `onProgress(percent)` (0..100). We map each stage's
 * in-flight chunk count into a global window:
 *   stage1 (analysis)   :  3% ->  43%
 *   stage2 (research)   : 43% ->  73%
 *   stage3 (planning)   : 73% ->  97%
 *   post-processing     : 97% -> 100%
 *
 * Within a stage, the ratio is `accumulated / expectedChars` clamped to
 * the stage's window. The 3% head-start is the "report created, AI
 * starting" tick. The 3% tail is for the DB writes + version snapshot
 * after the AI finishes. Clamped at 99% until complete() runs so the
 * UI never sits at 100% while we're still writing.
 */
export async function runLearnAnalysis(subject, category, options = {}) {
  const { depth = 'standard', sources = config.webSearchMaxResults, timeRange, onProgress } = options;
  console.log(`[Learn] 横纵分析: ${subject}`);

  // Heuristic per-stage expected output: ~2 chars per token, capped at
  // the per-stage maxTokens. Avoids div-by-zero when a stage is
  // skipped (e.g. AI fallback path that returns a short template).
  const stage1Expected = Math.max(2000, (depth === 'deep' ? 8000 : 4000) * 2);
  const stage2Expected = Math.max(2000, 3000 * 2);
  const stage3Expected = Math.max(2000, 3000 * 2);

  // stage window (in percent of global progress)
  const windows = {
    analysis: { from: 3, to: 43 },
    research: { from: 43, to: 73 },
    planning: { from: 73, to: 97 },
  };
  const makeStageChunkHandler = (stageName, expectedChars) => {
    const w = windows[stageName];
    return ({ accumulated }) => {
      if (!onProgress) return;
      const ratio = Math.max(0, Math.min(1, accumulated.length / expectedChars));
      const percent = w.from + ratio * (w.to - w.from);
      // Clamp below 100 so the UI doesn't show 100% before complete().
      onProgress(Math.min(99, Math.round(percent)));
    };
  };

  let stage1;
  try {
    stage1 = await stage1HorizontalVerticalAnalysis(subject, category, {
      depth, sources, timeRange,
      onChunk: makeStageChunkHandler('analysis', stage1Expected),
    });
  } catch (e) {
    console.warn('[Learn] AI 不可用，使用模板:', e.message);
    stage1 = generateTemplateReport(subject, category);
    if (onProgress) onProgress(windows.analysis.to);
  }

  let stage2;
  try {
    stage2 = await stage2DeepResearch(subject, stage1.content, {
      sources, timeRange,
      onChunk: makeStageChunkHandler('research', stage2Expected),
    });
  } catch (e) {
    console.warn('[Learn] deep research fallback:', e.message);
    stage2 = { stage: 'research', content: '## Deep Research\n\nAI unavailable; use the analysis above to continue practical research.', wordCount: 50, researchMeta: stage1.researchMeta };
    if (onProgress) onProgress(windows.research.to);
  }

  let stage3;
  try {
    stage3 = await stage3Planning(subject, stage1.content, stage2.content, {
      style: 'hybrid',
      onChunk: makeStageChunkHandler('planning', stage3Expected),
    });
  } catch (e) {
    console.warn('[Learn] planning fallback:', e.message);
    stage3 = { stage: 'planning', content: '## Planning Suggestions\n\nCreate a learning roadmap from the core concepts and pitfalls.', wordCount: 30 };
    if (onProgress) onProgress(windows.planning.to);
  }

  const content = [stage1.content, stage2.content, stage3.content].join('\n\n---\n\n');

  if (onProgress) onProgress(99);

  return {
    content,
    stages: { analysis: stage1, research: stage2, planning: stage3 },
    wordCount: content.replace(/\s/g, '').length,
    researchMeta: stage1.researchMeta || { available: false, results: [], searchedAt: new Date().toISOString() },
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
