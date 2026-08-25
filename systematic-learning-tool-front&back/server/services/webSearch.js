// Small provider adapter for freshness-sensitive research.
// It deliberately returns normalized evidence rather than provider-shaped data,
// so the AI prompts and the rest of the application do not depend on one vendor.
import fetch from 'node-fetch';
import https from 'node:https';
import { config } from '../config.js';

const httpsAgent = new https.Agent({ proxy: false });

function timeoutSignal(ms) {
  return AbortSignal.timeout(Math.max(1_000, ms));
}

function pickProvider() {
  if (config.webSearchProvider === 'none') return null;
  if (config.webSearchProvider === 'tavily' && config.tavilyApiKey) return 'tavily';
  if (config.webSearchProvider === 'brave' && config.braveSearchApiKey) return 'brave';
  if (config.webSearchProvider === 'auto') {
    if (config.tavilyApiKey) return 'tavily';
    if (config.braveSearchApiKey) return 'brave';
  }
  return null;
}

function normalize(item, provider) {
  return {
    title: String(item.title || '').trim(),
    url: String(item.url || item.link || '').trim(),
    snippet: String(item.content || item.description || item.snippet || '').trim().slice(0, 2_000),
    publishedAt: item.published_date || item.age || null,
    provider,
  };
}

async function searchTavily(query, options) {
  const body = {
    query,
    topic: 'general',
    search_depth: options.depth === 'deep' ? 'advanced' : 'basic',
    max_results: options.maxResults,
    include_answer: false,
    include_raw_content: false,
  };
  if (options.timeRange) body.time_range = options.timeRange;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.tavilyApiKey}` },
    body: JSON.stringify(body),
    signal: timeoutSignal(config.webSearchTimeoutMs),
    agent: httpsAgent,
  });
  if (!res.ok) throw new Error(`Tavily search error: ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(item => normalize(item, 'tavily'));
}

async function searchBrave(query, options) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(options.maxResults));
  url.searchParams.set('safesearch', 'moderate');
  if (options.freshness) url.searchParams.set('freshness', options.freshness);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': config.braveSearchApiKey },
    signal: timeoutSignal(config.webSearchTimeoutMs),
    agent: httpsAgent,
  });
  if (!res.ok) throw new Error(`Brave search error: ${res.status}`);
  const data = await res.json();
  return (data.web?.results || []).map(item => normalize(item, 'brave'));
}

export async function searchWeb(queries, options = {}) {
  const provider = pickProvider();
  const requested = [...new Set((Array.isArray(queries) ? queries : [queries]).filter(Boolean))].slice(0, 6);
  const searchedAt = new Date().toISOString();
  if (!provider || requested.length === 0) {
    return { available: false, provider: null, searchedAt, queries: requested, results: [], warning: '未配置联网搜索提供商或 API Key' };
  }

  const searchOptions = {
    maxResults: Math.min(Math.max(Number(options.maxResults || config.webSearchMaxResults), 1), 20),
    depth: options.depth || 'standard',
    timeRange: options.timeRange,
    freshness: options.freshness,
  };
  try {
    const batches = await Promise.all(requested.map(query => provider === 'tavily'
      ? searchTavily(query, searchOptions)
      : searchBrave(query, searchOptions)));
    const seen = new Set();
    const results = batches.flat().filter(item => item.url && !seen.has(item.url) && seen.add(item.url));
    return { available: true, provider, searchedAt, queries: requested, results };
  } catch (error) {
    console.warn(`[WebSearch] ${error.message}`);
    return { available: false, provider, searchedAt, queries: requested, results: [], warning: error.message };
  }
}

export function formatEvidenceForPrompt(bundle) {
  if (!bundle?.available || !bundle.results?.length) {
    return `联网检索状态：不可用。不要伪造来源；明确说明结论主要来自模型知识，知识截止时间无法保证。\n当前日期：${new Date().toISOString().slice(0, 10)}`;
  }
  const lines = bundle.results.map((source, index) =>
    `[${index + 1}] ${source.title}\nURL: ${source.url}\n摘要: ${source.snippet}\n发布时间/年龄: ${source.publishedAt || '未知'}`
  );
  return `联网检索状态：已执行（${bundle.provider}，检索时间 ${bundle.searchedAt}）。只可根据下列资料陈述时效性事实，并在报告中保留 [n] 引用。\n\n${lines.join('\n\n')}`;
}
