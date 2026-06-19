export type DataStoreLifecycleStatus =
  | "PLANNED"
  | "CREATING"
  | "CREATED"
  | "FAILED"
  | "NOT_REQUIRED";

export type StageDataStoreStage = "IMPLEMENTATION" | "REVIEW";

export type StageDataStoreDescriptor = Readonly<{
  readonly name: string;
  readonly stage: StageDataStoreStage;
  readonly lifecycleStatus: DataStoreLifecycleStatus;
  readonly createdAt?: string | null;
  readonly createdByJobId?: string | null;
  readonly errorMessage?: string | null;
}>;

export function readDataStoreLifecycleStatus(raw: unknown): DataStoreLifecycleStatus | null {
  const s = String(raw ?? "").trim();
  if (
    s === "PLANNED" ||
    s === "CREATING" ||
    s === "CREATED" ||
    s === "FAILED" ||
    s === "NOT_REQUIRED"
  ) {
    return s;
  }
  return null;
}

export function resolvePlanningStageStoreLifecycle(input: Readonly<{
  readonly jsonSampleMode: boolean;
  readonly priorStatus?: DataStoreLifecycleStatus | null;
}>): DataStoreLifecycleStatus {
  if (input.jsonSampleMode) return "NOT_REQUIRED";
  const prior = input.priorStatus;
  if (prior === "CREATED" || prior === "CREATING" || prior === "FAILED") return prior;
  return "PLANNED";
}
