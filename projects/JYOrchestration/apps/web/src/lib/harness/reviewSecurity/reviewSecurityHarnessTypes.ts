/**
 * Harness Phase H6 Preparation — **Review / Security Harness 타입**.
 *
 * **read-only / planning metadata only.** 이 타입의 어떤 값도 실제 보안 스캔·코드 리뷰 실행·
 * 이슈 등록·머지 차단·PR 게이트·remediation 자동 실행에 영향을 주지 않는다.
 *
 * 목적: "AI검수자(AI Reviewer)와 AI보안관(AI Security Auditor)이 어떤 기준으로
 * 결과물을 검토해야 하는가"를 설명 가능한 checklist planning metadata로 만든다.
 */

/** Plan mode 고정 키워드. 타입 시스템에서 `"dry_run_review_security"`만 허용. */
export type ReviewSecurityPlanMode = "dry_run_review_security";

/**
 * 검토 영역. AI검수자/AI보안관 양쪽이 사용하는 공통 분류.
 *
 * - `requirements`: 요구사항 충실도, acceptance criteria.
 * - `architecture`: 아키텍처 결정, 의존성, 책임 경계.
 * - `uiux`: UI/UX 일관성, 접근성 후보 항목.
 * - `code_quality`: 코드 품질·테스트 커버리지·정적 분석 기준.
 * - `security`: 보안 결함 후보(OWASP 등).
 * - `privacy`: 개인정보·민감정보 처리 기준.
 * - `deployment`: 배포 안전성, 롤백/환경 분리.
 * - `operations`: 관찰성·로그·운영 핸드오프.
 */
export type ReviewSecurityArea =
  | "requirements"
  | "architecture"
  | "uiux"
  | "code_quality"
  | "security"
  | "privacy"
  | "deployment"
  | "operations";

/** Checklist 항목의 severity. H5 / H4와 같은 어휘 + `critical_candidate` 후보 강조용. */
export type ReviewSecuritySeverity = "info" | "warning" | "critical_candidate";

/** 표준 카탈로그. 새 표준은 이 union을 확장하며 정책 표를 함께 갱신한다. */
export type ReviewSecurityStandard =
  | "jy_orchestration_baseline"
  | "owasp_top10"
  | "owasp_llm_top10"
  | "owasp_asvs"
  | "mitre_cwe_top25"
  | "internal_quality_standard";

/** Finding의 severity(plan-level 진단; checklist 항목과 분리). */
export type ReviewSecurityFindingSeverity = "info" | "warning";

/**
 * 단일 checklist 항목 — "이 역할이 이 표준 기준으로 이 영역을 어떤 사유로 검토해야 하는가".
 *
 * - `id`: 결정론적 키(`<area>:<standard>:<short-key>` 형태 권장). UI key·dedup에 사용.
 * - `appliesToRole`: 정규화된 역할 키(예: `reviewer` / `security`).
 * - `reason`: 사용자/감사용 사유 라벨. UI는 사용자 친화 표현으로 변환한다.
 */
export type ReviewSecurityChecklistItem = Readonly<{
  id: string;
  area: ReviewSecurityArea;
  standard: ReviewSecurityStandard;
  title: string;
  description: string;
  severity: ReviewSecuritySeverity;
  appliesToRole: string;
  reason: string;
}>;

/** Plan-level finding(전체 plan 진단). */
export type ReviewSecurityFinding = Readonly<{
  code: string;
  severity: ReviewSecurityFindingSeverity;
  message: string;
}>;

/**
 * Review/Security Harness Plan — 한 turn의 검토 계획 + 진단.
 *
 * **항상 `mode === "dry_run_review_security"`.** 실제 보안 스캔/리뷰/이슈 등록/머지 차단이 아닌
 * checklist planning metadata.
 */
export type ReviewSecurityHarnessPlan = Readonly<{
  mode: ReviewSecurityPlanMode;
  roleKey: string | null;
  workspaceStage: string | null;
  checklist: readonly ReviewSecurityChecklistItem[];
  findings: readonly ReviewSecurityFinding[];
}>;

/**
 * Diagnostic 응답용 누적 summary(단일 plan 기준).
 *
 * - 영역별 count는 UI에서 brake-down 표시.
 * - `criticalCandidates`: severity === `critical_candidate`인 항목 수.
 */
export type ReviewSecuritySummary = Readonly<{
  mode: ReviewSecurityPlanMode;
  total: number;
  requirements: number;
  architecture: number;
  uiux: number;
  codeQuality: number;
  security: number;
  privacy: number;
  deployment: number;
  operations: number;
  criticalCandidates: number;
  findingsCount: number;
}>;

/** 빈 plan(replay/empty fallback). 호출부 shape 안정화. */
export function emptyReviewSecurityHarnessPlan(): ReviewSecurityHarnessPlan {
  return {
    mode: "dry_run_review_security",
    roleKey: null,
    workspaceStage: null,
    checklist: [],
    findings: [],
  };
}

/** 빈 summary. */
export function emptyReviewSecuritySummary(): ReviewSecuritySummary {
  return {
    mode: "dry_run_review_security",
    total: 0,
    requirements: 0,
    architecture: 0,
    uiux: 0,
    codeQuality: 0,
    security: 0,
    privacy: 0,
    deployment: 0,
    operations: 0,
    criticalCandidates: 0,
    findingsCount: 0,
  };
}

/** Plan → Summary 변환(read-only). 호출부에서 일관된 형태 보장. */
export function summarizeReviewSecurityHarnessPlan(
  plan: ReviewSecurityHarnessPlan | null | undefined
): ReviewSecuritySummary {
  if (!plan || plan.mode !== "dry_run_review_security" || !Array.isArray(plan.checklist)) {
    return emptyReviewSecuritySummary();
  }
  const counts = {
    requirements: 0,
    architecture: 0,
    uiux: 0,
    codeQuality: 0,
    security: 0,
    privacy: 0,
    deployment: 0,
    operations: 0,
  };
  let criticalCandidates = 0;
  for (const item of plan.checklist) {
    if (!item) continue;
    switch (item.area) {
      case "requirements":
        counts.requirements += 1;
        break;
      case "architecture":
        counts.architecture += 1;
        break;
      case "uiux":
        counts.uiux += 1;
        break;
      case "code_quality":
        counts.codeQuality += 1;
        break;
      case "security":
        counts.security += 1;
        break;
      case "privacy":
        counts.privacy += 1;
        break;
      case "deployment":
        counts.deployment += 1;
        break;
      case "operations":
        counts.operations += 1;
        break;
      default:
        break;
    }
    if (item.severity === "critical_candidate") criticalCandidates += 1;
  }
  return {
    mode: "dry_run_review_security",
    total: plan.checklist.length,
    ...counts,
    criticalCandidates,
    findingsCount: plan.findings?.length ?? 0,
  };
}

/** 카탈로그 노출용: area 키 전체(정렬). */
export const REVIEW_SECURITY_AREA_KEYS: readonly ReviewSecurityArea[] = [
  "architecture",
  "code_quality",
  "deployment",
  "operations",
  "privacy",
  "requirements",
  "security",
  "uiux",
];

/** 카탈로그 노출용: standard 키 전체(정렬). */
export const REVIEW_SECURITY_STANDARD_KEYS: readonly ReviewSecurityStandard[] = [
  "internal_quality_standard",
  "jy_orchestration_baseline",
  "mitre_cwe_top25",
  "owasp_asvs",
  "owasp_llm_top10",
  "owasp_top10",
];

/** 카탈로그 노출용: severity 키 전체. */
export const REVIEW_SECURITY_SEVERITY_KEYS: readonly ReviewSecuritySeverity[] = [
  "info",
  "warning",
  "critical_candidate",
];
