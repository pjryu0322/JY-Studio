export const IMPLEMENTATION_INTEGRATED_EXECUTION_STATE_VERSION =
  "implementation_integrated_execution_state_v1" as const;

export type ImplementationIntegratedStep =
  | "refactor_common"
  | "integrated_review"
  | "integrated_security"
  | "final_scm";

export type ImplementationIntegratedStepStatus =
  | "not_started"
  | "ready"
  | "queued"
  | "in_progress"
  | "done"
  | "failed"
  | "skipped";

export type ImplementationIntegratedExecutionItemV1 = Readonly<{
  step: ImplementationIntegratedStep;
  status: ImplementationIntegratedStepStatus;
  ownerRole: "developer" | "reviewer" | "security" | "scm";
  startedAt?: string;
  completedAt?: string;
  resultSummary?: string;
  errorMessage?: string;
  reworkCount: number;
}>;

export type ImplementationIntegratedExecutionStateV1 = Readonly<{
  version: typeof IMPLEMENTATION_INTEGRATED_EXECUTION_STATE_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  items: readonly ImplementationIntegratedExecutionItemV1[];
}>;

const INTEGRATED_STEP_ORDER: readonly ImplementationIntegratedStep[] = [
  "refactor_common",
  "integrated_review",
  "integrated_security",
  "final_scm",
];

const STEP_OWNER: Readonly<Record<ImplementationIntegratedStep, ImplementationIntegratedExecutionItemV1["ownerRole"]>> =
  {
    refactor_common: "developer",
    integrated_review: "reviewer",
    integrated_security: "security",
    final_scm: "scm",
  };

const INTEGRATED_STATUSES = new Set<ImplementationIntegratedStepStatus>([
  "not_started",
  "ready",
  "queued",
  "in_progress",
  "done",
  "failed",
  "skipped",
]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function isIntegratedStep(value: string): value is ImplementationIntegratedStep {
  return INTEGRATED_STEP_ORDER.includes(value as ImplementationIntegratedStep);
}

function isIntegratedStatus(value: string): value is ImplementationIntegratedStepStatus {
  return INTEGRATED_STATUSES.has(value as ImplementationIntegratedStepStatus);
}

export function buildInitialImplementationIntegratedExecutionState(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): ImplementationIntegratedExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const projectId = input.projectId.trim();
  return {
    version: IMPLEMENTATION_INTEGRATED_EXECUTION_STATE_VERSION,
    projectId,
    createdAt: now,
    updatedAt: now,
    items: INTEGRATED_STEP_ORDER.map((step) => ({
      step,
      status: "not_started" as const,
      ownerRole: STEP_OWNER[step],
      reworkCount: 0,
    })),
  };
}

function parseItem(raw: unknown): ImplementationIntegratedExecutionItemV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const step = readString(o.step);
  const status = readString(o.status);
  const ownerRole = readString(o.ownerRole);
  if (!isIntegratedStep(step) || !isIntegratedStatus(status)) return null;
  if (ownerRole !== "developer" && ownerRole !== "reviewer" && ownerRole !== "security" && ownerRole !== "scm") {
    return null;
  }
  const reworkCount = typeof o.reworkCount === "number" && o.reworkCount >= 0 ? o.reworkCount : 0;
  return {
    step,
    status,
    ownerRole,
    reworkCount,
    ...(typeof o.startedAt === "string" && o.startedAt.trim() ? { startedAt: o.startedAt.trim() } : {}),
    ...(typeof o.completedAt === "string" && o.completedAt.trim() ? { completedAt: o.completedAt.trim() } : {}),
    ...(typeof o.resultSummary === "string" && o.resultSummary.trim()
      ? { resultSummary: o.resultSummary.trim() }
      : {}),
    ...(typeof o.errorMessage === "string" && o.errorMessage.trim() ? { errorMessage: o.errorMessage.trim() } : {}),
  };
}

export function parseImplementationIntegratedExecutionStateV1(
  raw: unknown,
): ImplementationIntegratedExecutionStateV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_INTEGRATED_EXECUTION_STATE_VERSION) return null;
  const projectId = readString(o.projectId);
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  if (!projectId || !createdAt || !updatedAt) return null;
  const items: ImplementationIntegratedExecutionItemV1[] = [];
  if (Array.isArray(o.items)) {
    for (const row of o.items) {
      const parsed = parseItem(row);
      if (parsed) items.push(parsed);
    }
  }
  const byStep = new Map(items.map((i) => [i.step, i]));
  const normalizedItems = INTEGRATED_STEP_ORDER.map(
    (step) =>
      byStep.get(step) ?? {
        step,
        status: "not_started" as const,
        ownerRole: STEP_OWNER[step],
        reworkCount: 0,
      },
  );
  return {
    version: IMPLEMENTATION_INTEGRATED_EXECUTION_STATE_VERSION,
    projectId,
    createdAt,
    updatedAt,
    items: normalizedItems,
  };
}

function statusOf(
  items: readonly ImplementationIntegratedExecutionItemV1[],
  step: ImplementationIntegratedStep,
): ImplementationIntegratedStepStatus {
  return items.find((i) => i.step === step)?.status ?? "not_started";
}

function setItemStatus(
  items: readonly ImplementationIntegratedExecutionItemV1[],
  step: ImplementationIntegratedStep,
  status: ImplementationIntegratedStepStatus,
): readonly ImplementationIntegratedExecutionItemV1[] {
  return items.map((item) => (item.step === step ? { ...item, status } : item));
}

function isTerminalIntegratedStatus(status: ImplementationIntegratedStepStatus): boolean {
  return status === "done" || status === "failed" || status === "skipped";
}

function promoteIntegratedStepToReadyIfNotStarted(
  items: readonly ImplementationIntegratedExecutionItemV1[],
  step: ImplementationIntegratedStep,
): readonly ImplementationIntegratedExecutionItemV1[] {
  if (statusOf(items, step) !== "not_started") return items;
  return setItemStatus(items, step, "ready");
}

/** Advances integrated step readiness from persisted state only (not global role execution). */
export function deriveIntegratedExecutionStateReadiness(input: {
  readonly projectId: string;
  readonly state: ImplementationIntegratedExecutionStateV1 | null | undefined;
  readonly taskRowsCompleted: boolean;
  readonly nowIso?: string;
}): ImplementationIntegratedExecutionStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const base =
    input.state ??
    buildInitialImplementationIntegratedExecutionState({ projectId: input.projectId, nowIso: now });

  if (!input.taskRowsCompleted) {
    return {
      ...base,
      updatedAt: now,
      items: base.items.map((item) =>
        isTerminalIntegratedStatus(item.status) ? item : { ...item, status: "not_started" as const },
      ),
    };
  }

  let items = [...base.items];

  items = promoteIntegratedStepToReadyIfNotStarted(items, "refactor_common");

  if (statusOf(items, "refactor_common") === "done") {
    items = promoteIntegratedStepToReadyIfNotStarted(items, "integrated_review");
  }

  if (statusOf(items, "integrated_review") === "done") {
    items = promoteIntegratedStepToReadyIfNotStarted(items, "integrated_security");
  }

  if (statusOf(items, "integrated_security") === "done") {
    items = promoteIntegratedStepToReadyIfNotStarted(items, "final_scm");
  }

  return { ...base, updatedAt: now, items };
}

export function areAllIntegratedStepsDone(
  state: ImplementationIntegratedExecutionStateV1 | null | undefined,
): boolean {
  if (!state?.items.length) return false;
  return state.items.every((item) => item.status === "done" || item.status === "skipped");
}
