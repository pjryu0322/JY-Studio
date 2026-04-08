/**
 * In-memory, session-scoped collaboration outputs shared across client pages.
 * Not persisted across full reload — replace with API/DB later.
 */

import type {
  CollaborationGenerationSource,
  CollaborationOfficialTaskDraft,
} from "@/lib/workflow/collaborationActionContract";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";

/** Pre-execution readiness per task id (in-memory; not the execution pipeline). */
export type TaskExecutionReadiness = "not_ready" | "ready";

export type SessionCollaborationResultEntry = {
  /** When set, overrides view-model minutes for this session everywhere we resolve. */
  minutes?: MeetingMinutesMock;
  /** When set, overrides view-model official features for this session (future generation). */
  officialFeatures?: FeatureMock[];
  /** When set, overrides view-model / empty task draft list for this session. */
  officialTasks?: CollaborationOfficialTaskDraft[];
  /**
   * User-confirmed official task subset from Tasks workspace (separate from generated officialTasks).
   * When defined (including []), Requirement / tasks resolution treats this as the official confirmed set.
   */
  confirmedTasks?: CollaborationOfficialTaskDraft[];
  /** When `confirmedTasks` was last written. */
  confirmedTasksAtIso?: string;
  /** Execution readiness for task ids (confirmed / working); defaults to not_ready when missing. */
  taskReadinessByTaskId?: Record<string, TaskExecutionReadiness>;
  updatedAtIso: string;
  source: CollaborationGenerationSource;
};

const bySessionId = new Map<string, SessionCollaborationResultEntry>();

let version = 0;
const listeners = new Set<() => void>();

function bumpVersion() {
  version += 1;
  for (const l of listeners) {
    l();
  }
}

export function subscribeCollaborationSessionResults(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getCollaborationSessionResultsVersion(): number {
  return version;
}

export function getSessionCollaborationEntry(sessionId: string): SessionCollaborationResultEntry | undefined {
  return bySessionId.get(sessionId);
}

export function recordSessionGeneratedMinutes(
  sessionId: string,
  minutes: MeetingMinutesMock,
  source: CollaborationGenerationSource
): void {
  const prev = bySessionId.get(sessionId);
  bySessionId.set(sessionId, {
    ...prev,
    minutes,
    updatedAtIso: new Date().toISOString(),
    source,
  });
  bumpVersion();
}

/** Reserved for future “derive official features” generation — same resolution path as minutes. */
export function recordSessionOfficialFeatures(
  sessionId: string,
  features: FeatureMock[],
  source: CollaborationGenerationSource
): void {
  const prev = bySessionId.get(sessionId);
  bySessionId.set(sessionId, {
    ...prev,
    officialFeatures: features,
    updatedAtIso: new Date().toISOString(),
    source,
  });
  bumpVersion();
}

export function recordSessionOfficialTasks(
  sessionId: string,
  tasks: CollaborationOfficialTaskDraft[],
  source: CollaborationGenerationSource
): void {
  const prev = bySessionId.get(sessionId);
  bySessionId.set(sessionId, {
    ...prev,
    officialTasks: tasks,
    updatedAtIso: new Date().toISOString(),
    source,
  });
  bumpVersion();
}

/** Persist the official confirmed subset from Tasks workspace (in-memory only). */
export function recordSessionConfirmedTasks(sessionId: string, tasks: CollaborationOfficialTaskDraft[]): void {
  const prev = bySessionId.get(sessionId);
  const at = new Date().toISOString();
  const prevReadiness = prev?.taskReadinessByTaskId ?? {};
  const nextReadiness: Record<string, TaskExecutionReadiness> = {};
  for (const t of tasks) {
    nextReadiness[t.id] = prevReadiness[t.id] ?? "not_ready";
  }
  bySessionId.set(sessionId, {
    ...prev,
    confirmedTasks: tasks,
    confirmedTasksAtIso: at,
    taskReadinessByTaskId: nextReadiness,
    updatedAtIso: at,
    source: prev?.source ?? "mock_stub",
  });
  bumpVersion();
}

export function getTaskExecutionReadiness(
  map: Record<string, TaskExecutionReadiness> | undefined,
  taskId: string
): TaskExecutionReadiness {
  return map?.[taskId] ?? "not_ready";
}

/** Snapshot of readiness flags for the session (may be empty). */
export function resolveSessionTaskReadiness(sessionId: string | null | undefined): Record<string, TaskExecutionReadiness> {
  if (!sessionId) return {};
  const m = bySessionId.get(sessionId)?.taskReadinessByTaskId;
  return m ? { ...m } : {};
}

export function setSessionTaskReadiness(sessionId: string, taskId: string, readiness: TaskExecutionReadiness): void {
  const prev = bySessionId.get(sessionId);
  const at = new Date().toISOString();
  const base: SessionCollaborationResultEntry = prev ?? {
    updatedAtIso: at,
    source: "mock_stub",
  };
  const prevMap = base.taskReadinessByTaskId ?? {};
  bySessionId.set(sessionId, {
    ...base,
    taskReadinessByTaskId: { ...prevMap, [taskId]: readiness },
    updatedAtIso: at,
    source: base.source,
  });
  bumpVersion();
}

export function resolveSessionMinutes(sessionId: string | null | undefined, vmMinutes: MeetingMinutesMock | null): MeetingMinutesMock | null {
  if (!sessionId) return vmMinutes;
  const entry = bySessionId.get(sessionId);
  if (entry?.minutes !== undefined) {
    return entry.minutes;
  }
  return vmMinutes;
}

export function resolveSessionOfficialFeatures(sessionId: string | null | undefined, vmFeatures: FeatureMock[]): FeatureMock[] {
  if (!sessionId) return vmFeatures;
  const entry = bySessionId.get(sessionId);
  if (entry?.officialFeatures !== undefined) {
    return entry.officialFeatures;
  }
  return vmFeatures;
}

export function resolveSessionOfficialTasks(
  sessionId: string | null | undefined,
  vmTaskDrafts: CollaborationOfficialTaskDraft[]
): CollaborationOfficialTaskDraft[] {
  if (!sessionId) return vmTaskDrafts;
  const entry = bySessionId.get(sessionId);
  if (entry?.officialTasks !== undefined) {
    return entry.officialTasks;
  }
  return vmTaskDrafts;
}

/** Confirmed task set if user saved one; `undefined` means never confirmed in this session. */
export function resolveSessionConfirmedTasks(
  sessionId: string | null | undefined
): CollaborationOfficialTaskDraft[] | undefined {
  if (!sessionId) return undefined;
  const entry = bySessionId.get(sessionId);
  if (entry?.confirmedTasks === undefined) return undefined;
  return entry.confirmedTasks;
}

export function sessionHasConfirmedTaskSet(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return bySessionId.get(sessionId)?.confirmedTasks !== undefined;
}

export function sessionHasMinutesOverride(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return bySessionId.get(sessionId)?.minutes !== undefined;
}

export function sessionHasOfficialFeaturesOverride(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return bySessionId.get(sessionId)?.officialFeatures !== undefined;
}

export function sessionHasOfficialTasksOverride(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return bySessionId.get(sessionId)?.officialTasks !== undefined;
}
