import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateLearnCreate,
  validateLearnReportPatch,
  validateProjectCreate,
  validateProjectPatch,
  validateTaskAdd,
  validateSkillCreate,
  validateSkillPatch,
  validateFeedbackCreate,
  validateSettingsPatch,
  ENUMS,
  RANGES,
} from "../server/validators.js";

test("validateLearnCreate: missing subject -> error", () => {
  const errs = validateLearnCreate({ category: "general" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /subject/);
});

test("validateLearnCreate: missing category -> error", () => {
  const errs = validateLearnCreate({ subject: "X" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /category/);
});

test("validateLearnCreate: valid subject + category passes", () => {
  const errs = validateLearnCreate({ subject: "React", category: "coding" });
  assert.equal(errs.length, 0);
});

test("validateLearnCreate: invalid depth -> error", () => {
  const errs = validateLearnCreate({ subject: "X", category: "general", depth: "insane" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /depth/);
});

test("validateLearnReportPatch: bad status -> error", () => {
  const errs = validateLearnReportPatch({ status: "bogus" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /bogus/);
});

test("validateLearnReportPatch: valid status passes", () => {
  for (const s of ENUMS.reportStatus) {
    const errs = validateLearnReportPatch({ status: s });
    assert.equal(errs.length, 0, `status ${s} should be accepted`);
  }
});

test("validateLearnReportPatch: favorite must be boolean", () => {
  const errs = validateLearnReportPatch({ favorite: "yes" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /boolean/);
});

test("validateProjectCreate: missing name -> error", () => {
  const errs = validateProjectCreate({ description: "d", type: "product" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /name/);
});

test("validateProjectCreate: bad type -> error", () => {
  const errs = validateProjectCreate({ name: "X", description: "d", type: "banana" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /banana/);
});

test("validateProjectCreate: valid passes", () => {
  for (const t of ENUMS.projectType) {
    const errs = validateProjectCreate({ name: "X", description: "d", type: t });
    assert.equal(errs.length, 0, `type ${t} should be accepted`);
  }
});

test("project refLink only accepts http/https URLs", () => {
  assert.equal(validateProjectCreate({ name: "X", description: "d", type: "general", refLink: "https://example.com" }).length, 0);
  assert.equal(validateProjectCreate({ name: "X", description: "d", type: "general", refLink: "javascript:alert(1)" }).length, 1);
  assert.equal(validateProjectPatch({ refLink: "not a url" }).length, 1);
});

test("validateProjectPatch: progress out of range", () => {
  assert.equal(validateProjectPatch({ progress: -1 }).length, 1);
  assert.equal(validateProjectPatch({ progress: 150 }).length, 1);
  assert.equal(validateProjectPatch({ progress: 50 }).length, 0);
});

test("validateTaskAdd: missing title -> error", () => {
  assert.equal(validateTaskAdd({ phase: "准备" }).length, 1);
  assert.equal(validateTaskAdd({ title: "T", phase: "准备" }).length, 0);
});

test("validateSkillCreate: missing name -> error", () => {
  const errs = validateSkillCreate({ description: "d", content: "c" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /name/);
});

test("validateSkillCreate: missing description -> error", () => {
  const errs = validateSkillCreate({ name: "X", content: "c" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /description/);
});

test("validateSkillCreate: missing content -> error", () => {
  const errs = validateSkillCreate({ name: "X", description: "d" });
  assert.equal(errs.length, 1);
  assert.match(errs[0], /content/);
});

test("validateSkillPatch: bad status -> error", () => {
  for (const s of ENUMS.skillStatus) {
    assert.equal(validateSkillPatch({ status: s }).length, 0, `status ${s}`);
  }
  assert.equal(validateSkillPatch({ status: "bogus" }).length, 1);
});

test("validateFeedbackCreate: rating out of range -> error", () => {
  assert.equal(validateFeedbackCreate({ reportTitle: "X", rating: 0 }).length, 1);
  assert.equal(validateFeedbackCreate({ reportTitle: "X", rating: 6 }).length, 1);
  assert.equal(validateFeedbackCreate({ reportTitle: "X", rating: 3 }).length, 0);
});

test("validateFeedbackCreate: missing reportTitle -> error", () => {
  assert.equal(validateFeedbackCreate({ rating: 3 }).length, 1);
});

test("validateSettingsPatch: bad theme / depth / style -> error", () => {
  assert.equal(validateSettingsPatch({ theme: "neon" }).length, 1);
  assert.equal(validateSettingsPatch({ analysisDepth: "insane" }).length, 1);
  assert.equal(validateSettingsPatch({ planningStyle: "extreme" }).length, 1);
  for (const t of ENUMS.theme) {
    assert.equal(validateSettingsPatch({ theme: t }).length, 0);
  }
});

test("validateSettingsPatch: fontSize out of range -> error", () => {
  assert.equal(validateSettingsPatch({ fontSize: 9 }).length, 1);
  assert.equal(validateSettingsPatch({ fontSize: 33 }).length, 1);
  assert.equal(validateSettingsPatch({ fontSize: 15 }).length, 0);
});
