/**
 * In-memory, session-scoped collaboration outputs shared across client pages.
 * Not persisted across full reload — replace with API/DB later.
 */

import type {
  CollaborationGenerationSource,
  CollaborationOfficialTaskDraft,
} from "@/lib/workflow/collaborationActionContract";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";

export type SessionCollaborationResultEntry = {
  /** When set, overrides view-model minutes for this session everywhere we resolve. */
  minutes?: MeetingMinutesMock;
  /** When set, overrides view-model official features for this session (future generation). */
  officialFeatures?: FeatureMock[];
  /** When set, overrides view-model / empty task draft list for this session. */
  officialTasks?: CollaborationOfficialTaskDraft[];
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
