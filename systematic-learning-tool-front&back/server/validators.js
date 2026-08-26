// ============================================================
// Runtime validators for incoming request bodies.
// Each helper returns an array of error strings (empty = OK) so
// callers can either short-circuit with 400 or accumulate errors.
// ============================================================

export const ENUMS = {
  // learn reports
  reportStatus: new Set(["generating", "completed", "archived", "error"]),
  // projects
  projectStatus: new Set(["generating", "planning", "in_progress", "completed", "archived", "error"]),
  projectType: new Set(["product", "tech", "growth", "general"]),
  // skills
  skillStatus: new Set(["active", "watch", "stale", "archived", "pinned"]),
  skillCategory: new Set(["ai", "coding", "design", "business", "general", "research"]),
  // evolution log types (kept in sync with frontend EvolutionLog["type"])
  evolutionType: new Set([
    "skill_created", "skill_archived", "skill_pinned",
    "skill_updated", "feedback_processed",
  ]),
  // settings
  theme: new Set(["light", "dark", "system"]),
  analysisDepth: new Set(["basic", "standard", "deep"]),
  planningStyle: new Set(["agile", "waterfall", "hybrid"]),
};

export const RANGES = {
  fontSize: { min: 10, max: 32 },
  researchSources: { min: 1, max: 50 },
  rating: { min: 1, max: 5 },
  subjectLength: { min: 1, max: 200 },
  descriptionLength: { min: 1, max: 2000 },
  nameLength: { min: 1, max: 200 },
};

/** Validate one field against an allowed enum set. Returns an error message or null. */
function enumError(field, value, allowed) {
  if (value === undefined) return null;
  if (!allowed.has(value)) {
    return `${field} "${value}" 不在允许范围内 (${[...allowed].join(", ")})`;
  }
  return null;
}

/** Validate one field against a numeric range. Returns an error or null. */
function rangeError(field, value, range) {
  if (value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${field} 必须是数字`;
  if (n < range.min || n > range.max) return `${field} 必须在 ${range.min}-${range.max} 之间`;
  return null;
}

/** Validate one field against a string length range. */
function lengthError(field, value, range) {
  if (value === undefined) return null;
  const s = String(value);
  if (s.length < range.min || s.length > range.max) {
    return `${field} 长度必须在 ${range.min}-${range.max} 之间 (当前 ${s.length})`;
  }
  return null;
}

/** Helper used by routes: collects errors and returns 400 if any. */
export function badRequestIfAny(res, errors) {
  if (errors.length) {
    res.status(400).json({ error: "Validation failed", details: errors });
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// Per-resource validators. Each returns [] when valid.
// Only fields that are present in `body` are validated (partial PATCH
// is allowed everywhere).
// -------------------------------------------------------------

export function validateLearnReportPatch(body) {
  const errs = [];
  const e = enumError("status", body.status, ENUMS.reportStatus); if (e) errs.push(e);
  if (body.favorite !== undefined && typeof body.favorite !== "boolean")
    errs.push("favorite 必须是 boolean");
  return errs;
}

export function validateLearnCreate(body) {
  const errs = [];
  if (body.subject === undefined || !String(body.subject).trim()) errs.push("subject 必填且不能为空");
  else {
    const e = lengthError("subject", body.subject, RANGES.subjectLength); if (e) errs.push(e);
  }
  if (body.category === undefined || !String(body.category).trim()) errs.push("category 必填且不能为空");
  else {
    const e2 = enumError("category", body.category, ENUMS.skillCategory); if (e2) errs.push(e2);
  }
  if (body.depth !== undefined) {
    const e3 = enumError("depth", body.depth, ENUMS.analysisDepth);
    if (e3) errs.push(e3);
  }
  return errs;
}

export function validateProjectPatch(body) {
  const errs = [];
  const e1 = enumError("status", body.status, ENUMS.projectStatus); if (e1) errs.push(e1);
  const e2 = enumError("type", body.type, ENUMS.projectType); if (e2) errs.push(e2);
  const e3 = rangeError("progress", body.progress, { min: 0, max: 100 });
  if (e3) errs.push(e3);
  if (body.name !== undefined) {
    const e = lengthError("name", body.name, RANGES.nameLength);
    if (e) errs.push(e);
  }
  return errs;
}

export function validateProjectCreate(body) {
  const errs = [];
  if (body.name === undefined || !String(body.name).trim()) errs.push("name 必填且不能为空");
  else {
    const e = lengthError("name", body.name, RANGES.nameLength); if (e) errs.push(e);
  }
  if (body.description === undefined || !String(body.description).trim()) errs.push("description 必填且不能为空");
  else {
    const e = lengthError("description", body.description, RANGES.descriptionLength); if (e) errs.push(e);
  }
  if (body.type === undefined || !String(body.type).trim()) errs.push("type 必填且不能为空");
  else {
    const e3 = enumError("type", body.type, ENUMS.projectType); if (e3) errs.push(e3);
  }
  return errs;
}

export function validateTaskAdd(body) {
  const errs = [];
  if (body.title === undefined || !String(body.title).trim()) errs.push("title 必填且不能为空");
  else {
    const e1 = lengthError("title", body.title, { min: 1, max: 200 }); if (e1) errs.push(e1);
  }
  if (!body.phase) errs.push("phase 必填");
  return errs;
}

export function validateSkillPatch(body) {
  const errs = [];
  const e1 = enumError("status", body.status, ENUMS.skillStatus); if (e1) errs.push(e1);
  const e2 = enumError("category", body.category, ENUMS.skillCategory); if (e2) errs.push(e2);
  if (body.rating !== undefined) {
    const e3 = rangeError("rating", body.rating, RANGES.rating); if (e3) errs.push(e3);
  }
  return errs;
}

export function validateSkillCreate(body) {
  const errs = [];
  if (body.name === undefined || !String(body.name).trim()) errs.push("name 必填且不能为空");
  else {
    const e1 = lengthError("name", body.name, RANGES.nameLength); if (e1) errs.push(e1);
  }
  if (body.description === undefined || !String(body.description).trim()) errs.push("description 必填且不能为空");
  if (body.content === undefined || !String(body.content).trim()) errs.push("content 必填且不能为空");
  return errs;
}

export function validateFeedbackCreate(body) {
  const errs = [];
  if (body.rating === undefined) errs.push("rating 必填");
  else {
    const e1 = rangeError("rating", body.rating, RANGES.rating); if (e1) errs.push(e1);
  }
  if (!body.reportTitle) errs.push("reportTitle 必填");
  return errs;
}

export function validateSettingsPatch(body) {
  const errs = [];
  const e1 = enumError("theme", body.theme, ENUMS.theme); if (e1) errs.push(e1);
  const e2 = enumError("analysisDepth", body.analysisDepth, ENUMS.analysisDepth); if (e2) errs.push(e2);
  const e3 = enumError("planningStyle", body.planningStyle, ENUMS.planningStyle); if (e3) errs.push(e3);
  const e4 = rangeError("fontSize", body.fontSize, RANGES.fontSize); if (e4) errs.push(e4);
  const e5 = rangeError("researchSources", body.researchSources, RANGES.researchSources); if (e5) errs.push(e5);
  if (body.username !== undefined) {
    const e = lengthError("username", body.username, { min: 1, max: 50 });
    if (e) errs.push(e);
  }
  return errs;
}
