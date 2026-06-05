import type { ImplementationUserConfirmationStatus } from "@/lib/prototype/implementationExecutionBoard";

export const IMPLEMENTATION_EXECUTION_BOARD_STATE_VERSION =
  "implementation_execution_board_state_v1" as const;

export type ImplementationTaskUserConfirmationV1 = Readonly<{
  taskId: string;
  status: ImplementationUserConfirmationStatus;
  reason?: string;
  requestedAt?: string;
  resolvedAt?: string;
  resolvedByUser?: boolean;
}>;

export type ImplementationTaskReworkRequestV1 = Readonly<{
  requestId: string;
  taskId: string;
  targetRole: "developer" | "reviewer" | "security" | "scm" | "all";
  reason: string;
  status: "requested" | "accepted" | "done" | "cancelled";
  createdAt: string;
  updatedAt: string;
}>;

export type ImplementationExecutionBoardStateV1 = Readonly<{
  version: typeof IMPLEMENTATION_EXECUTION_BOARD_STATE_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  userConfirmations: readonly ImplementationTaskUserConfirmationV1[];
  reworkRequests: readonly ImplementationTaskReworkRequestV1[];
  selectedTaskIds?: readonly string[];
  selectedCodeTaskIds?: readonly string[];
}>;

const CONFIRMATION_STATUSES = new Set<ImplementationUserConfirmationStatus>([
  "none",
  "optional",
  "required_non_blocking",
  "blocking",
]);

const REWORK_STATUSES = new Set<ImplementationTaskReworkRequestV1["status"]>([
  "requested",
  "accepted",
  "done",
  "cancelled",
]);

const REWORK_TARGET_ROLES = new Set<ImplementationTaskReworkRequestV1["targetRole"]>([
  "developer",
  "reviewer",
  "security",
  "scm",
  "all",
]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseUserConfirmation(raw: unknown): ImplementationTaskUserConfirmationV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const taskId = readString(o.taskId);
  const status = readString(o.status) as ImplementationUserConfirmationStatus;
  if (!taskId || !CONFIRMATION_STATUSES.has(status) || status === "none") return null;
  return {
    taskId,
    status,
    ...(typeof o.reason === "string" && o.reason.trim() ? { reason: o.reason.trim() } : {}),
    ...(typeof o.requestedAt === "string" && o.requestedAt.trim() ? { requestedAt: o.requestedAt.trim() } : {}),
    ...(typeof o.resolvedAt === "string" && o.resolvedAt.trim() ? { resolvedAt: o.resolvedAt.trim() } : {}),
    ...(typeof o.resolvedByUser === "boolean" ? { resolvedByUser: o.resolvedByUser } : {}),
  };
}

function parseReworkRequest(raw: unknown): ImplementationTaskReworkRequestV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const requestId = readString(o.requestId);
  const taskId = readString(o.taskId);
  const targetRole = readString(o.targetRole) as ImplementationTaskReworkRequestV1["targetRole"];
  const reason = readString(o.reason);
  const status = readString(o.status) as ImplementationTaskReworkRequestV1["status"];
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  if (!requestId || !taskId || !reason || !createdAt || !updatedAt) return null;
  if (!REWORK_TARGET_ROLES.has(targetRole) || !REWORK_STATUSES.has(status)) return null;
  return { requestId, taskId, targetRole, reason, status, createdAt, updatedAt };
}

export function parseImplementationExecutionBoardStateV1(
  raw: unknown,
): ImplementationExecutionBoardStateV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_EXECUTION_BOARD_STATE_VERSION) return null;
  const projectId = readString(o.projectId);
  const createdAt = readString(o.createdAt);
  const updatedAt = readString(o.updatedAt);
  if (!projectId || !createdAt || !updatedAt) return null;

  const userConfirmations: ImplementationTaskUserConfirmationV1[] = [];
  if (Array.isArray(o.userConfirmations)) {
    for (const row of o.userConfirmations) {
      const parsed = parseUserConfirmation(row);
      if (parsed) userConfirmations.push(parsed);
    }
  }

  const reworkRequests: ImplementationTaskReworkRequestV1[] = [];
  if (Array.isArray(o.reworkRequests)) {
    for (const row of o.reworkRequests) {
      const parsed = parseReworkRequest(row);
      if (parsed) reworkRequests.push(parsed);
    }
  }

  const selectedTaskIds = Array.isArray(o.selectedTaskIds)
    ? o.selectedTaskIds.map((id) => readString(id)).filter(Boolean)
    : undefined;
  const selectedCodeTaskIds = Array.isArray(o.selectedCodeTaskIds)
    ? o.selectedCodeTaskIds.map((id) => readString(id)).filter(Boolean)
    : undefined;

  return {
    version: IMPLEMENTATION_EXECUTION_BOARD_STATE_VERSION,
    projectId,
    createdAt,
    updatedAt,
    userConfirmations,
    reworkRequests,
    ...(selectedTaskIds?.length ? { selectedTaskIds } : {}),
    ...(selectedCodeTaskIds?.length ? { selectedCodeTaskIds } : {}),
  };
}

export function getUserConfirmationForTask(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
  taskId: string,
): ImplementationTaskUserConfirmationV1 | null {
  if (!boardState) return null;
  return (boardState.userConfirmations ?? []).find((c) => c.taskId === taskId) ?? null;
}

export function countActiveReworkRequestsForTask(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
  taskId: string,
): number {
  return getActiveReworkRequestsForTask(boardState, taskId).length;
}

export function buildInitialImplementationExecutionBoardState(input: {
  readonly projectId: string;
  readonly nowIso?: string;
  readonly existing?: ImplementationExecutionBoardStateV1 | null;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const projectId = input.projectId.trim();
  if (input.existing) {
    return { ...input.existing, updatedAt: now };
  }
  return {
    version: IMPLEMENTATION_EXECUTION_BOARD_STATE_VERSION,
    projectId,
    createdAt: now,
    updatedAt: now,
    userConfirmations: [],
    reworkRequests: [],
  };
}

export function isUserConfirmationResolved(
  confirmation: ImplementationTaskUserConfirmationV1 | null | undefined,
): boolean {
  return Boolean(confirmation?.resolvedAt);
}

export function resolveUserConfirmationForTask(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly taskId: string;
  readonly nowIso?: string;
  readonly resolvedByUser?: boolean;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const taskId = input.taskId.trim();
  const base = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  if (!base.userConfirmations.some((c) => c.taskId === taskId)) return base;
  return {
    ...base,
    updatedAt: now,
    userConfirmations: base.userConfirmations.map((c) =>
      c.taskId === taskId
        ? { ...c, resolvedAt: now, resolvedByUser: input.resolvedByUser ?? true }
        : c,
    ),
  };
}

export function resolveAllPendingUserConfirmations(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly nowIso?: string;
  readonly resolvedByUser?: boolean;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  let next = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  for (const confirmation of next.userConfirmations) {
    if (!confirmation.resolvedAt && confirmation.status !== "none") {
      next = resolveUserConfirmationForTask({
        state: next,
        projectId: input.projectId,
        taskId: confirmation.taskId,
        nowIso: now,
        resolvedByUser: input.resolvedByUser,
      });
    }
  }
  return next;
}

export function appendReworkRequest(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly taskId: string;
  readonly targetRole: ImplementationTaskReworkRequestV1["targetRole"];
  readonly reason: string;
  readonly nowIso?: string;
  readonly requestId?: string;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const taskId = input.taskId.trim();
  const reason = input.reason.trim();
  const base = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  const requestId =
    input.requestId?.trim() ||
    `rework-${taskId}-${now.replace(/[:.]/g, "-")}`;
  const request: ImplementationTaskReworkRequestV1 = {
    requestId,
    taskId,
    targetRole: input.targetRole,
    reason,
    status: "requested",
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...base,
    updatedAt: now,
    reworkRequests: [...(base.reworkRequests ?? []), request],
  };
}

export function updateBoardSelectedTaskIds(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly selectedTaskIds: readonly string[];
  readonly nowIso?: string;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const selectedTaskIds = input.selectedTaskIds.map((taskId) => taskId.trim()).filter(Boolean);
  const base = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  return {
    ...base,
    updatedAt: now,
    ...(selectedTaskIds.length ? { selectedTaskIds } : { selectedTaskIds: [] }),
  };
}

export function updateBoardSelectedCodeTaskIds(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly nowIso?: string;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const selectedCodeTaskIds = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  const base = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  return {
    ...base,
    updatedAt: now,
    selectedCodeTaskIds: [...new Set(selectedCodeTaskIds)],
  };
}

export function getActiveReworkRequestsForTask(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
  taskId: string,
): readonly ImplementationTaskReworkRequestV1[] {
  if (!boardState) return [];
  return (boardState.reworkRequests ?? []).filter(
    (r) => r.taskId === taskId && r.status !== "cancelled" && r.status !== "done",
  );
}

export function getActiveReworkContextForTask(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
  taskId: string,
): readonly string[] {
  return getActiveReworkRequestsForTask(boardState, taskId).map(
    (r) => `[${r.targetRole}] ${r.reason}`,
  );
}

const ACTIVE_REWORK_STATUSES = new Set<ImplementationTaskReworkRequestV1["status"]>([
  "requested",
  "accepted",
]);

export function markReworkRequestsAcceptedForTask(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly taskId: string;
  readonly nowIso?: string;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const taskId = input.taskId.trim();
  const base = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  return {
    ...base,
    updatedAt: now,
    reworkRequests: (base.reworkRequests ?? []).map((r) =>
      r.taskId === taskId && r.status === "requested"
        ? { ...r, status: "accepted", updatedAt: now }
        : r,
    ),
  };
}

export function markReworkRequestsDoneForTask(input: {
  readonly state: ImplementationExecutionBoardStateV1 | null | undefined;
  readonly projectId: string;
  readonly taskId: string;
  readonly nowIso?: string;
}): ImplementationExecutionBoardStateV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const taskId = input.taskId.trim();
  const base = buildInitialImplementationExecutionBoardState({
    projectId: input.projectId,
    nowIso: now,
    existing: input.state,
  });
  return {
    ...base,
    updatedAt: now,
    reworkRequests: (base.reworkRequests ?? []).map((r) =>
      r.taskId === taskId && ACTIVE_REWORK_STATUSES.has(r.status)
        ? { ...r, status: "done", updatedAt: now }
        : r,
    ),
  };
}
