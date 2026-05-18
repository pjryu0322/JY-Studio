/**
 * Harness Phase H6.5 — **Review/Security Issue + Remediation Loop metadata coercer**.
 *
 * 저장/네트워크에서 받은 unknown raw 값을 안전하게 `ReviewSecurityIssuePlanningReport` /
 * `RemediationLoopPlan`으로 변환한다. replay/diagnostic 호출부에서 malformed 입력이 들어와도
 * 호출부 shape이 깨지지 않도록 한다.
 *
 * - `mode`는 각 plan별로 `"dry_run_issue_planning"` / `"dry_run_remediation_loop"`만 허용.
 * - 필수 필드 누락 row는 drop.
 * - invalid enum 값은 drop or fallback.
 * - 상한 cap.
 */

import { trimAndClipString } from "@/lib/harness/promptAssembly/internal/harnessPromptAssemblyStrings";

import {
  REVIEW_SECURITY_AREA_KEYS,
  REVIEW_SECURITY_SEVERITY_KEYS,
  REVIEW_SECURITY_STANDARD_KEYS,
  type ReviewSecurityArea,
  type ReviewSecuritySeverity,
  type ReviewSecurityStandard,
} from "./reviewSecurityHarnessTypes";
import {
  REMEDIATION_LOOP_STEP_TYPE_KEYS,
  REVIEW_SECURITY_ISSUE_STATUS_KEYS,
  REVIEW_SECURITY_REMEDIATION_ACTION_KEYS,
  type RemediationLoopPlan,
  type RemediationLoopStep,
  type RemediationLoopStepType,
  type ReviewSecurityIssueCandidate,
  type ReviewSecurityIssuePlanningFinding,
  type ReviewSecurityIssuePlanningFindingSeverity,
  type ReviewSecurityIssuePlanningReport,
  type ReviewSecurityIssueStatus,
  type ReviewSecurityRemediationActionType,
} from "./reviewSecurityIssueTypes";

const MAX_ISSUES = 32;
const MAX_LOOP_STEPS = 12;
const MAX_FINDINGS = 12;
const ID_MAX = 120;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 320;
const HINT_MAX = 240;
const GROUP_KEY_MAX = 120;
const ACTOR_MAX = 80;
const FINDING_CODE_MAX = 80;
const FINDING_MESSAGE_MAX = 240;

const FINDING_SEVERITY_VALUES: readonly ReviewSecurityIssuePlanningFindingSeverity[] = [
  "info",
  "warning",
];

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

function parseIssueStatus(value: unknown): ReviewSecurityIssueStatus | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REVIEW_SECURITY_ISSUE_STATUS_KEYS as readonly string[]).includes(s)
    ? (s as ReviewSecurityIssueStatus)
    : null;
}

function parseActionType(value: unknown): ReviewSecurityRemediationActionType | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REVIEW_SECURITY_REMEDIATION_ACTION_KEYS as readonly string[]).includes(s)
    ? (s as ReviewSecurityRemediationActionType)
    : null;
}

function parseLoopStepType(value: unknown): RemediationLoopStepType | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (REMEDIATION_LOOP_STEP_TYPE_KEYS as readonly string[]).includes(s)
    ? (s as RemediationLoopStepType)
    : null;
}

function parseFindingSeverity(
  value: unknown
): ReviewSecurityIssuePlanningFindingSeverity | null {
  const s = typeof value === "string" ? value.trim() : "";
  return (FINDING_SEVERITY_VALUES as readonly string[]).includes(s)
    ? (s as ReviewSecurityIssuePlanningFindingSeverity)
    : null;
}

function parseFinding(value: unknown): ReviewSecurityIssuePlanningFinding | null {
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

function parseIssueCandidate(value: unknown): ReviewSecurityIssueCandidate | null {
  const r = asRecord(value);
  if (!r) return null;
  const id = trimAndClipString(r.id, ID_MAX);
  if (!id) return null;
  const sourceChecklistId = trimAndClipString(r.sourceChecklistId, ID_MAX);
  if (!sourceChecklistId) return null;
  const area = parseArea(r.area);
  if (!area) return null;
  const standard = parseStandard(r.standard);
  if (!standard) return null;
  const title = trimAndClipString(r.title, TITLE_MAX);
  if (!title) return null;
  const description = trimAndClipString(r.description, DESCRIPTION_MAX);
  if (!description) return null;
  // invalid severity / status / action → fallback(replay 안정성).
  const severity = parseSeverity(r.severity) ?? "info";
  const status = parseIssueStatus(r.status) ?? "candidate";
  const recommendedAction =
    parseActionType(r.recommendedAction) ?? "reviewer_recheck";
  const remediationHint = trimAndClipString(r.remediationHint, HINT_MAX) || "재검토 권장";
  const duplicateGroupKey =
    trimAndClipString(r.duplicateGroupKey, GROUP_KEY_MAX) || `${area}:${standard}`;
  return {
    id,
    sourceChecklistId,
    area,
    standard,
    severity,
    status,
    title,
    description,
    remediationHint,
    recommendedAction,
    duplicateGroupKey,
  };
}

function parseLoopStep(value: unknown): RemediationLoopStep | null {
  const r = asRecord(value);
  if (!r) return null;
  const type = parseLoopStepType(r.type);
  if (!type) return null;
  const description = trimAndClipString(r.description, DESCRIPTION_MAX);
  if (!description) return null;
  const actorRole = trimAndClipString(r.actorRole, ACTOR_MAX) || "reviewer";
  const orderRaw = typeof r.order === "number" && Number.isFinite(r.order) ? r.order : 0;
  const order = Math.max(0, Math.floor(orderRaw));
  return { order, type, actorRole, description };
}

/**
 * unknown raw → `ReviewSecurityIssuePlanningReport | null`.
 *
 * - `mode === "dry_run_issue_planning"`만 허용. 그 외 null(replay-safety).
 * - 필수 필드 누락 row는 drop. invalid severity/status/action → 보수적 fallback.
 * - issues/findings 상한 cap. id 중복 drop.
 */
export function parseReviewSecurityIssuePlanningReportFromUnknown(
  raw: unknown
): ReviewSecurityIssuePlanningReport | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (r.mode !== "dry_run_issue_planning") return null;
  const issuesRaw = Array.isArray(r.issues) ? r.issues : [];
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];
  const seen = new Set<string>();

  const issues: ReviewSecurityIssueCandidate[] = [];
  for (const item of issuesRaw) {
    const parsed = parseIssueCandidate(item);
    if (!parsed) continue;
    if (seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    issues.push(parsed);
    if (issues.length >= MAX_ISSUES) break;
  }

  const findings: ReviewSecurityIssuePlanningFinding[] = [];
  for (const item of findingsRaw) {
    const parsed = parseFinding(item);
    if (parsed) findings.push(parsed);
    if (findings.length >= MAX_FINDINGS) break;
  }

  return {
    mode: "dry_run_issue_planning",
    issues,
    findings,
  };
}

/**
 * unknown raw → `RemediationLoopPlan | null`.
 *
 * - `mode === "dry_run_remediation_loop"`만 허용. 그 외 null.
 * - 필수 필드(type/description) 누락 row는 drop. order는 0 이상 정수 fallback.
 * - steps/findings 상한 cap.
 */
export function parseRemediationLoopPlanFromUnknown(
  raw: unknown
): RemediationLoopPlan | null {
  const r = asRecord(raw);
  if (!r) return null;
  if (r.mode !== "dry_run_remediation_loop") return null;
  const stepsRaw = Array.isArray(r.steps) ? r.steps : [];
  const findingsRaw = Array.isArray(r.findings) ? r.findings : [];

  const steps: RemediationLoopStep[] = [];
  for (const item of stepsRaw) {
    const parsed = parseLoopStep(item);
    if (parsed) steps.push(parsed);
    if (steps.length >= MAX_LOOP_STEPS) break;
  }

  const findings: ReviewSecurityIssuePlanningFinding[] = [];
  for (const item of findingsRaw) {
    const parsed = parseFinding(item);
    if (parsed) findings.push(parsed);
    if (findings.length >= MAX_FINDINGS) break;
  }

  return {
    mode: "dry_run_remediation_loop",
    steps,
    findings,
  };
}

export type CoercedReviewSecurityIssuePlanningMetadata = Readonly<{
  reviewSecurityIssuePlanningReport?: ReviewSecurityIssuePlanningReport;
  remediationLoopPlan?: RemediationLoopPlan;
}>;

/**
 * 단일 timeline row의 `reviewSecurityIssuePlanningReport` / `remediationLoopPlan` 필드만 안전하게 coerce.
 * `Object.assign(out, coerceReviewSecurityIssuePlanningMetadata(row))`로 사용.
 */
export function coerceReviewSecurityIssuePlanningMetadata(
  raw: Record<string, unknown> | null | undefined
): CoercedReviewSecurityIssuePlanningMetadata {
  if (!raw || typeof raw !== "object") return {};
  const out: {
    reviewSecurityIssuePlanningReport?: ReviewSecurityIssuePlanningReport;
    remediationLoopPlan?: RemediationLoopPlan;
  } = {};
  const parsedReport = parseReviewSecurityIssuePlanningReportFromUnknown(
    raw.reviewSecurityIssuePlanningReport
  );
  if (parsedReport) out.reviewSecurityIssuePlanningReport = parsedReport;
  const parsedLoop = parseRemediationLoopPlanFromUnknown(raw.remediationLoopPlan);
  if (parsedLoop) out.remediationLoopPlan = parsedLoop;
  return out;
}
