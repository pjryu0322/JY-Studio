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

  return {
    version: IMPLEMENTATION_EXECUTION_BOARD_STATE_VERSION,
    projectId,
    createdAt,
    updatedAt,
    userConfirmations,
    reworkRequests,
  };
}

export function getUserConfirmationForTask(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
  taskId: string,
): ImplementationTaskUserConfirmationV1 | null {
  if (!boardState) return null;
  return boardState.userConfirmations.find((c) => c.taskId === taskId) ?? null;
}

export function countActiveReworkRequestsForTask(
  boardState: ImplementationExecutionBoardStateV1 | null | undefined,
  taskId: string,
): number {
  if (!boardState) return 0;
  return boardState.reworkRequests.filter(
    (r) => r.taskId === taskId && r.status !== "cancelled" && r.status !== "done",
  ).length;
}
