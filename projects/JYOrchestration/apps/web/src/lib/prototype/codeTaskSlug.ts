import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";

/** Canonical English slugs for standard CodeTask IDs (planning file boundaries). */
const CANONICAL_SLUG_BY_CODE_TASK_ID: Readonly<Record<string, string>> = {
  "CODE-DEV-FEATURE-001-001": "StartFlow",
  "CODE-DEV-FEATURE-002-001": "MeetingInputFlow",
  "CODE-DEV-FEATURE-003-001": "ProcessingFlow",
  "CODE-DEV-FEATURE-004-001": "ResultReviewFlow",
  "CODE-DEV-SCREEN-001-001": "InputScreen",
  "CODE-DEV-SCREEN-002-001": "ResultScreen",
  "CODE-DEV-SCREEN-003-001": "AdminScreen",
};

const FEATURE_FOLDER_BY_ROLE: Partial<Record<CodeTaskRoleKind, string>> = {
  feature_start: "start",
  feature_input: "input",
  feature_processing: "processing",
  feature_result: "result",
};

const SCREEN_COMPONENT_FOLDER_BY_SLUG: Readonly<Record<string, string>> = {
  InputScreen: "input",
  ResultScreen: "result",
  AdminScreen: "admin",
};

const HANGUL_RE = /[\u3131-\uD79D]/;

export function resolveCodeTaskCanonicalSlug(input: {
  readonly codeTaskId: string;
  readonly title?: string;
  readonly roleKind?: CodeTaskRoleKind;
}): string {
  const id = input.codeTaskId.trim();
  const mapped = CANONICAL_SLUG_BY_CODE_TASK_ID[id];
  if (mapped) return mapped;

  const fromId = id.match(/CODE-DEV-(?:FEATURE|SCREEN|COMMON)-\d+-(\d+)/i);
  if (fromId && input.roleKind) {
    const role = input.roleKind;
    if (role.startsWith("feature_")) {
      return `${tailFromRole(role)}Flow`;
    }
    if (role.startsWith("screen_")) {
      return `${tailFromRole(role)}Screen`;
    }
  }

  const title = String(input.title ?? "").trim();
  if (title && !HANGUL_RE.test(title)) {
    const ascii = title.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const parts = ascii.split(/\s+/).filter(Boolean);
    if (parts.length) {
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
    }
  }

  return "ScopedComponent";
}

function tailFromRole(role: CodeTaskRoleKind): string {
  if (role === "screen_input") return "Input";
  if (role === "screen_result") return "Result";
  if (role === "screen_admin") return "Admin";
  return "Screen";
}

export function resolveScreenComponentFolder(slug: string): string {
  const mapped = SCREEN_COMPONENT_FOLDER_BY_SLUG[slug];
  if (mapped) return mapped;
  const stripped = slug.replace(/Screen$/i, "").toLowerCase();
  return stripped || "screen";
}

export function resolveFeatureFolderForRole(roleKind: CodeTaskRoleKind): string {
  return FEATURE_FOLDER_BY_ROLE[roleKind] ?? "feature";
}

export function slugContainsHangul(value: string): boolean {
  return HANGUL_RE.test(value);
}
