export type ImplementationExecutionUnitStatusV1 =
  | "ready"
  | "blocked"
  | "running"
  | "verifying"
  | "verified"
  | "failed"
  | "skipped";

export type ImplementationExecutionUnitBranchGroupV1 =
  | "foundation"
  | "data"
  | "common"
  | "feature"
  | "screen"
  | "integration";

export type ImplementationExecutionUnitV1 = Readonly<{
  readonly unitId: string;
  readonly codeTaskId: string;
  readonly processTaskId: string;
  readonly title: string;
  readonly order: number;
  readonly branchGroup: ImplementationExecutionUnitBranchGroupV1;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly dependencies: readonly string[];
  readonly status: ImplementationExecutionUnitStatusV1;
  readonly retryable?: boolean;
  readonly runId?: string | null;
  readonly startedAt?: string | null;
  readonly verifyingAt?: string | null;
  readonly verifiedAt?: string | null;
  readonly failedAt?: string | null;
  readonly beforeHeadSha?: string | null;
  readonly afterHeadSha?: string | null;
  readonly commitSha?: string | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly sourceCodeTaskId?: string | null;
  readonly sourceWorkItemId?: string | null;
}>;

export function executionUnitIdForCodeTask(codeTaskId: string): string {
  return codeTaskId.trim();
}

export function isExecutionUnitTerminalForQueue(status: ImplementationExecutionUnitStatusV1): boolean {
  return status === "verified" || status === "skipped";
}

export function isExecutionUnitInFlight(status: ImplementationExecutionUnitStatusV1): boolean {
  return status === "running" || status === "verifying";
}
