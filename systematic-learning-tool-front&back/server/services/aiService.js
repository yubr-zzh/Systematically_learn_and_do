// ============================================================
// AI Research Service - Three Stage Research Engine
// Integrates with: horizontal-vertical-analysis, deep-research-workflow, plan
// ============================================================

import fetch from 'node-fetch';

const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = process.env.AI_MODEL || 'deepseek-chat';

/**
 * Call AI API with error handling
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
 * Run complete three-stage research workflow
 */
export async function runFullResearch(subject, category, options = {}) {
  const { 
    depth = 'standard',
    sources = 8,
    style = 'hybrid',
    onStageComplete,
  } = options;

  console.log(`Starting research for: ${subject}`);

  // Stage 1: Horizontal-Vertical Analysis
  console.log('Stage 1: Horizontal-Vertical Analysis...');
  const stage1 = await stage1HorizontalVerticalAnalysis(subject, category, { depth });
  onStageComplete?.('analysis', stage1);

  // Stage 2: Deep Research
  console.log('Stage 2: Deep Research...');
  const stage2 = await stage2DeepResearch(subject, stage1.content, { sources });
  onStageComplete?.('research', stage2);

  // Stage 3: Planning
  console.log('Stage 3: Planning...');
  const stage3 = await stage3Planning(subject, stage1.content, stage2.content, { style });
  onStageComplete?.('planning', stage3);

  // Combine all stages
  const fullContent = `# ${subject} 深度研究报告

${stage1.content}

---

${stage2.content}

---

${stage3.content}

---

*本报告由 Systematically Learn and Do 自动生成*
`;

  return {
    content: fullContent,
    stages: {
      analysis: stage1,
      research: stage2,
      planning: stage3,
    },
    wordCount: fullContent.replace(/\s/g, '').length,
  };
}

/**
 * Skill-based research - uses existing skills for template
 */
export async function skillBasedResearch(subject, skillTemplate, options = {}) {
  const systemPrompt = `你是一个研究助手，擅长按照模板进行深度研究。`;

  const userPrompt = `请按照以下模板，对「${subject}」进行研究：

${skillTemplate}

请输出完整的 Markdown 格式研究报告。`;

  const content = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return {
    content,
    wordCount: content.replace(/\s/g, '').length,
  };
}
