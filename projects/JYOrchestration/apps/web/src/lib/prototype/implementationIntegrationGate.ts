import type { ExcludedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";

export const INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE =
  "모든 CodeTask가 통합 가능 상태여야 합니다. 미완료 또는 검증 대기 작업을 먼저 완료해 주세요." as const;

export function computeStrictIntegrationCanIntegrate(input: {
  readonly totalCount: number;
  readonly includedCount: number;
  readonly excludedCount: number;
}): boolean {
  return (
    input.totalCount > 0 &&
    input.includedCount === input.totalCount &&
    input.excludedCount === 0
  );
}

export function logIntegrationGateBlocked(input: {
  readonly projectId?: string | null;
  readonly totalCodeTaskCount: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly excluded: readonly ExcludedCodeTaskIntegrationTarget[];
}): void {
  if (typeof console === "undefined" || !console.info) return;
  const reasonByCodeTaskId: Record<string, string> = {};
  for (const row of input.excluded) {
    reasonByCodeTaskId[row.codeTaskId] = row.reason;
  }
  console.info(
    JSON.stringify({
      action: "integration_gate_blocked",
      projectId: input.projectId ?? null,
      totalCodeTaskCount: input.totalCodeTaskCount,
      includedCount: input.includedCount,
      excludedCount: input.excludedCount,
      reasonByCodeTaskId,
    }),
  );
}
