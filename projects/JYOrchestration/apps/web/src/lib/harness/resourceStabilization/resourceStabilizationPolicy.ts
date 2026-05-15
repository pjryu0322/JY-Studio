/**
 * H9.5 — Resource stabilization **정책 상수**(read-only, enforcement 없음).
 */

/** Explainability 패널에 보이는 요약 줄 상한(사용자 노출 정책과 정렬). */
export const RESOURCE_STABILIZATION_MAX_EXPLAINABILITY_SUMMARY_LINES = 4;

/** 좁은 화면에서 badge pill 상한(H8.5 기본 3보다 보수적). */
export const RESOURCE_STABILIZATION_MAX_EXPLAINABILITY_BADGES_COMPACT = 2;
export const RESOURCE_STABILIZATION_MAX_EXPLAINABILITY_BADGES_DEFAULT = 3;

/** `pressureSeverity` 산출용 composite 점수 구간. */
export const RESOURCE_PRESSURE_SEVERITY_STABLE_MAX = 28;
export const RESOURCE_PRESSURE_SEVERITY_ELEVATED_MAX = 52;
export const RESOURCE_PRESSURE_SEVERITY_HIGH_MAX = 78;

export type ResourcePressureSeverity = "stable" | "elevated" | "high" | "critical";
