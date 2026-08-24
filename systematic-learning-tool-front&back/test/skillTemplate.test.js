import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSkillTemplate } from "../src/utils/skillTemplate.ts";

test("extractSkillTemplate: uses first H1 as title", () => {
  const r = extractSkillTemplate("# Foo Bar\n\nSome prose", "subject");
  assert.equal(r.title, "Foo Bar");
  assert.equal(r.headings.length, 1);
});

test("extractSkillTemplate: handles pre-title headings without duplication", () => {
  const r = extractSkillTemplate(
    "## 前置概述\nSome prose\n\n# 真正的标题\n\n## 章节一",
    "X"
  );
  assert.equal(r.title, "真正的标题");
  assert.deepEqual(r.headings.map(h => h.text), ["前置概述", "真正的标题", "章节一"]);
  // Markdown should not contain the title twice
  assert.equal((r.markdown.match(/真正的标题/g) || []).length, 1);
});

test("extractSkillTemplate: empty content -> generic 4-section fallback", () => {
  const r = extractSkillTemplate("Just a paragraph.", "某主题");
  assert.equal(r.headings.length, 0);
  assert.match(r.markdown, /横向分析/);
  assert.match(r.markdown, /纵向分析/);
  assert.match(r.markdown, /深度调研/);
  assert.match(r.markdown, /规划建议/);
});

test("extractSkillTemplate: tags extracted from H2 with prefix stripped", () => {
  const r = extractSkillTemplate(
    "## 一、横向分析\nx\n\n## GPT-4 架构\nx\n\n## 二、纵向\nx",
    "X"
  );
  // Numbers-prefixed H2 gets its leading numbering stripped
  assert.ok(r.tags.includes("横向分析"), "should have 横向分析");
  // Mid-string digits preserved (GPT-4)
  assert.ok(r.tags.includes("GPT-4 架构"), "should have GPT-4 架构");
});

test("extractSkillTemplate: cap at 3 tags (returns up to 3 most)", () => {
  // We have a private test that the slicing is bounded.
  const r = extractSkillTemplate(
    "## 一、first\n## 二、second\n## 三、third\n## 四、fourth",
    "X"
  );
  assert.ok(r.tags.length <= 3, `expected <=3 tags, got ${r.tags.length}`);
});
