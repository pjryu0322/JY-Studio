/**
 * Harness Phase H5 — **Provider Capability Matrix**.
 *
 * Provider별 가능한 capability를 planning metadata로 관리한다.
 * **read-only / planning metadata only.** 실제 provider 강제 연결·switching에 영향 없음.
 *
 * Note: 이 매트릭스는 *현재 지원되는 capability 후보*를 기술한다. 새 capability가 도입되면
 * 이 표만 갱신해도 builder/diagnostic이 자동으로 따라간다.
 */

import type {
  ExecutionCapability,
  ExecutionProviderType,
} from "./executionCapabilityTypes";

/** Provider → 지원 capability 집합(정렬된 readonly 배열). */
export const PROVIDER_CAPABILITY_MATRIX: Readonly<
  Record<ExecutionProviderType, readonly ExecutionCapability[]>
> = {
  openai: [
    "analysis",
    "architecture_review",
    "code_review",
    "deployment_review",
    "design_review",
    "planning",
    "quality_review",
    "security_review",
  ],
  cursor: ["code_generation", "cursor_execution"],
  github: ["github_operation"],
  unknown: [],
};

/**
 * Capability를 가장 잘 처리할 수 있는 추천 provider를 결정한다(결정론).
 *
 * - 우선 순위: `cursor` > `github` > `openai` > `unknown`(provider 특수성이 높은 쪽 우선).
 * - 어떤 provider에도 매핑되지 않으면 `"unknown"` 반환(diagnostic에서 warning 처리).
 */
export function resolveRecommendedProviderForCapability(
  capability: ExecutionCapability
): ExecutionProviderType {
  if (PROVIDER_CAPABILITY_MATRIX.cursor.includes(capability)) return "cursor";
  if (PROVIDER_CAPABILITY_MATRIX.github.includes(capability)) return "github";
  if (PROVIDER_CAPABILITY_MATRIX.openai.includes(capability)) return "openai";
  return "unknown";
}

/** provider가 capability를 지원하는지 검사(matrix lookup). */
export function providerSupportsCapability(
  provider: ExecutionProviderType,
  capability: ExecutionCapability
): boolean {
  const list = PROVIDER_CAPABILITY_MATRIX[provider];
  return Array.isArray(list) && list.includes(capability);
}

/** 카탈로그 노출용: provider별 capability 목록(정렬·정형). */
export function listProviderCapabilityMatrix(): ReadonlyArray<{
  readonly provider: ExecutionProviderType;
  readonly capabilities: readonly ExecutionCapability[];
}> {
  return (Object.keys(PROVIDER_CAPABILITY_MATRIX) as ExecutionProviderType[])
    .sort()
    .map((provider) => ({
      provider,
      capabilities: PROVIDER_CAPABILITY_MATRIX[provider],
    }));
}
