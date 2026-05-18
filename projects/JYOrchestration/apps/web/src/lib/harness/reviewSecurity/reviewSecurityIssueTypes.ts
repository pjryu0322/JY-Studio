/**
 * Harness Phase H6.5 — **Review / Security Issue + Remediation Loop 타입**.
 *
 * **read-only / planning metadata only.** 이 타입의 어떤 값도 실제 이슈 등록·조치 실행·
 * 재점검 실행·Cursor execution·머지 차단·PR 게이트에 영향을 주지 않는다.
 *
 * 목적: H6 checklist에서 도출된 "조치 가능한 이슈 후보(issue candidate)"와 그것을 어떻게
 * 처리할지 보여주는 "조치 루프 계획(remediation loop plan)"을 metadata로 구조화한다.
 */

import type {
  ReviewSecurityArea,
  ReviewSecuritySeverity,
  ReviewSecurityStandard,
} from "./reviewSecurityHarnessTypes";

// ── Mode keys (타입 시스템에서 고정) ─────────────────────────────────────

/** Issue planning report mode. 항상 `"dry_run_issue_planning"`. */
export type ReviewSecurityIssuePlanMode = "dry_run_issue_planning";

/** Remediation loop plan mode. 항상 `"dry_run_remediation_loop"`. */
export type RemediationLoopPlanMode = "dry_run_remediation_loop";

// ── 이슈 상태 / 조치 유형 / loop step 유형 ────────────────────────────────

/**
 * Issue candidate 상태.
 *
 * - `candidate`: H6 checklist에서 도출된 일반 후보(아직 조치 권고 단계 아님).
 * - `needs_review`: AI검수자·AI보안관 재검토가 권장되는 후보.
 * - `needs_remediation`: AI개발자/디자이너 등 조치 후보 필요.
 * - `ready_for_recheck`: 조치 후 재점검 권고 상태(미래용; replay 호환).
 */
export type ReviewSecurityIssueStatus =
  | "candidate"
  | "needs_review"
  | "needs_remediation"
  | "ready_for_recheck";

/** 권장 조치 유형(actor 역할 매핑 단일 출처). */
export type ReviewSecurityRemediationActionType =
  | "developer_fix"
  | "designer_fix"
  | "architect_review"
  | "security_recheck"
  | "reviewer_recheck"
  | "user_decision_required";

/** Loop step 분류. */
export type RemediationLoopStepType =
  | "review"
  | "assign"
  | "fix"
  | "recheck"
  | "final_review";

/** Plan-level finding severity(이슈 plan 자체 진단). */
export type ReviewSecurityIssuePlanningFindingSeverity = "info" | "warning";

// ── 핵심 타입 ───────────────────────────────────────────────────────────

/**
 * 단일 issue candidate. H6 checklist 1건 또는 H5.5/H4 결과에서 파생된 1건.
 *
 * - `id`: 결정론 키. UI dedupe·정렬용.
 * - `sourceChecklistId`: 매핑된 H6 checklist id(또는 synthetic synthesized id).
 * - `recommendedAction`: 권장 조치 유형.
 * - `duplicateGroupKey`: 중복 그룹 키(`<area>:<standard>` 형태 권장). UI에서 묶음 표시.
 */
export type ReviewSecurityIssueCandidate = Readonly<{
  id: string;
  sourceChecklistId: string;
  area: ReviewSecurityArea;
  standard: ReviewSecurityStandard;
  severity: ReviewSecuritySeverity;
  status: ReviewSecurityIssueStatus;
  title: string;
  description: string;
  remediationHint: string;
  recommendedAction: ReviewSecurityRemediationActionType;
  duplicateGroupKey: string;
}>;

/** Plan-level finding(전체 report 진단). */
export type ReviewSecurityIssuePlanningFinding = Readonly<{
  code: string;
  severity: ReviewSecurityIssuePlanningFindingSeverity;
  message: string;
}>;

/**
 * Issue planning report — 한 turn의 issue candidate 목록 + 진단.
 *
 * **항상 `mode === "dry_run_issue_planning"`.** 실제 이슈 등록·머지 차단·조치 실행이 아닌
 * planning metadata.
 */
export type ReviewSecurityIssuePlanningReport = Readonly<{
  mode: ReviewSecurityIssuePlanMode;
  issues: readonly ReviewSecurityIssueCandidate[];
  findings: readonly ReviewSecurityIssuePlanningFinding[];
}>;

/** Remediation loop의 단일 step. */
export type RemediationLoopStep = Readonly<{
  order: number;
  type: RemediationLoopStepType;
  actorRole: string;
  description: string;
}>;

/**
 * Remediation loop plan — issue들을 어떤 순서로 어떤 actor가 다루는지 설명한다.
 *
 * **항상 `mode === "dry_run_remediation_loop"`.** 실제 task 생성·assignment·Cursor 실행 없음.
 */
export type RemediationLoopPlan = Readonly<{
  mode: RemediationLoopPlanMode;
  steps: readonly RemediationLoopStep[];
  findings: readonly ReviewSecurityIssuePlanningFinding[];
}>;

// ── Summary 타입 ────────────────────────────────────────────────────────

/** Diagnostic API 응답용 누적 summary(단일 report 기준). */
export type ReviewSecurityIssuePlanningSummary = Readonly<{
  mode: ReviewSecurityIssuePlanMode;
  total: number;
  securityIssues: number;
  codeQualityIssues: number;
  criticalCandidates: number;
  needsRemediation: number;
  needsRecheck: number;
  findingsCount: number;
}>;

/** Diagnostic API 응답용 remediation loop summary(단일 plan 기준). */
export type RemediationLoopSummary = Readonly<{
  mode: RemediationLoopPlanMode;
  totalSteps: number;
  reviewSteps: number;
  assignSteps: number;
  fixSteps: number;
  recheckSteps: number;
  finalReviewSteps: number;
  findingsCount: number;
}>;

// ── empty / summarize helpers ───────────────────────────────────────────

export function emptyReviewSecurityIssuePlanningReport(): ReviewSecurityIssuePlanningReport {
  return {
    mode: "dry_run_issue_planning",
    issues: [],
    findings: [],
  };
}

export function emptyRemediationLoopPlan(): RemediationLoopPlan {
  return {
    mode: "dry_run_remediation_loop",
    steps: [],
    findings: [],
  };
}

export function emptyReviewSecurityIssuePlanningSummary(): ReviewSecurityIssuePlanningSummary {
  return {
    mode: "dry_run_issue_planning",
    total: 0,
    securityIssues: 0,
    codeQualityIssues: 0,
    criticalCandidates: 0,
    needsRemediation: 0,
    needsRecheck: 0,
    findingsCount: 0,
  };
}

export function emptyRemediationLoopSummary(): RemediationLoopSummary {
  return {
    mode: "dry_run_remediation_loop",
    totalSteps: 0,
    reviewSteps: 0,
    assignSteps: 0,
    fixSteps: 0,
    recheckSteps: 0,
    finalReviewSteps: 0,
    findingsCount: 0,
  };
}

/** Report → Summary 변환(read-only). */
export function summarizeReviewSecurityIssuePlanningReport(
  report: ReviewSecurityIssuePlanningReport | null | undefined
): ReviewSecurityIssuePlanningSummary {
  if (
    !report ||
    report.mode !== "dry_run_issue_planning" ||
    !Array.isArray(report.issues)
  ) {
    return emptyReviewSecurityIssuePlanningSummary();
  }
  let securityIssues = 0;
  let codeQualityIssues = 0;
  let criticalCandidates = 0;
  let needsRemediation = 0;
  let needsRecheck = 0;
  for (const issue of report.issues) {
    if (!issue) continue;
    if (issue.area === "security") securityIssues += 1;
    if (issue.area === "code_quality") codeQualityIssues += 1;
    if (issue.severity === "critical_candidate") criticalCandidates += 1;
    if (issue.status === "needs_remediation") needsRemediation += 1;
    if (issue.status === "ready_for_recheck") needsRecheck += 1;
  }
  return {
    mode: "dry_run_issue_planning",
    total: report.issues.length,
    securityIssues,
    codeQualityIssues,
    criticalCandidates,
    needsRemediation,
    needsRecheck,
    findingsCount: report.findings?.length ?? 0,
  };
}

/** Loop plan → Summary 변환(read-only). */
export function summarizeRemediationLoopPlan(
  plan: RemediationLoopPlan | null | undefined
): RemediationLoopSummary {
  if (
    !plan ||
    plan.mode !== "dry_run_remediation_loop" ||
    !Array.isArray(plan.steps)
  ) {
    return emptyRemediationLoopSummary();
  }
  let reviewSteps = 0;
  let assignSteps = 0;
  let fixSteps = 0;
  let recheckSteps = 0;
  let finalReviewSteps = 0;
  for (const step of plan.steps) {
    if (!step) continue;
    switch (step.type) {
      case "review":
        reviewSteps += 1;
        break;
      case "assign":
        assignSteps += 1;
        break;
      case "fix":
        fixSteps += 1;
        break;
      case "recheck":
        recheckSteps += 1;
        break;
      case "final_review":
        finalReviewSteps += 1;
        break;
      default:
        break;
    }
  }
  return {
    mode: "dry_run_remediation_loop",
    totalSteps: plan.steps.length,
    reviewSteps,
    assignSteps,
    fixSteps,
    recheckSteps,
    finalReviewSteps,
    findingsCount: plan.findings?.length ?? 0,
  };
}

// ── 카탈로그 노출용 키(coerce/UI에서 단일 출처) ──────────────────────────

export const REVIEW_SECURITY_ISSUE_STATUS_KEYS: readonly ReviewSecurityIssueStatus[] = [
  "candidate",
  "needs_review",
  "needs_remediation",
  "ready_for_recheck",
];

export const REVIEW_SECURITY_REMEDIATION_ACTION_KEYS: readonly ReviewSecurityRemediationActionType[] = [
  "developer_fix",
  "designer_fix",
  "architect_review",
  "security_recheck",
  "reviewer_recheck",
  "user_decision_required",
];

export const REMEDIATION_LOOP_STEP_TYPE_KEYS: readonly RemediationLoopStepType[] = [
  "review",
  "assign",
  "fix",
  "recheck",
  "final_review",
];
