// ============================================================
// Skill template extractor
// Turns a generated report into a reusable Skill skeleton by
// keeping the heading structure and replacing body content with
// placeholder slots.
// ============================================================

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/gm;
const PLACEHOLDER_TEXT = "_（待补充：在新场景下填写本节的具体内容）_";
const MAX_HEADING_LEVEL = 4;

export interface ExtractedTemplate {
  /** The Skill title (taken from the report's H1, or a fallback). */
  title: string;
  /** All extracted headings (h1..h4), in order. */
  headings: { level: number; text: string }[];
  /** A markdown skeleton mirroring the report's structure. */
  markdown: string;
  /** Suggested tags derived from headings (heuristic). */
  tags: string[];
  /** Description for the Skill (a one-line summary). */
  description: string;
}

/**
 * Build a Skill template from a generated report. The output keeps the
 * report's heading hierarchy but strips the prose so the resulting
 * Skill is a true skeleton, not a duplicate of the original.
 *
 * Falls back to a generic 4-section template if the report has no
 * headings (e.g. the AI returned a single paragraph).
 */
export function extractSkillTemplate(content: string, subject: string): ExtractedTemplate {
  const headings: { level: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  // Reset regex state — global regex carries lastIndex across calls.
  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(content)) !== null) {
    const level = m[1].length;
    if (level > MAX_HEADING_LEVEL) continue;
    const text = m[2].replace(/\*\*/g, "").trim();
    if (!text) continue;
    headings.push({ level, text });
  }

  // Derive a Skill title from the first H1, else from the subject.
  const h1 = headings.find(h => h.level === 1);
  const title = h1?.text ?? `${subject} 研究模板`;

  // Build the skeleton markdown.
  let markdown = `# ${title}\n\n`;
  markdown += `> 本模板由「Systematically Learn and Do」基于「${subject}」研究自动提炼而成。\n`;
  markdown += `> 仅保留原报告的结构骨架，具体内容请按新场景重新填写。\n\n`;

  if (headings.length === 0) {
    // No structure to extract — provide a generic but useful 4-section template.
    markdown += `## 一、横向分析：领域边界与知识版图\n${PLACEHOLDER_TEXT}\n\n`;
    markdown += `## 二、纵向分析：历史沿革与发展趋势\n${PLACEHOLDER_TEXT}\n\n`;
    markdown += `## 三、深度调研：核心概念与方法论\n${PLACEHOLDER_TEXT}\n\n`;
    markdown += `## 四、规划建议：系统学习路线图\n${PLACEHOLDER_TEXT}\n`;
  } else {
    // Skip the title heading (already used as the Skill's H1); emit all
    // others with their original level (h1 demoted to h2 so the Skill
    // owns exactly one H1).
    const titleIdx = headings.findIndex(h => h.level === 1);
    for (let i = 0; i < headings.length; i++) {
      if (i === titleIdx) continue;
      const prefix = "#".repeat(Math.max(2, headings[i].level));
      markdown += `${prefix} ${headings[i].text}\n${PLACEHOLDER_TEXT}\n\n`;
    }
    // Drop trailing blank line.
    markdown = markdown.replace(/\n+$/, "\n");
  }

  // Heuristic tags from h2 headings (CJK-friendly).
  // Anchor stripping to the prefix only — earlier regex removed digits
  // anywhere, which mangled titles like "GPT-4 架构" into "GPT- 架构".
  const tags = headings
    .filter(h => h.level === 2)
    .map(h => h.text
      .replace(/^[一二三四五六七八九十0-9]+[、.\s]+/, "") // leading 一、 / 1.1 etc
      .replace(/^[：:.\s]+/, "")
      .trim()
    )
    .filter(Boolean)
    .slice(0, 3);

  const description = headings.length > 0
    ? `基于「${subject}」研究提取的结构骨架（${headings.length} 个章节）。可作为同类主题研究的起点。`
    : `基于「${subject}」研究生成的通用学习模板。`;

  return { title, headings, markdown, tags, description };
}

/**
 * Backwards-compatible wrapper that just returns the markdown string.
 * Kept so older callers don't need to migrate.
 */
export function extractTemplateString(content: string, subject: string): string {
  return extractSkillTemplate(content, subject).markdown;
}
