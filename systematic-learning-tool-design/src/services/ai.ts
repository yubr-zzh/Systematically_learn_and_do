// AI API Service for Systematically Learn and Do
// DeepSeek API integration for generating learning reports

const API_KEY = import.meta.env.VITE_API_KEY || '';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.deepseek.com/v1';

export interface GenerateReportOptions {
  subject: string;
  category: string;
  depth?: 'basic' | 'standard' | 'deep';
  onProgress?: (stage: string, progress: number) => void;
}

export interface ReportResult {
  content: string;
  wordCount: number;
}

/**
 * 调用 DeepSeek API 生成横纵分析报告
 */
export async function generateReportWithAI(
  options: GenerateReportOptions
): Promise<ReportResult> {
  const { subject, category, depth = 'standard', onProgress } = options;
  
  // 根据深度调整 token 限制
  const maxTokens = depth === 'deep' ? 8000 : depth === 'standard' ? 4000 : 2000;
  
  // 构建 prompt - 使用横纵分析法
  const prompt = buildHorizontalVerticalPrompt(subject, category, depth);
  
  onProgress?.('正在调用 AI 分析...', 10);
  
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位资深的技术与商业研究分析师，擅长使用横纵分析法进行深度研究。请用中文输出结构化的研究报告。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    onProgress?.('分析完成', 100);
    
    return {
      content,
      wordCount: content.replace(/\s/g, '').length,
    };
  } catch (error) {
    console.error('AI 生成报告失败:', error);
    throw error;
  }
}

/**
 * 构建横纵分析法 Prompt
 */
function buildHorizontalVerticalPrompt(
  subject: string,
  category: string,
  depth: string
): string {
  const categoryMap: Record<string, string> = {
    ai: '人工智能',
    coding: '编程开发',
    design: '设计创意',
    business: '商业管理',
    general: '通用领域',
  };
  
  const categoryLabel = categoryMap[category] || category;
  
  return `请使用「横纵分析法」对「${subject}」进行一份完整的深度研究报告。

## 研究对象
${subject}（属于 ${categoryLabel} 领域）

## 报告要求

### 一、纵向分析（Diachronic）
沿时间轴，完整还原「${subject}」从诞生到现在的发展全貌：
1. 起源追溯：它诞生的背景是什么？基于什么技术/理念/需求而来？
2. 诞生节点：明确的首次发布/成立/提出时间，以及最初的形态和定位
3. 演进历程：按时间顺序梳理所有关键节点
4. 决策逻辑：在每个关键节点上，还原决策背后的原因

### 二、横向分析（Synchronic）
以当前时间点为切面，将「${subject}」与同赛道的竞品/同类进行全面对比：
1. 核心差异对比：技术路线、产品形态、目标用户、核心优势与短板
2. 用户视角：每个竞品的真实用户口碑如何？
3. 生态位分析：在整个赛道的版图中，「${subject}」占据的是什么位置？
4. 趋势判断：基于横向对比，「${subject}」在竞争格局中的走向是什么？

### 三、写作风格
1. 可读性优先：写得像一篇优质的深度报道
2. 叙事驱动：有故事弧线，有起承转合
3. 观点要有事实支撑
4. 用人话写：避免咨询公司式的套话

### 四、篇幅要求
- 深度（${depth}）：约 ${depth === 'deep' ? '8000-15000' : depth === 'standard' ? '4000-8000' : '2000-4000'} 字
- 包含：纵向发展史、横向竞品对比、横纵交汇总结

请输出一份完整的 Markdown 格式研究报告。`;
}

/**
 * 获取相关主题推荐（基于用户历史）
 */
export function getRelatedSuggestions(
  currentSubject: string,
  history: Array<{ subject: string; category: string }>
): Array<{ subject: string; category: string }> {
  // 简单实现：返回历史上相似分类的主题
  const current = history.find(h => h.subject === currentSubject);
  if (!current) return [];
  
  return history
    .filter(h => h.category === current.category && h.subject !== currentSubject)
    .slice(0, 3);
}
