/**
 * Harness Phase H2 — **Apply-readiness Preparation** 타입.
 *
 * **read-only / 진단 metadata only.** 이 타입의 어떤 값도 실제 prompt payload, LLM 호출,
 * retrieval, provider, Cursor execution, GitHub PR/merge에 영향을 주지 않는다.
 *
 * Apply-readiness는 "Harness preview가 실제 적용 가능한 후보 수준인지" 판단하기 위한
 * 누적 진단이다. enforcement가 아니라 **후보 판단**이며, 적용 결정은 항상 수동/별도이다.
 */

/**
 * Apply-readiness 레벨:
 * - `not_ready`: 샘플 부족 또는 누락/위험/경고가 임계치 이상 — 적용 검토 보류.
 * - `watch`: 일부 지표가 관찰 임계를 초과 — 추가 관찰 권장.
 * - `ready_candidate`: 모든 지표가 안정 임계 이내 — **적용 후보**(자동 적용 아님).
 */
export type HarnessPromptApplyReadinessLevel = "not_ready" | "watch" | "ready_candidate";

/**
 * 단일 진단 발견 항목.
 *
 * - `severity`는 `"info" | "warning"`만 허용한다(이 단계에서 error/block 없음 — 모두 진단).
 * - `code`는 안정적인 식별자(예: `missing_section_rate_high`).
 */
export type HarnessPromptApplyReadinessFinding = Readonly<{
  code: string;
  severity: "info" | "warning";
  message: string;
}>;

/**
 * Apply-readiness 종합 리포트.
 *
 * 항상 `mode === "dry_run_readiness"`. 적용이 아니라 진단이다.
 */
export type HarnessPromptApplyReadinessReport = Readonly<{
  mode: "dry_run_readiness";
  level: HarnessPromptApplyReadinessLevel;
  /** 평가에 사용된 timeline entry 수(샘플링 후). */
  sampledEntryCount: number;
  /** 샘플 중 `harnessPromptAssemblyPreview`가 있는 entry 수. */
  previewEntryCount: number;
  /** 0 ≤ rate ≤ 1. preview 가진 entry 중 missing section이 ≥ 1개인 비율. */
  missingSectionRate: number;
  /** 0 ≤ rate ≤ 1. preview 가진 entry 중 overflowRisk가 `"high"`인 비율. */
  highOverflowRiskRate: number;
  /** 0 ≤ rate ≤ 1. preview 가진 entry 중 warnings.length ≥ 1인 비율. */
  warningRate: number;
  /** 샘플 entries의 기존 prompt 길이 평균(소수점 버림). */
  averageExistingPromptLength: number;
  /** 샘플 entries의 preview 길이 평균(소수점 버림). */
  averagePreviewLength: number;
  findings: readonly HarnessPromptApplyReadinessFinding[];
}>;

/** 빈/안전한 fallback report. 데이터가 없을 때 호출부가 동일 shape으로 처리할 수 있게 한다. */
export function emptyHarnessPromptApplyReadinessReport(): HarnessPromptApplyReadinessReport {
  return {
    mode: "dry_run_readiness",
    level: "not_ready",
    sampledEntryCount: 0,
    previewEntryCount: 0,
    missingSectionRate: 0,
    highOverflowRiskRate: 0,
    warningRate: 0,
    averageExistingPromptLength: 0,
    averagePreviewLength: 0,
    findings: [],
  };
}
