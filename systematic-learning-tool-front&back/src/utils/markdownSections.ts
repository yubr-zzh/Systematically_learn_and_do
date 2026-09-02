// ============================================================
// Markdown H2 section splitter + section body rewriter.
// Replaces the brittle regex used in useFeedbackStore.ts:
//   content.split(/\n(?=##\s)/)
// which silently breaks on extra whitespace, escaped newlines, or
// when the feedback header is reformatted to e.g. "## 改进点
// （来自反馈）" with extra inner spaces.
// ============================================================
//
// We treat an H2 heading as a line starting with exactly "## "
// (two hashes + at least one space, then the heading text until
// the next H1/H2/H3+ heading line or end-of-string). Body is
// everything between this H2 and the next H2 (or end).

export interface MarkdownSection {
  /** Heading text without the leading "## " prefix. */
  heading: string;
  /** Heading level (2 here; included for future flexibility). */
  level: number;
  /** Start offset (inclusive) of the "## " line in the original string. */
  start: number;
  /** End offset (exclusive) where this section ends (start of next H2 or end). */
  end: number;
  /** Body of the section: the heading line + everything up to the next section. */
  raw: string;
}

/** Find every H2 ("## ...") heading line in the markdown. */
function findH2LineStarts(markdown: string): { lineStart: number; heading: string }[] {
  const out: { lineStart: number; heading: string }[] = [];
  // Anchor to start-of-line so "##" inside a paragraph doesn't match.
  // We use a regex that requires the line to begin with "## " — strictly
  // two hashes followed by at least one space and a non-empty heading.
  const re = /(^|\n)(## )([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    // m.index points at the start of the captured group (1), which is
    // either the beginning of string or the newline BEFORE "## ".
    // We want the offset of "## " itself, which is m.index + m[1].length.
    const headingStart = m.index + m[1].length;
    out.push({ lineStart: headingStart, heading: m[3].trim() });
  }
  return out;
}

/** Split markdown into sections at H2 boundaries. The first section
 * (any prose before the first H2) is included with heading === "" and
 * level === 0. */
export function splitByH2(markdown: string): MarkdownSection[] {
  const h2s = findH2LineStarts(markdown);
  if (h2s.length === 0) {
    return markdown.length === 0
      ? []
      : [{ heading: "", level: 0, start: 0, end: markdown.length, raw: markdown }];
  }

  const sections: MarkdownSection[] = [];

  // Preamble: anything before the first H2.
  if (h2s[0].lineStart > 0) {
    sections.push({
      heading: "",
      level: 0,
      start: 0,
      end: h2s[0].lineStart,
      raw: markdown.slice(0, h2s[0].lineStart),
    });
  }

  for (let i = 0; i < h2s.length; i++) {
    const cur = h2s[i];
    const next = h2s[i + 1];
    const end = next ? next.lineStart : markdown.length;
    sections.push({
      heading: cur.heading,
      level: 2,
      start: cur.lineStart,
      end,
      raw: markdown.slice(cur.lineStart, end),
    });
  }

  return sections;
}

/**
 * Find the section whose heading matches `header` (after trimming
 * and case-folding the comparison so accidental casing / whitespace
 * drift in the stored template still matches). Returns null if no
 * match. */
export function findSection(sections: MarkdownSection[], header: string): MarkdownSection | null {
  const needle = header.trim().toLowerCase();
  return sections.find(s => s.heading.trim().toLowerCase() === needle) || null;
}

/**
 * Replace the body of the section whose heading matches `header`
 * with `newBody`. If no such section exists, append a new H2
 * section with `newBody` to the end of the markdown. The
 * surrounding blank-line spacing is normalised so we don't end up
 * with stacked blank lines.
 *
 * The returned string is a fresh markdown document; the input is
 * not mutated.
 */
export function replaceSectionBody(markdown: string, header: string, newBody: string): string {
  const sections = splitByH2(markdown);
  const target = findSection(sections, header);

  // Trim the header for both writing AND matching so the caller can
  // pass a sloppy "  改进点（来自反馈）  " without ending up with
  // "##   改进点（来自反馈）" in the output.
  const cleanHeader = header.trim();
  const block = `## ${cleanHeader}\n\n${newBody.trimEnd()}\n`;

  if (!target) {
    // Append. Make sure the document ends with exactly one blank line
    // before our new section so we don't collide with content above —
    // unless the document was empty to begin with, in which case we
    // write just the block.
    if (markdown.trim() === "") return block;
    const trimmed = markdown.replace(/\s+$/, "");
    return `${trimmed}\n\n${block}`;
  }

  // Replace: keep everything before target.start, splice in the new
  // block, keep everything from target.end.
  const before = markdown.slice(0, target.start).replace(/\s+$/, "");
  const after = markdown.slice(target.end).replace(/^\s+/, "");
  const parts = [before];
  if (after.length > 0) parts.push(`\n\n${after.replace(/\s+$/, "")}`);
  return `${parts[0]}\n\n${block}${parts.slice(1).join("")}`;
}
