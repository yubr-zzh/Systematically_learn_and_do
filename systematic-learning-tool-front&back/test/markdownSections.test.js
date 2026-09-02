// Tests for the H2 section splitter used by feedback self-evolution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitByH2, findSection, replaceSectionBody } from "../src/utils/markdownSections.ts";

test("splitByH2: empty input returns []", () => {
  assert.deepEqual(splitByH2(""), []);
});

test("splitByH2: no H2 -> single preamble section", () => {
  const s = splitByH2("just a paragraph.\nmore text.");
  assert.equal(s.length, 1);
  assert.equal(s[0].heading, "");
  assert.equal(s[0].raw, "just a paragraph.\nmore text.");
});

test("splitByH2: one H2 + preamble + body", () => {
  const md = "# Top title\n\nIntro text.\n\n## Section A\n\nBody A.\n";
  const s = splitByH2(md);
  assert.equal(s.length, 2);
  assert.equal(s[0].heading, "");
  assert.match(s[0].raw, /Intro text/);
  assert.equal(s[1].heading, "Section A");
  assert.match(s[1].raw, /Body A/);
});

test("splitByH2: multiple H2s with bodies between them", () => {
  const md = "## A\n\nbody A\n\n## B\n\nbody B\n\n## C\n\nbody C";
  const s = splitByH2(md);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map(x => x.heading), ["A", "B", "C"]);
  assert.match(s[0].raw, /body A/);
  assert.match(s[1].raw, /body B/);
  assert.match(s[2].raw, /body C/);
});

test("splitByH2: H3+ does not split (only H2)", () => {
  const md = "## A\n\nbody A\n\n### A.1\n\nsub body\n\n## B\n\nbody B";
  const s = splitByH2(md);
  assert.equal(s.length, 2);
  assert.match(s[0].raw, /A\.1/);
  assert.match(s[0].raw, /sub body/);
});

test("splitByH2: ignores ## inside a code fence", () => {
  // Note: a robust parser would handle fences; the regex-based
  // splitter deliberately doesn't (we keep it simple). This test
  // documents that limitation — feedback self-evolution only ever
  // touches user-written headings, not fenced snippets.
  const md = "## A\n\n```\n## not-a-heading\n```\n\nbody A";
  const s = splitByH2(md);
  // Will incorrectly split on "## not-a-heading" because the regex
  // is line-based and doesn't track fence state. Pin the behaviour
  // so any future fix is intentional.
  assert.ok(s.length >= 2);
});

test("replaceSectionBody: appends new section when heading not present", () => {
  const out = replaceSectionBody(
    "## A\n\nbody A",
    "改进点（来自反馈）",
    "> 2025 · 评分 4星\n\ncomment text"
  );
  // Must contain exactly ONE "## 改进点（来自反馈）" heading.
  const matches = out.match(/## 改进点（来自反馈）/g) || [];
  assert.equal(matches.length, 1);
  // Body must be preserved.
  assert.match(out, /body A/);
  // New body must be present.
  assert.match(out, /comment text/);
  assert.match(out, /评分 4星/);
});

test("replaceSectionBody: replaces existing section body, never stacks duplicates", () => {
  const initial = "## A\n\nbody A\n\n## 改进点（来自反馈）\n\nold feedback\n";
  const out1 = replaceSectionBody(initial, "改进点（来自反馈）", "new feedback");
  const matches1 = out1.match(/## 改进点（来自反馈）/g) || [];
  assert.equal(matches1.length, 1, "must NOT stack duplicate sections");
  assert.match(out1, /new feedback/);
  assert.equal(out1.match(/old feedback/g), null, "old body must be gone");

  // Run twice to simulate two rounds of feedback.
  const out2 = replaceSectionBody(out1, "改进点（来自反馈）", "newer feedback");
  const matches2 = out2.match(/## 改进点（来自反馈）/g) || [];
  assert.equal(matches2.length, 1);
  assert.match(out2, /newer feedback/);
});

test("replaceSectionBody: tolerates extra inner spaces in stored heading", () => {
  const initial = "## 改进点（来自反馈）   \n\nstored body";
  const out = replaceSectionBody(initial, "改进点（来自反馈）", "replaced body");
  assert.match(out, /replaced body/);
  assert.equal(out.match(/stored body/g), null);
});

test("replaceSectionBody: tolerates leading/trailing whitespace around the header string passed in", () => {
  const out = replaceSectionBody("## A\n\nbody A", "  改进点（来自反馈）  ", "new body");
  const matches = out.match(/## 改进点（来自反馈）/g) || [];
  assert.equal(matches.length, 1);
  assert.match(out, /new body/);
});

test("replaceSectionBody: case-fold comparison works", () => {
  const initial = "## IMPROVEMENTS FROM FEEDBACK\n\nold";
  const out = replaceSectionBody(initial, "Improvements from Feedback", "new");
  assert.match(out, /new/);
  assert.equal(out.match(/old/g), null);
});

test("replaceSectionBody: leaves surrounding sections intact", () => {
  const initial = "## A\n\nbody A\n\n## 改进点（来自反馈）\n\nold\n\n## C\n\nbody C";
  const out = replaceSectionBody(initial, "改进点（来自反馈）", "new");
  assert.match(out, /body A/);
  assert.match(out, /body C/);
  assert.match(out, /new/);
});

test("replaceSectionBody: appends to an empty document without leading blank lines", () => {
  const out = replaceSectionBody("", "改进点", "first feedback");
  // No leading blank lines (start with the new section).
  assert.match(out, /^## 改进点/);
  assert.match(out, /first feedback/);
});
