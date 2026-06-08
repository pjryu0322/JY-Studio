import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";

const TERMINAL_STATUSES = new Set<ImplementationExecutionUnitV1["status"]>([
  "verified",
  "skipped",
  "failed",
]);

const NON_TERMINAL_STATUSES = new Set<ImplementationExecutionUnitV1["status"]>([
  "ready",
  "blocked",
  "running",
  "verifying",
]);

function reasonAllowsRetry(reason: string): boolean {
  return /retry|_retry/i.test(reason);
}

function reasonAllowsVerificationCorrection(reason: string): boolean {
  return /verification_correction/i.test(reason);
}

function isTerminalRegressionBlocked(input: {
  readonly fromStatus: ImplementationExecutionUnitV1["status"];
  readonly toStatus: ImplementationExecutionUnitV1["status"];
  readonly reason: string;
}): boolean {
  if (input.fromStatus === input.toStatus) return false;
  if (!TERMINAL_STATUSES.has(input.fromStatus)) return false;

  if (input.fromStatus === "failed" && input.toStatus === "ready") {
    return !reasonAllowsRetry(input.reason);
  }
  if (input.fromStatus === "verified" && input.toStatus === "failed") {
    return !reasonAllowsVerificationCorrection(input.reason);
  }
  if (input.fromStatus === "failed" && (input.toStatus === "running" || input.toStatus === "verifying")) {
    return !reasonAllowsRetry(input.reason);
  }
  if (
    (input.fromStatus === "verified" || input.fromStatus === "skipped") &&
    NON_TERMINAL_STATUSES.has(input.toStatus)
  ) {
    return true;
  }
  return false;
}

export function mergeExecutionUnitWithTerminalGuard(input: {
  readonly current: ImplementationExecutionUnitV1;
  readonly patch: Partial<ImplementationExecutionUnitV1>;
  readonly reason: string;
}): Readonly<{
  readonly unit: ImplementationExecutionUnitV1;
  readonly blocked: boolean;
  readonly warning?: string;
}> {
  const nextStatus = (input.patch.status ?? input.current.status) as ImplementationExecutionUnitV1["status"];
  if (
    isTerminalRegressionBlocked({
      fromStatus: input.current.status,
      toStatus: nextStatus,
      reason: input.reason,
    })
  ) {
    return {
      unit: input.current,
      blocked: true,
      warning: `terminal_regression_blocked:${input.current.status}->${nextStatus}`,
    };
  }
  return {
    unit: { ...input.current, ...input.patch, unitId: input.current.unitId },
    blocked: false,
  };
}

export function mergeExecutionUnitListsWithTerminalGuard(input: {
  readonly previous: readonly ImplementationExecutionUnitV1[];
  readonly next: readonly ImplementationExecutionUnitV1[];
  readonly reason: string;
}): Readonly<{
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly blockedRegressions: readonly Readonly<{
    readonly unitId: string;
    readonly codeTaskId: string;
    readonly processTaskId: string;
    readonly fromStatus: ImplementationExecutionUnitV1["status"];
    readonly toStatus: ImplementationExecutionUnitV1["status"];
  }>[];
}> {
  const prevById = new Map(input.previous.map((u) => [u.unitId, u]));
  const blockedRegressions: {
    unitId: string;
    codeTaskId: string;
    processTaskId: string;
    fromStatus: ImplementationExecutionUnitV1["status"];
    toStatus: ImplementationExecutionUnitV1["status"];
  }[] = [];
  const units = input.next.map((candidate) => {
    const prev = prevById.get(candidate.unitId);
    if (!prev) return candidate;
    const merged = mergeExecutionUnitWithTerminalGuard({
      current: prev,
      patch: candidate,
      reason: input.reason,
    });
    if (merged.blocked) {
      blockedRegressions.push({
        unitId: prev.unitId,
        codeTaskId: prev.codeTaskId,
        processTaskId: prev.processTaskId,
        fromStatus: prev.status,
        toStatus: (candidate.status ?? prev.status) as ImplementationExecutionUnitV1["status"],
      });
    }
    return merged.unit;
  });
  return { units, blockedRegressions };
}
