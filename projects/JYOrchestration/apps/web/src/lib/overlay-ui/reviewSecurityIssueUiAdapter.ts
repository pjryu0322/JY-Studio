/**
 * Harness Phase H6.5 — **Review/Security Issue + Remediation Loop UI adapter**.
 *
 * `ReviewSecurityIssuePlanningReport` + `RemediationLoopPlan` + `RecentReviewSecurityIssueSummary`
 * → 사용자 표현 ViewModel. 순수 함수, read-only display.
 *
 * 사용자에게 "실제 이슈 등록"/"머지 차단" 같은 과장 표현 금지.
 * **planning / dry-run only** 표현 유지.
 */

import {
  REVIEW_SECURITY_AREA_KEYS,
  REVIEW_SECURITY_STANDARD_KEYS,
  type ReviewSecurityArea,
  type ReviewSecuritySeverity,
  type ReviewSecurityStandard,
} from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";
import {
  reviewSecurityAreaLabel,
  reviewSecurityAreaTone,
  reviewSecuritySeverityLabel,
  reviewSecuritySeverityTone,
  reviewSecurityStandardLabel,
} from "@/lib/overlay-ui/reviewSecurityUiAdapter";
import type {
  RemediationLoopPlan,
  RemediationLoopStep,
  RemediationLoopStepType,
  ReviewSecurityIssueCandidate,
  ReviewSecurityIssuePlanningFinding,
  ReviewSecurityIssuePlanningFindingSeverity,
  ReviewSecurityIssuePlanningReport,
  ReviewSecurityIssueStatus,
  ReviewSecurityRemediationActionType,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueTypes";
import type { RecentReviewSecurityIssueSummary } from "@/lib/harness/reviewSecurity/reviewSecurityIssueRecentSummary";
import {
  OVERLAY_UI_MISSING_LABEL,
  formatKoreanInt,
  formatRateLabel,
} from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** Plan disclaimer 단일 출처(H6.5 카피). */
export const REVIEW_SECURITY_ISSUE_PLAN_DISCLAIMER =
  "이 정보는 실제 이슈 등록이나 머지 차단이 아니라, 검토 결과를 어떻게 조치 후보로 정리할지 보여주는 계획 정보입니다.";

/** Remediation loop disclaimer. */
export const REMEDIATION_LOOP_DISCLAIMER =
  "이 조치 루프는 실제 task 생성·assignment·Cursor 실행·머지 차단이 아니라, 검토 → 조치 → 재점검 흐름을 보여주는 계획 정보입니다.";

// ── Label / tone tables ───────────────────────────────────────────────

const STATUS_LABEL: Readonly<Record<ReviewSecurityIssueStatus, string>> = {
  candidate: "후보",
  needs_review: "재검토 권장",
  needs_remediation: "조치 권장",
  ready_for_recheck: "재점검 대기",
};

const STATUS_TONE: Readonly<Record<ReviewSecurityIssueStatus, OverlayUiBadgeTone>> = {
  candidate: "neutral",
  needs_review: "warning",
  needs_remediation: "warning",
  ready_for_recheck: "info",
};

const ACTION_LABEL: Readonly<Record<ReviewSecurityRemediationActionType, string>> = {
  developer_fix: "AI개발자 조치",
  designer_fix: "AI디자이너 조치",
  architect_review: "AI아키텍트 재검토",
  security_recheck: "AI보안관 재점검",
  reviewer_recheck: "AI검수자 재점검",
  user_decision_required: "사용자 결정 필요",
};

const ACTION_TONE: Readonly<Record<ReviewSecurityRemediationActionType, OverlayUiBadgeTone>> = {
  developer_fix: "info",
  designer_fix: "info",
  architect_review: "info",
  security_recheck: "warning",
  reviewer_recheck: "info",
  user_decision_required: "danger",
};

const STEP_TYPE_LABEL: Readonly<Record<RemediationLoopStepType, string>> = {
  review: "검토",
  assign: "조치 후보 분배",
  fix: "조치",
  recheck: "재점검",
  final_review: "최종 검토",
};

const STEP_TYPE_TONE: Readonly<Record<RemediationLoopStepType, OverlayUiBadgeTone>> = {
  review: "info",
  assign: "neutral",
  fix: "info",
  recheck: "warning",
  final_review: "positive",
};

const FINDING_SEVERITY_LABEL: Readonly<Record<ReviewSecurityIssuePlanningFindingSeverity, string>> = {
  info: "안내",
  warning: "주의",
};

// ── Label helpers ─────────────────────────────────────────────────────

export function reviewSecurityIssueStatusLabel(status: ReviewSecurityIssueStatus): string {
  return STATUS_LABEL[status] ?? "후보";
}

export function reviewSecurityIssueStatusTone(
  status: ReviewSecurityIssueStatus
): OverlayUiBadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

export function reviewSecurityRemediationActionLabel(
  action: ReviewSecurityRemediationActionType
): string {
  return ACTION_LABEL[action] ?? "재검토 권장";
}

export function reviewSecurityRemediationActionTone(
  action: ReviewSecurityRemediationActionType
): OverlayUiBadgeTone {
  return ACTION_TONE[action] ?? "neutral";
}

export function remediationLoopStepTypeLabel(type: RemediationLoopStepType): string {
  return STEP_TYPE_LABEL[type] ?? "검토";
}

export function remediationLoopStepTypeTone(type: RemediationLoopStepType): OverlayUiBadgeTone {
  return STEP_TYPE_TONE[type] ?? "neutral";
}

export function reviewSecurityIssueFindingSeverityLabel(
  severity: ReviewSecurityIssuePlanningFindingSeverity
): string {
  return FINDING_SEVERITY_LABEL[severity] ?? "안내";
}

// ── VM types ──────────────────────────────────────────────────────────

export type ReviewSecurityIssueCandidateVM = Readonly<{
  id: string;
  sourceChecklistId: string;
  area: ReviewSecurityArea;
  areaLabel: string;
  areaTone: OverlayUiBadgeTone;
  standard: ReviewSecurityStandard;
  standardLabel: string;
  severity: ReviewSecuritySeverity;
  severityLabel: string;
  severityTone: OverlayUiBadgeTone;
  status: ReviewSecurityIssueStatus;
  statusLabel: string;
  statusTone: OverlayUiBadgeTone;
  recommendedAction: ReviewSecurityRemediationActionType;
  recommendedActionLabel: string;
  recommendedActionTone: OverlayUiBadgeTone;
  duplicateGroupKey: string;
  title: string;
  description: string;
  remediationHint: string;
}>;

export type ReviewSecurityIssueFindingVM = Readonly<{
  code: string;
  severity: ReviewSecurityIssuePlanningFindingSeverity;
  severityLabel: string;
  message: string;
}>;

export type ReviewSecurityIssueDuplicateGroupVM = Readonly<{
  key: string;
  label: string;
  count: number;
  countLabel: string;
}>;

export type ReviewSecurityIssuePlanVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  totalLabel: string;
  criticalCandidatesLabel: string;
  securityIssuesLabel: string;
  needsRemediationLabel: string;
  needsRecheckLabel: string;
  /** duplicateGroupKey별 묶음. UI 그룹 헤더 표시용. */
  duplicateGroups: readonly ReviewSecurityIssueDuplicateGroupVM[];
  issues: readonly ReviewSecurityIssueCandidateVM[];
  findings: readonly ReviewSecurityIssueFindingVM[];
}>;

export type RemediationLoopStepVM = Readonly<{
  order: number;
  orderLabel: string;
  type: RemediationLoopStepType;
  typeLabel: string;
  typeTone: OverlayUiBadgeTone;
  actorRole: string;
  description: string;
}>;

export type RemediationLoopPlanVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  totalLabel: string;
  steps: readonly RemediationLoopStepVM[];
  findings: readonly ReviewSecurityIssueFindingVM[];
}>;

export type ReviewSecurityIssueRecentTrendVM = Readonly<{
  hasData: boolean;
  sampleCountLabel: string;
  totalLabel: string;
  securityRateLabel: string;
  criticalCandidateRateLabel: string;
  needsRemediationRateLabel: string;
  findingRateLabel: string;
}>;

// ── VM builders ───────────────────────────────────────────────────────

const AREA_KEY_SET: ReadonlySet<string> = new Set(REVIEW_SECURITY_AREA_KEYS);
const STANDARD_KEY_SET: ReadonlySet<string> = new Set(REVIEW_SECURITY_STANDARD_KEYS);

function isArea(value: string): value is ReviewSecurityArea {
  return AREA_KEY_SET.has(value);
}

function isStandard(value: string): value is ReviewSecurityStandard {
  return STANDARD_KEY_SET.has(value);
}

function toIssueVM(issue: ReviewSecurityIssueCandidate): ReviewSecurityIssueCandidateVM {
  return {
    id: issue.id,
    sourceChecklistId: issue.sourceChecklistId,
    area: issue.area,
    areaLabel: reviewSecurityAreaLabel(issue.area),
    areaTone: reviewSecurityAreaTone(issue.area),
    standard: issue.standard,
    standardLabel: reviewSecurityStandardLabel(issue.standard),
    severity: issue.severity,
    severityLabel: reviewSecuritySeverityLabel(issue.severity),
    severityTone: reviewSecuritySeverityTone(issue.severity),
    status: issue.status,
    statusLabel: reviewSecurityIssueStatusLabel(issue.status),
    statusTone: reviewSecurityIssueStatusTone(issue.status),
    recommendedAction: issue.recommendedAction,
    recommendedActionLabel: reviewSecurityRemediationActionLabel(issue.recommendedAction),
    recommendedActionTone: reviewSecurityRemediationActionTone(issue.recommendedAction),
    duplicateGroupKey: issue.duplicateGroupKey,
    title: issue.title,
    description: issue.description,
    remediationHint: issue.remediationHint,
  };
}

function toFindingVM(f: ReviewSecurityIssuePlanningFinding): ReviewSecurityIssueFindingVM {
  return {
    code: f.code,
    severity: f.severity,
    severityLabel: reviewSecurityIssueFindingSeverityLabel(f.severity),
    message: f.message,
  };
}

function buildDuplicateGroups(
  issues: readonly ReviewSecurityIssueCandidate[]
): readonly ReviewSecurityIssueDuplicateGroupVM[] {
  const map = new Map<string, number>();
  for (const issue of issues) {
    const key = issue.duplicateGroupKey || `${issue.area}:${issue.standard}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({
      key,
      label: humanizeGroupKey(key),
      count,
      countLabel: formatKoreanInt(count),
    }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

function humanizeGroupKey(key: string): string {
  const trimmed = String(key ?? "").trim();
  if (!trimmed) return "기본 그룹";
  // `<area>:<standard>[:<discriminator>]` 형태 — area / standard만 한국어로 변환.
  const parts = trimmed.split(":");
  const area = parts[0]?.trim() ?? "";
  const standard = parts[1]?.trim() ?? "";
  const tail = parts.slice(2).join(":").trim();
  const areaLabel = isArea(area) ? reviewSecurityAreaLabel(area) : area || trimmed;
  const standardLabel = isStandard(standard) ? reviewSecurityStandardLabel(standard) : standard;
  if (areaLabel && standardLabel) {
    return tail ? `${areaLabel} · ${standardLabel} (${tail})` : `${areaLabel} · ${standardLabel}`;
  }
  return trimmed;
}

function emptyReviewSecurityIssuePlanVM(): ReviewSecurityIssuePlanVM {
  return {
    hasData: false,
    disclaimer: REVIEW_SECURITY_ISSUE_PLAN_DISCLAIMER,
    totalLabel: "후보 0개",
    criticalCandidatesLabel: "중요 후보 0",
    securityIssuesLabel: "보안 영역 0",
    needsRemediationLabel: "조치 권장 0",
    needsRecheckLabel: "재점검 대기 0",
    duplicateGroups: [],
    issues: [],
    findings: [],
  };
}

/**
 * `ReviewSecurityIssuePlanningReport` → UI VM.
 *
 * - report가 null/mode 잘못 → `hasData: false` 안전 fallback.
 */
export function buildReviewSecurityIssuePlanVM(
  report: ReviewSecurityIssuePlanningReport | null | undefined
): ReviewSecurityIssuePlanVM {
  const safe = report && report.mode === "dry_run_issue_planning" ? report : null;
  if (!safe) {
    return emptyReviewSecurityIssuePlanVM();
  }
  let critical = 0;
  let security = 0;
  let needsRemediation = 0;
  let needsRecheck = 0;
  for (const issue of safe.issues) {
    if (issue.severity === "critical_candidate") critical += 1;
    if (issue.area === "security") security += 1;
    if (issue.status === "needs_remediation") needsRemediation += 1;
    if (issue.status === "ready_for_recheck") needsRecheck += 1;
  }
  return {
    hasData: safe.issues.length > 0 || safe.findings.length > 0,
    disclaimer: REVIEW_SECURITY_ISSUE_PLAN_DISCLAIMER,
    totalLabel: `후보 ${formatKoreanInt(safe.issues.length)}개`,
    criticalCandidatesLabel: `중요 후보 ${formatKoreanInt(critical)}`,
    securityIssuesLabel: `보안 영역 ${formatKoreanInt(security)}`,
    needsRemediationLabel: `조치 권장 ${formatKoreanInt(needsRemediation)}`,
    needsRecheckLabel: `재점검 대기 ${formatKoreanInt(needsRecheck)}`,
    duplicateGroups: buildDuplicateGroups(safe.issues),
    issues: safe.issues.map(toIssueVM),
    findings: safe.findings.map(toFindingVM),
  };
}

function toStepVM(step: RemediationLoopStep): RemediationLoopStepVM {
  return {
    order: step.order,
    orderLabel: `${formatKoreanInt(step.order)}단계`,
    type: step.type,
    typeLabel: remediationLoopStepTypeLabel(step.type),
    typeTone: remediationLoopStepTypeTone(step.type),
    actorRole: step.actorRole?.length ? step.actorRole : OVERLAY_UI_MISSING_LABEL,
    description: step.description,
  };
}

function emptyRemediationLoopPlanVM(): RemediationLoopPlanVM {
  return {
    hasData: false,
    disclaimer: REMEDIATION_LOOP_DISCLAIMER,
    totalLabel: "단계 0개",
    steps: [],
    findings: [],
  };
}

/**
 * `RemediationLoopPlan` → UI VM.
 *
 * - plan이 null/mode 잘못 → `hasData: false` 안전 fallback.
 */
export function buildRemediationLoopPlanVM(
  plan: RemediationLoopPlan | null | undefined
): RemediationLoopPlanVM {
  const safe = plan && plan.mode === "dry_run_remediation_loop" ? plan : null;
  if (!safe) {
    return emptyRemediationLoopPlanVM();
  }
  return {
    hasData: safe.steps.length > 0 || safe.findings.length > 0,
    disclaimer: REMEDIATION_LOOP_DISCLAIMER,
    totalLabel: `단계 ${formatKoreanInt(safe.steps.length)}개`,
    steps: safe.steps.map(toStepVM),
    findings: safe.findings.map(toFindingVM),
  };
}

// ── Recent trend VM ───────────────────────────────────────────────────

function rateLabel(rate: number): string {
  return formatRateLabel(rate, 0, "0%");
}

/**
 * `RecentReviewSecurityIssueSummary` → 사용자 표현 VM.
 *
 * - sampledEntryCount/reportEntryCount/totalIssues가 모두 0이면 `hasData: false`.
 */
export function buildReviewSecurityIssueRecentTrendVM(
  summary: RecentReviewSecurityIssueSummary | null | undefined
): ReviewSecurityIssueRecentTrendVM {
  const safe = summary ?? null;
  const hasData =
    !!safe &&
    (safe.sampledEntryCount > 0 ||
      safe.reportEntryCount > 0 ||
      safe.totalIssues > 0);
  return {
    hasData,
    sampleCountLabel: `샘플 ${formatKoreanInt(safe?.sampledEntryCount ?? 0)}건 · 유효 report ${formatKoreanInt(
      safe?.reportEntryCount ?? 0
    )}건`,
    totalLabel: `총 issue ${formatKoreanInt(safe?.totalIssues ?? 0)}건`,
    securityRateLabel: `보안 영역 비율 ${rateLabel(safe?.securityIssueRate ?? 0)}`,
    criticalCandidateRateLabel: `중요 후보 비율 ${rateLabel(safe?.criticalCandidateRate ?? 0)}`,
    needsRemediationRateLabel: `조치 권장 비율 ${rateLabel(safe?.needsRemediationRate ?? 0)}`,
    findingRateLabel: `진단 발생 report ${rateLabel(safe?.findingRate ?? 0)}`,
  };
}
