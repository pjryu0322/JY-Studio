import type { ExcludedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";

export const INTEGRATION_STRICT_GATE_INCOMPLETE_USER_MESSAGE =
  "아직 완료되지 않았거나 GitHub 확인이 필요한 CodeTask가 있어 통합할 수 없습니다." as const;

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
  const blockedCodeTaskIds: string[] = [];
  const blockedReasons: string[] = [];
  for (const row of input.excluded) {
    reasonByCodeTaskId[row.codeTaskId] = row.reason;
    blockedCodeTaskIds.push(row.codeTaskId);
    blockedReasons.push(`${row.codeTaskId}:${row.reason}`);
  }
  console.info(
    JSON.stringify({
      action: "integration_gate_blocked",
      projectId: input.projectId ?? null,
      totalCodeTaskCount: input.totalCodeTaskCount,
      includedCount: input.includedCount,
      excludedCount: input.excludedCount,
      blockedCodeTaskIds,
      blockedReasons,
      reasonByCodeTaskId,
    }),
  );
}
