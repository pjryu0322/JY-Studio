/**
 * Harness Phase H6 — **Review / Security Standard Policy**.
 *
 * "어떤 역할 / 어떤 단계 / 어떤 capability / 어떤 지식팩이 어떤 영역(area) × 표준(standard) ×
 * severity의 checklist 항목 후보를 갖는가"를 단일 출처에서 관리한다.
 *
 * **read-only / planning hint only.** 실제 보안 스캔·코드 리뷰·이슈 등록·머지 차단과 무관.
 */

import type {
  ReviewSecurityArea,
  ReviewSecurityChecklistItem,
  ReviewSecurityStandard,
  ReviewSecuritySeverity,
} from "./reviewSecurityHarnessTypes";

/**
 * 역할 키 정규화. `AI_REVIEWER`/`ai-Security`/`auditor` 등을 단일 키로 매핑.
 * **lookup용으로만 사용** — 외부 payload 변형 아님.
 */
export function normalizeReviewSecurityRoleKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^ai[\s_:-]?/u, "")
    .replace(/[\s\-:_/.]+/g, "_");
}

/**
 * Policy item 정의(역할별).
 *
 * 각 항목은 `buildReviewSecurityHarnessPlan`이 그대로 `ReviewSecurityChecklistItem`을 만들 수
 * 있도록 모든 필드를 포함한다. `id`는 `<area>:<standard>:<short-key>` 형태(결정론적).
 */
type ReviewSecurityPolicyItem = Omit<ReviewSecurityChecklistItem, "appliesToRole">;

/** 카탈로그 키 노출용(역할). 결정 정렬은 정책 표 그대로. */
export const REVIEW_SECURITY_ROLE_KEYS = ["reviewer", "security", "planner", "architect"] as const;

/**
 * 역할별 표준 checklist 후보 표.
 *
 * - `reviewer` — AI검수자(요구사항·기능 흐름·UI/UX·품질·acceptance criteria).
 * - `security` — AI보안관(OWASP / LLM / ASVS / CWE / 내부 보안 기준).
 * - `planner` / `architect` — 상위 단계에서의 가벼운 안내(planning consistency / 아키텍처 결정).
 */
export const REVIEW_SECURITY_ROLE_POLICY: Readonly<
  Record<string, readonly ReviewSecurityPolicyItem[]>
> = {
  reviewer: [
    {
      id: "requirements:internal_quality_standard:coverage",
      area: "requirements",
      standard: "internal_quality_standard",
      title: "요구사항 충족도 점검",
      description: "결과물이 사용자 요구사항/스토리/acceptance criteria를 충족하는지 확인합니다.",
      severity: "warning",
      reason: "reviewer_default_requirements_coverage",
    },
    {
      id: "uiux:internal_quality_standard:consistency",
      area: "uiux",
      standard: "internal_quality_standard",
      title: "UI/UX 일관성 점검",
      description: "기존 화면/플로우와 일관된 톤·용어·동작인지 확인합니다.",
      severity: "info",
      reason: "reviewer_default_uiux_consistency",
    },
    {
      id: "code_quality:internal_quality_standard:test_coverage",
      area: "code_quality",
      standard: "internal_quality_standard",
      title: "테스트/품질 기준 점검",
      description: "단위 테스트·경계 케이스·핵심 시나리오가 검증되었는지 확인합니다.",
      severity: "warning",
      reason: "reviewer_default_quality_baseline",
    },
    {
      id: "architecture:jy_orchestration_baseline:flow_consistency",
      area: "architecture",
      standard: "jy_orchestration_baseline",
      title: "기능 흐름 정합성",
      description: "기능 흐름이 기존 Stage/Workspace 모델과 충돌하지 않는지 확인합니다.",
      severity: "info",
      reason: "reviewer_default_flow_consistency",
    },
  ],
  security: [
    {
      id: "security:owasp_top10:input_validation",
      area: "security",
      standard: "owasp_top10",
      title: "입력 검증 / Injection 노출 점검",
      description: "OWASP Top 10 기준으로 입력 검증·Injection·인증/인가 후보 결함을 점검합니다.",
      severity: "critical_candidate",
      reason: "security_default_owasp_top10",
    },
    {
      id: "security:owasp_llm_top10:prompt_injection",
      area: "security",
      standard: "owasp_llm_top10",
      title: "LLM 프롬프트 안전성 점검",
      description: "OWASP Top 10 for LLM Applications 기준으로 프롬프트 인젝션·데이터 누출 가능성을 점검합니다.",
      severity: "warning",
      reason: "security_default_owasp_llm_top10",
    },
    {
      id: "security:owasp_asvs:authn_session",
      area: "security",
      standard: "owasp_asvs",
      title: "인증/세션 ASVS 기준 점검",
      description: "OWASP ASVS 기준으로 인증·세션·접근 통제 후보 항목을 점검합니다.",
      severity: "warning",
      reason: "security_default_owasp_asvs",
    },
    {
      id: "security:mitre_cwe_top25:dangerous_patterns",
      area: "security",
      standard: "mitre_cwe_top25",
      title: "위험 패턴(CWE Top 25) 점검",
      description: "MITRE CWE Top 25 기준으로 흔히 발생하는 위험 패턴 후보를 점검합니다.",
      severity: "warning",
      reason: "security_default_mitre_cwe_top25",
    },
    {
      id: "privacy:jy_orchestration_baseline:pii_handling",
      area: "privacy",
      standard: "jy_orchestration_baseline",
      title: "개인정보/민감정보 처리 점검",
      description: "내부 가이드 기준으로 PII·민감정보 노출/저장 경로 후보를 점검합니다.",
      severity: "warning",
      reason: "security_default_privacy_baseline",
    },
  ],
  planner: [
    {
      id: "requirements:jy_orchestration_baseline:scope_alignment",
      area: "requirements",
      standard: "jy_orchestration_baseline",
      title: "범위/목표 정렬 점검",
      description: "이번 단계 목표·deliverable이 사용자 요구사항과 정렬되는지 가볍게 확인합니다.",
      severity: "info",
      reason: "planner_default_scope_alignment",
    },
  ],
  architect: [
    {
      id: "architecture:internal_quality_standard:decisions",
      area: "architecture",
      standard: "internal_quality_standard",
      title: "아키텍처 결정 점검",
      description: "주요 결정(의존성·경계·storage)이 추적 가능한 형태로 남아 있는지 확인합니다.",
      severity: "info",
      reason: "architect_default_decisions",
    },
    {
      id: "deployment:jy_orchestration_baseline:env_rollback",
      area: "deployment",
      standard: "jy_orchestration_baseline",
      title: "환경/롤백 안전성 점검",
      description: "변경이 환경 분리·롤백 안전성을 해치지 않는지 확인합니다.",
      severity: "info",
      reason: "architect_default_env_rollback",
    },
  ],
};

/** code_generation / cursor_execution capability가 있을 때 추가되는 강제 보강 항목. */
export const REVIEW_SECURITY_CODE_CAPABILITY_BOOSTERS: readonly ReviewSecurityPolicyItem[] = [
  {
    id: "code_quality:internal_quality_standard:static_review",
    area: "code_quality",
    standard: "internal_quality_standard",
    title: "코드 생성물 정적 점검",
    description: "코드 생성/Cursor 실행 결과물에 대한 정적 점검(린트·타입·테스트)이 끝났는지 확인합니다.",
    severity: "warning",
    reason: "code_generation_capability_present",
  },
  {
    id: "security:owasp_top10:code_diff_review",
    area: "security",
    standard: "owasp_top10",
    title: "코드 변경 보안 검토",
    description: "코드 변경 영역에 대한 보안 영향(권한·입력·외부 호출) 검토가 필요합니다.",
    severity: "critical_candidate",
    reason: "code_generation_capability_present",
  },
];

/** workspaceStage 기반 보강 항목(stage 키워드 부분 일치). */
export const REVIEW_SECURITY_STAGE_BOOSTERS: ReadonlyArray<{
  readonly stageMatcher: (stage: string) => boolean;
  readonly item: ReviewSecurityPolicyItem;
}> = [
  {
    stageMatcher: (s) => /deploy|release|prod/.test(s),
    item: {
      id: "deployment:jy_orchestration_baseline:release_safety",
      area: "deployment",
      standard: "jy_orchestration_baseline",
      title: "배포/릴리스 안전성 점검",
      description: "배포 단계에서 롤백·환경 분리·모니터링 준비 상태를 확인합니다.",
      severity: "warning",
      reason: "workspace_stage_deployment",
    },
  },
  {
    stageMatcher: (s) => /ops|operation|maint/.test(s),
    item: {
      id: "operations:jy_orchestration_baseline:observability",
      area: "operations",
      standard: "jy_orchestration_baseline",
      title: "관찰성/운영 핸드오프 점검",
      description: "로그·지표·핸드오프 문서가 운영 단계에 충분한지 확인합니다.",
      severity: "info",
      reason: "workspace_stage_operations",
    },
  },
];

/** 보안 지식팩 후보가 활성화되었을 때 추가되는 보강 항목. */
export const REVIEW_SECURITY_SECURITY_KNOWLEDGE_BOOSTERS: readonly ReviewSecurityPolicyItem[] = [
  {
    id: "security:owasp_llm_top10:prompt_handling_review",
    area: "security",
    standard: "owasp_llm_top10",
    title: "LLM 프롬프트 처리 보안 점검(지식팩 보강)",
    description: "활성화된 보안 지식팩 기준으로 프롬프트 처리·민감 컨텍스트 노출 가능성을 점검합니다.",
    severity: "warning",
    reason: "security_knowledge_activation_present",
  },
];

/** 카탈로그용: 역할 키 정책 해상도. 실패 시 빈 배열. */
export function resolveReviewSecurityRolePolicy(
  roleKey: string | null | undefined
): readonly ReviewSecurityPolicyItem[] {
  const normalized = normalizeReviewSecurityRoleKey(roleKey);
  if (!normalized) return [];
  return REVIEW_SECURITY_ROLE_POLICY[normalized] ?? [];
}

/** Severity → 강조도(높을수록 critical). UI/정렬에 사용. */
export function reviewSecuritySeverityRank(severity: ReviewSecuritySeverity): number {
  switch (severity) {
    case "critical_candidate":
      return 2;
    case "warning":
      return 1;
    default:
      return 0;
  }
}

/** Area → 표시 순서(고정). UI 정렬을 단일 출처에서 관리. */
export const REVIEW_SECURITY_AREA_ORDER: readonly ReviewSecurityArea[] = [
  "requirements",
  "architecture",
  "uiux",
  "code_quality",
  "security",
  "privacy",
  "deployment",
  "operations",
];

/** Standard → 표시 순서(고정). */
export const REVIEW_SECURITY_STANDARD_ORDER: readonly ReviewSecurityStandard[] = [
  "jy_orchestration_baseline",
  "internal_quality_standard",
  "owasp_top10",
  "owasp_llm_top10",
  "owasp_asvs",
  "mitre_cwe_top25",
];
