/**
 * Harness Phase H6 — **Review / Security UI adapter**.
 *
 * `ReviewSecurityHarnessPlan` + `ReviewSecuritySummary` + `RecentReviewSecuritySummary` →
 * 사용자 표현 ViewModel. 순수 함수, read-only display.
 *
 * 사용자에게 "실제 보안 차단"/"머지 게이트" 같은 과장 표현 금지.
 * **planning / dry-run review-security metadata** 표현 유지.
 */

import type {
  RecentReviewSecuritySummary,
} from "@/lib/harness/reviewSecurity/reviewSecurityRecentSummary";
import type {
  ReviewSecurityArea,
  ReviewSecurityChecklistItem,
  ReviewSecurityFinding,
  ReviewSecurityFindingSeverity,
  ReviewSecurityHarnessPlan,
  ReviewSecuritySeverity,
  ReviewSecurityStandard,
  ReviewSecuritySummary,
} from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";
import { OVERLAY_UI_MISSING_LABEL, formatKoreanInt } from "@/lib/overlay-ui/overlayUiFormat";
import type { OverlayUiBadgeTone } from "@/lib/overlay-ui/overlayUiLabel";

/** "실제 보안 차단/머지 게이트가 아니라 검토 기준 계획"임을 노출하는 공식 안내 문구. */
export const REVIEW_SECURITY_PLAN_DISCLAIMER =
  "이 정보는 실제 보안 차단이나 머지 게이트가 아니라, 현재 역할과 단계 기준으로 어떤 검토 기준을 적용할지 보여주는 계획 정보입니다.";

const AREA_LABEL: Readonly<Record<ReviewSecurityArea, string>> = {
  requirements: "요구사항",
  architecture: "아키텍처",
  uiux: "UI/UX",
  code_quality: "코드 품질",
  security: "보안",
  privacy: "개인정보",
  deployment: "배포",
  operations: "운영",
};

const AREA_TONE: Readonly<Record<ReviewSecurityArea, OverlayUiBadgeTone>> = {
  requirements: "info",
  architecture: "info",
  uiux: "neutral",
  code_quality: "info",
  security: "warning",
  privacy: "warning",
  deployment: "neutral",
  operations: "neutral",
};

const STANDARD_LABEL: Readonly<Record<ReviewSecurityStandard, string>> = {
  jy_orchestration_baseline: "JYOrchestration 내부 기준",
  internal_quality_standard: "내부 품질 표준",
  owasp_top10: "OWASP Top 10",
  owasp_llm_top10: "OWASP Top 10 for LLM",
  owasp_asvs: "OWASP ASVS",
  mitre_cwe_top25: "MITRE CWE Top 25",
};

const SEVERITY_LABEL: Readonly<Record<ReviewSecuritySeverity, string>> = {
  info: "안내",
  warning: "주의",
  critical_candidate: "중요 후보",
};

const SEVERITY_TONE: Readonly<Record<ReviewSecuritySeverity, OverlayUiBadgeTone>> = {
  info: "info",
  warning: "warning",
  critical_candidate: "danger",
};

const FINDING_SEVERITY_LABEL: Readonly<Record<ReviewSecurityFindingSeverity, string>> = {
  info: "안내",
  warning: "주의",
};

/** raw reason → 사용자 친화적 라벨. policy id prefix를 매핑. */
const REASON_LABEL_RULES: ReadonlyArray<{
  readonly key: string;
  readonly label: string;
}> = [
  { key: "reviewer_default_requirements_coverage", label: "검수자 기본 요구사항 충족도" },
  { key: "reviewer_default_uiux_consistency", label: "검수자 기본 UI/UX 일관성" },
  { key: "reviewer_default_quality_baseline", label: "검수자 기본 품질/테스트 기준" },
  { key: "reviewer_default_flow_consistency", label: "검수자 기본 기능 흐름 정합성" },
  { key: "security_default_owasp_top10", label: "OWASP Top 10 기본 점검" },
  { key: "security_default_owasp_llm_top10", label: "OWASP Top 10 for LLM 기본 점검" },
  { key: "security_default_owasp_asvs", label: "OWASP ASVS 기본 점검" },
  { key: "security_default_mitre_cwe_top25", label: "MITRE CWE Top 25 기본 점검" },
  { key: "security_default_privacy_baseline", label: "내부 PII/민감정보 기본 점검" },
  { key: "planner_default_scope_alignment", label: "기획 기본 범위 정렬" },
  { key: "architect_default_decisions", label: "아키텍트 기본 결정 추적" },
  { key: "architect_default_env_rollback", label: "아키텍트 기본 환경/롤백 안전성" },
  { key: "code_generation_capability_present", label: "코드 생성 capability 감지로 보강" },
  { key: "security_knowledge_activation_present", label: "보안 지식팩 활성화로 보강" },
  { key: "workspace_stage_deployment", label: "배포 단계 기준으로 보강" },
  { key: "workspace_stage_operations", label: "운영 단계 기준으로 보강" },
];

export function reviewSecurityAreaLabel(area: ReviewSecurityArea): string {
  return AREA_LABEL[area] ?? area;
}

export function reviewSecurityAreaTone(area: ReviewSecurityArea): OverlayUiBadgeTone {
  return AREA_TONE[area] ?? "neutral";
}

export function reviewSecurityStandardLabel(standard: ReviewSecurityStandard): string {
  return STANDARD_LABEL[standard] ?? standard;
}

export function reviewSecuritySeverityLabel(severity: ReviewSecuritySeverity): string {
  return SEVERITY_LABEL[severity] ?? "안내";
}

export function reviewSecuritySeverityTone(severity: ReviewSecuritySeverity): OverlayUiBadgeTone {
  return SEVERITY_TONE[severity] ?? "neutral";
}

export function reviewSecurityFindingSeverityLabel(
  severity: ReviewSecurityFindingSeverity
): string {
  return FINDING_SEVERITY_LABEL[severity] ?? "안내";
}

export function reviewSecurityReasonLabel(reason: string): string {
  const trimmed = String(reason ?? "").trim();
  if (!trimmed) return "사유 미지정";
  const matched = REASON_LABEL_RULES.find((r) => r.key === trimmed);
  return matched ? matched.label : trimmed;
}

// ── VM types ──────────────────────────────────────────────────────────

export type ReviewSecurityChecklistItemVM = Readonly<{
  id: string;
  area: ReviewSecurityArea;
  areaLabel: string;
  areaTone: OverlayUiBadgeTone;
  standard: ReviewSecurityStandard;
  standardLabel: string;
  severity: ReviewSecuritySeverity;
  severityLabel: string;
  severityTone: OverlayUiBadgeTone;
  title: string;
  description: string;
  appliesToRole: string;
  reasonLabel: string;
}>;

export type ReviewSecurityFindingVM = Readonly<{
  code: string;
  severity: ReviewSecurityFindingSeverity;
  severityLabel: string;
  message: string;
}>;

export type ReviewSecurityAreaBreakdownVM = Readonly<{
  area: ReviewSecurityArea;
  areaLabel: string;
  count: number;
  countLabel: string;
}>;

export type ReviewSecurityPlanVM = Readonly<{
  hasData: boolean;
  disclaimer: string;
  roleValue: string;
  stageValue: string;
  totalLabel: string;
  criticalCandidatesLabel: string;
  /** 사용자에게 보여주는 area 그룹별 count(0인 area는 표시 안 함). */
  areaBreakdown: readonly ReviewSecurityAreaBreakdownVM[];
  /** standard 라벨 모음(중복 제거, label 정렬). */
  standardLabels: readonly string[];
  items: readonly ReviewSecurityChecklistItemVM[];
  findings: readonly ReviewSecurityFindingVM[];
}>;

// ── VM builders ───────────────────────────────────────────────────────

function toItemVM(item: ReviewSecurityChecklistItem): ReviewSecurityChecklistItemVM {
  return {
    id: item.id,
    area: item.area,
    areaLabel: reviewSecurityAreaLabel(item.area),
    areaTone: reviewSecurityAreaTone(item.area),
    standard: item.standard,
    standardLabel: reviewSecurityStandardLabel(item.standard),
    severity: item.severity,
    severityLabel: reviewSecuritySeverityLabel(item.severity),
    severityTone: reviewSecuritySeverityTone(item.severity),
    title: item.title,
    description: item.description,
    appliesToRole: item.appliesToRole,
    reasonLabel: reviewSecurityReasonLabel(item.reason),
  };
}

function toFindingVM(f: ReviewSecurityFinding): ReviewSecurityFindingVM {
  return {
    code: f.code,
    severity: f.severity,
    severityLabel: reviewSecurityFindingSeverityLabel(f.severity),
    message: f.message,
  };
}

/**
 * `ReviewSecurityHarnessPlan` → UI VM.
 *
 * - plan이 null/mode 잘못 → `hasData: false` 안전 fallback.
 */
export function buildReviewSecurityPlanVM(
  plan: ReviewSecurityHarnessPlan | null | undefined,
  summary?: ReviewSecuritySummary | null
): ReviewSecurityPlanVM {
  const safe = plan && plan.mode === "dry_run_review_security" ? plan : null;
  if (!safe) {
    return {
      hasData: false,
      disclaimer: REVIEW_SECURITY_PLAN_DISCLAIMER,
      roleValue: OVERLAY_UI_MISSING_LABEL,
      stageValue: OVERLAY_UI_MISSING_LABEL,
      totalLabel: "후보 0개",
      criticalCandidatesLabel: "중요 후보 0",
      areaBreakdown: [],
      standardLabels: [],
      items: [],
      findings: [],
    };
  }

  const breakdownMap = new Map<ReviewSecurityArea, number>();
  let criticalCandidates = 0;
  const standardSet = new Set<string>();
  for (const item of safe.checklist) {
    breakdownMap.set(item.area, (breakdownMap.get(item.area) ?? 0) + 1);
    if (item.severity === "critical_candidate") criticalCandidates += 1;
    standardSet.add(reviewSecurityStandardLabel(item.standard));
  }
  if (summary && summary.mode === "dry_run_review_security") {
    // summary가 주어지면 우선 사용(replay 일관성).
    criticalCandidates = summary.criticalCandidates;
  }

  const areaBreakdown: ReviewSecurityAreaBreakdownVM[] = Array.from(breakdownMap.entries())
    .map(([area, count]) => ({
      area,
      areaLabel: reviewSecurityAreaLabel(area),
      count,
      countLabel: `${reviewSecurityAreaLabel(area)} ${formatKoreanInt(count)}`,
    }))
    .sort((a, b) =>
      a.areaLabel < b.areaLabel ? -1 : a.areaLabel > b.areaLabel ? 1 : 0
    );

  const standardLabels = Array.from(standardSet).sort();

  return {
    hasData: safe.checklist.length > 0 || safe.findings.length > 0,
    disclaimer: REVIEW_SECURITY_PLAN_DISCLAIMER,
    roleValue: safe.roleKey?.length ? safe.roleKey : OVERLAY_UI_MISSING_LABEL,
    stageValue: safe.workspaceStage?.length ? safe.workspaceStage : OVERLAY_UI_MISSING_LABEL,
    totalLabel: `후보 ${formatKoreanInt(safe.checklist.length)}개`,
    criticalCandidatesLabel: `중요 후보 ${formatKoreanInt(criticalCandidates)}`,
    areaBreakdown,
    standardLabels,
    items: safe.checklist.map(toItemVM),
    findings: safe.findings.map(toFindingVM),
  };
}

// ── Recent trend VM ───────────────────────────────────────────────────

export type ReviewSecurityRecentTrendVM = Readonly<{
  hasData: boolean;
  sampleCountLabel: string;
  totalLabel: string;
  securityRateLabel: string;
  codeQualityRateLabel: string;
  criticalCandidateRateLabel: string;
  findingRateLabel: string;
}>;

function formatRateLabel(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  const pct = Math.round(Math.max(0, Math.min(1, rate)) * 100);
  return `${pct}%`;
}

/**
 * `RecentReviewSecuritySummary` → 사용자 표현 VM.
 *
 * - sampledEntryCount/planEntryCount/totalChecklistItems가 모두 0이면 `hasData: false`.
 * - rate는 0–1 → 0–100% 정수로 포맷.
 */
export function buildReviewSecurityRecentTrendVM(
  summary: RecentReviewSecuritySummary | null | undefined
): ReviewSecurityRecentTrendVM {
  const safe = summary ?? null;
  const hasData =
    !!safe &&
    (safe.sampledEntryCount > 0 ||
      safe.planEntryCount > 0 ||
      safe.totalChecklistItems > 0);
  return {
    hasData,
    sampleCountLabel: `샘플 ${formatKoreanInt(safe?.sampledEntryCount ?? 0)}건 · 유효 plan ${formatKoreanInt(
      safe?.planEntryCount ?? 0
    )}건`,
    totalLabel: `총 checklist ${formatKoreanInt(safe?.totalChecklistItems ?? 0)}건`,
    securityRateLabel: `보안 영역 비율 ${formatRateLabel(safe?.securityItemRate ?? 0)}`,
    codeQualityRateLabel: `코드 품질 영역 비율 ${formatRateLabel(safe?.codeQualityItemRate ?? 0)}`,
    criticalCandidateRateLabel: `중요 후보 비율 ${formatRateLabel(
      safe?.criticalCandidateRate ?? 0
    )}`,
    findingRateLabel: `진단 발생 plan ${formatRateLabel(safe?.findingRate ?? 0)}`,
  };
}
