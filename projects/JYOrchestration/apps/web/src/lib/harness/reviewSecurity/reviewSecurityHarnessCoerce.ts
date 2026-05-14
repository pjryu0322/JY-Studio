/**
 * Harness Phase H6 — **Review / Security Harness metadata coercer**.
 *
 * 저장/네트워크에서 받은 unknown raw 값을 안전하게 `ReviewSecurityHarnessPlan`으로 변환한다.
 * replay/diagnostic 호출부에서 malformed 입력이 들어와도 호출부 shape이 깨지지 않도록 한다.
 *
 * - `mode === "dry_run_review_security"`만 허용.
 * - 필수 필드 누락 row는 drop.
 * - invalid area / standard / severity → drop or fallback.
 * - checklist/findings 상한 cap.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";

import {
  REVIEW_SECURITY_AREA_KEYS,
  REVIEW_SECURITY_SEVERITY_KEYS,
  REVIEW_SECURITY_STANDARD_KEYS,
  type ReviewSecurityArea,
  type ReviewSecurityChecklistItem,
  type ReviewSecurityFinding,
  type ReviewSecurityFindingSeverity,
  type ReviewSecurityHarnessPlan,
  type ReviewSecuritySeverity,
  type ReviewSecurityStandard,
} from "./reviewSecurityHarnessTypes";

const MAX_CHECKLIST = 32;
const MAX_FINDINGS = 12;
const ID_MAX = 120;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 320;
const ROLE_MAX = 80;
const STAGE_MAX = 80;
const REASON_MAX = 120;
const FINDING_CODE_MAX = 80;
const FINDING_MESSAGE_MAX = 240;

const FINDING_SEVERITY_VALUES: readonly ReviewSecurityFindingSeverity[] = ["info", "warning"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseArea(value: unknown): ReviewSecurityArea | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REVIEW_SECURITY_AREA_KEYS as readonly string[]).includes(s)
    ? (s as ReviewSecurityArea)
    : null;
}

function parseStandard(value: unknown): ReviewSecurityStandard | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REVIEW_SECURITY_STANDARD_KEYS as readonly string[]).includes(s)
    ? (s as ReviewSecurityStandard)
    : null;
}

function parseSeverity(value: unknown): ReviewSecuritySeverity | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REVIEW_SECURITY_SEVERITY_KEYS as readonly string[]).includes(s)
    ? (s as ReviewSecuritySeverity)
    : null;
}

function parseFindingSeverity(value: unknown): ReviewSecurityFindingSeverity | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (FINDING_SEVERITY_VALUES as readonly string[]).includes(s)
    ? (s as ReviewSecurityFindingSeverity)
    : null;
}

function parseChecklistItem(value: unknown): ReviewSecurityChecklistItem | null {
  const r = asRecord(value);
  if (!r) return null;
  const id = trimAndClipString(r.id, ID_MAX);
  if (!id) return null;
  const area = parseArea(r.area);
  if (!area) return null;
  const standard = parseStandard(r.standard);
  if (!standard) return null;
  const title = trimAndClipString(r.title, TITLE_MAX);
  if (!title) return null;
  const description = trimAndClipString(r.description, DESCRIPTION_MAX);
  if (!description) return null;
  // invalid severity → fallback "info"(replay 안정성). drop은 area/standard 누락 시에만.
  const severity = parseSeverity(r.severity) ?? "info";
  const appliesToRole = trimAndClipString(r.appliesToRole, ROLE_MAX) || "unknown";
  const reason = trimAndClipString(r.reason, REASON_MAX) || "unspecified";
  return {
    id,
    area,
    standard,
    title,
    description,
    severity,
    appliesToRole,
    reason,
  };
}

function parseFinding(value: unknown): ReviewSecurityFinding | null {
  const r = asRecord(value);
  if (!r) return null;
  const code = trimAndClipString(r.code, FINDING_CODE_MAX);
  if (!code) return null;
  const severity = parseFindingSeverity(r.severity);
  if (!severity) return null;
  const message = trimAndClipString(r.message, FINDING_MESSAGE_MAX);
  if (!message) return null;
  return { code, severity, message };
}

/**
 * unknown raw → `ReviewSecurityHarnessPlan | null`.
 *
 * - `mode`는 `"dry_run_review_security"`만 허용. 그 외는 null(replay-safety).
 * - 필수 필드 누락 row는 drop. invalid severity는 `"info"` fallback.
 * - checklist/findings 상한 cap.
 */
export function parseReviewSecurityHarnessPlanFromUnknown(
  raw: unknown
): ReviewSecurityHarnessPlan | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (r.mode !== "dry_run_review_security") return null;
  const checklistRaw = Array.isArray(r.checklist) ? r.checklist : [];
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];
  const seenIds = new Set<string>();

  const checklist: ReviewSecurityChecklistItem[] = [];
  for (const item of checklistRaw) {
    const parsed = parseChecklistItem(item);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) continue;
    seenIds.add(parsed.id);
    checklist.push(parsed);
    if (checklist.length >= MAX_CHECKLIST) break;
  }
  const findings: ReviewSecurityFinding[] = [];
  for (const item of findingsRaw) {
    const parsed = parseFinding(item);
    if (parsed) findings.push(parsed);
    if (findings.length >= MAX_FINDINGS) break;
  }

  const roleKey = trimAndClipString(r.roleKey, ROLE_MAX);
  const workspaceStage = trimAndClipString(r.workspaceStage, STAGE_MAX);

  return {
    mode: "dry_run_review_security",
    roleKey: roleKey.length ? roleKey : null,
    workspaceStage: workspaceStage.length ? workspaceStage : null,
    checklist,
    findings,
  };
}

export type CoercedReviewSecurityHarnessMetadata = Readonly<{
  reviewSecurityHarnessPlan?: ReviewSecurityHarnessPlan;
}>;

/**
 * 단일 timeline row의 `reviewSecurityHarnessPlan` 필드만 안전하게 coerce.
 * `Object.assign(out, coerceReviewSecurityHarnessMetadata(row))`로 사용.
 */
export function coerceReviewSecurityHarnessMetadata(
  raw: Record<string, unknown> | null | undefined
): CoercedReviewSecurityHarnessMetadata {
  if (!raw || typeof raw !== "object") return {};
  const out: { reviewSecurityHarnessPlan?: ReviewSecurityHarnessPlan } = {};
  const parsedPlan = parseReviewSecurityHarnessPlanFromUnknown(raw.reviewSecurityHarnessPlan);
  if (parsedPlan) out.reviewSecurityHarnessPlan = parsedPlan;
  return out;
}
