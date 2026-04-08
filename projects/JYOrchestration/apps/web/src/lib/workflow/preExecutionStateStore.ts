/**
 * Pre-execution state handling:
 * - readiness per task id
 * - execution candidates (confirmed ∩ ready)
 * - execution launch snapshot
 * - active pre-execution input selection
 *
 * In-memory only. No execution pipeline binding.
 */

import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";
import { resolveSessionConfirmedTasks } from "@/lib/workflow/collaborationSessionContentStore";

export type TaskExecutionReadiness = "not_ready" | "ready";

type PreExecutionEntry = {
  taskReadinessByTaskId?: Record<string, TaskExecutionReadiness>;
  executionLaunchSnapshot?: ExecutionLaunchSnapshot;
  updatedAtIso?: string;
};

export function getTaskExecutionReadiness(
  map: Record<string, TaskExecutionReadiness> | undefined,
  taskId: string
): TaskExecutionReadiness {
  return map?.[taskId] ?? "not_ready";
}

export function resolveSessionTaskReadiness(sessionId: string | null | undefined): Record<string, TaskExecutionReadiness> {
  if (!sessionId) return {};
  const m = getSessionEntry<PreExecutionEntry>(sessionId)?.taskReadinessByTaskId;
  return m ? { ...m } : {};
}

export function setSessionTaskReadiness(sessionId: string, taskId: string, readiness: TaskExecutionReadiness): void {
  const at = new Date().toISOString();
  updateSessionEntry<PreExecutionEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    taskReadinessByTaskId: { ...(prev?.taskReadinessByTaskId ?? {}), [taskId]: readiness },
    updatedAtIso: at,
  }));
}

/**
 * Execution candidate set = confirmed tasks where readiness === "ready".
 * Returns [] when no confirmed set exists for the session.
 */
export function resolveSessionExecutionCandidates(sessionId: string | null | undefined): CollaborationOfficialTaskDraft[] {
  const confirmed = resolveSessionConfirmedTasks(sessionId);
  if (!confirmed) return [];
  const readiness = resolveSessionTaskReadiness(sessionId);
  return confirmed.filter((t) => getTaskExecutionReadiness(readiness, t.id) === "ready");
}

export function recordSessionExecutionLaunchSnapshot(sessionId: string, snapshot: ExecutionLaunchSnapshot): void {
  const at = new Date().toISOString();
  updateSessionEntry<PreExecutionEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    executionLaunchSnapshot: snapshot,
    updatedAtIso: at,
  }));
}

export function resolveSessionExecutionLaunchSnapshot(sessionId: string | null | undefined): ExecutionLaunchSnapshot | undefined {
  if (!sessionId) return undefined;
  return getSessionEntry<PreExecutionEntry>(sessionId)?.executionLaunchSnapshot;
}

export function sessionHasExecutionLaunchSnapshot(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<PreExecutionEntry>(sessionId)?.executionLaunchSnapshot !== undefined;
}

export type ActiveExecutionInputSelection = {
  sessionId: string;
  snapshotId: string;
  selectedAtIso: string;
};

let activeExecutionInput: ActiveExecutionInputSelection | null = null;

export function getActiveExecutionInput(): ActiveExecutionInputSelection | null {
  return activeExecutionInput;
}

export function setActiveExecutionInput(selection: { sessionId: string; snapshotId: string }): void {
  activeExecutionInput = {
    sessionId: selection.sessionId,
    snapshotId: selection.snapshotId,
    selectedAtIso: new Date().toISOString(),
  };
  // Global selection is outside per-session entry; bump a session entry to trigger subscribers.
  updateSessionEntry<PreExecutionEntry>(selection.sessionId, (prev) => ({ ...(prev ?? {}) }));
}

export function isActiveExecutionSnapshot(sessionId: string | null | undefined, snapshotId: string | null | undefined): boolean {
  if (!sessionId || !snapshotId) return false;
  return Boolean(activeExecutionInput && activeExecutionInput.sessionId === sessionId && activeExecutionInput.snapshotId === snapshotId);
}

