/**
 * Harness Phase H5 — **Role-aware Execution Routing Policy**.
 *
 * "역할별로 어떤 실행 capability를 가질 수 있는가"의 단일 출처.
 * **read-only / planning metadata only.** 실제 provider switching / Cursor execution / GitHub
 * operation에 영향을 주지 않는다.
 */

import type { ExecutionCapability } from "./executionCapabilityTypes";

/**
 * 역할 키 정규화. `AI_PLANNER`/`ai-Architect`/`planner` 등 다양한 형태를 단일 키로 매핑한다.
 * **lookup용으로만 사용** — 외부 payload는 그대로.
 */
export function normalizeExecutionRoutingRoleKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^ai[\s_:-]?/u, "")
    .replace(/[\s\-:_/.]+/g, "_");
}

/**
 * 역할별 capability 정책 표(모두 **planning 후보**).
 *
 * - 정렬은 capability key asc — `buildExecutionRoutingPlan`의 결정론 정렬을 단순화.
 * - 같은 capability가 여러 역할에서 등장할 수 있다(planning은 planner / analyst 공통 등).
 */
export const EXECUTION_ROUTING_ROLE_POLICY: Readonly<Record<string, readonly ExecutionCapability[]>> = {
  planner: ["analysis", "planning"],
  architect: ["architecture_review", "design_review"],
  developer: ["code_generation", "cursor_execution"],
  security: ["security_review"],
  reviewer: ["code_review", "quality_review"],
  analyst: ["analysis"],
  designer: ["design_review"],
};

/** 매칭 실패 시 fallback 정책(전체 미지원; 사용자에게는 finding으로 noticed). */
export const EXECUTION_ROUTING_DEFAULT_POLICY: readonly ExecutionCapability[] = [];

/**
 * 역할 키 → capability 정책 해상도.
 *
 * - lookup 실패 시 default 정책(빈 배열)을 반환한다.
 * - 결과는 readonly이며, 같은 입력에 같은 reference를 반환한다(결정론).
 */
export function resolveExecutionRoutingRolePolicy(
  roleKey: string | null | undefined
): readonly ExecutionCapability[] {
  const normalized = normalizeExecutionRoutingRoleKey(roleKey);
  if (!normalized) return EXECUTION_ROUTING_DEFAULT_POLICY;
  const policy = EXECUTION_ROUTING_ROLE_POLICY[normalized];
  return policy ?? EXECUTION_ROUTING_DEFAULT_POLICY;
}

/** 카탈로그 노출용: 역할 키 전체 목록(정렬). */
export function listExecutionRoutingRoleKeys(): readonly string[] {
  return Object.keys(EXECUTION_ROUTING_ROLE_POLICY).sort();
}
