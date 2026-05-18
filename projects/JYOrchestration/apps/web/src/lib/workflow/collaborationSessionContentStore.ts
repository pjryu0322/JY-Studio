/**
 * Collaboration/session content overrides (minutes, official features, official task drafts, confirmed tasks).
 * Purely in-memory. No pre-execution readiness or execution preparation concepts live here.
 */

import type {
  CollaborationGenerationSource,
  CollaborationOfficialTaskDraft,
} from "@/lib/workflow/collaborationActionContract";
import type { FeatureMock, MeetingMinutesMock } from "@/lib/mock/workflowMock";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";

export type SessionCollaborationContentEntry = {
  minutes?: MeetingMinutesMock;
  officialFeatures?: FeatureMock[];
  officialTasks?: CollaborationOfficialTaskDraft[];
  confirmedTasks?: CollaborationOfficialTaskDraft[];
  confirmedTasksAtIso?: string;
  updatedAtIso: string;
  source: CollaborationGenerationSource;
};

export function getSessionCollaborationEntry(sessionId: string): SessionCollaborationContentEntry | undefined {
  return getSessionEntry<SessionCollaborationContentEntry>(sessionId);
}

export function recordSessionGeneratedMinutes(sessionId: string, minutes: MeetingMinutesMock, source: CollaborationGenerationSource): void {
  updateSessionEntry<SessionCollaborationContentEntry>(sessionId, (prev) => ({
    ...(prev ?? { updatedAtIso: new Date().toISOString(), source }),
    minutes,
    updatedAtIso: new Date().toISOString(),
    source,
  }));
}

export function recordSessionOfficialFeatures(sessionId: string, features: FeatureMock[], source: CollaborationGenerationSource): void {
  updateSessionEntry<SessionCollaborationContentEntry>(sessionId, (prev) => ({
    ...(prev ?? { updatedAtIso: new Date().toISOString(), source }),
    officialFeatures: features,
    updatedAtIso: new Date().toISOString(),
    source,
  }));
}

export function recordSessionOfficialTasks(sessionId: string, tasks: CollaborationOfficialTaskDraft[], source: CollaborationGenerationSource): void {
  updateSessionEntry<SessionCollaborationContentEntry>(sessionId, (prev) => ({
    ...(prev ?? { updatedAtIso: new Date().toISOString(), source }),
    officialTasks: tasks,
    updatedAtIso: new Date().toISOString(),
    source,
  }));
}

/** Persist the official confirmed subset from Tasks workspace (in-memory only). */
export function recordSessionConfirmedTasks(
  sessionId: string,
  tasks: CollaborationOfficialTaskDraft[],
  sourceFallback: CollaborationGenerationSource = "mock_stub"
): void {
  const at = new Date().toISOString();
  updateSessionEntry<SessionCollaborationContentEntry>(sessionId, (prev) => ({
    ...(prev ?? { updatedAtIso: at, source: sourceFallback }),
    confirmedTasks: tasks,
    confirmedTasksAtIso: at,
    updatedAtIso: at,
    source: prev?.source ?? sourceFallback,
  }));
}

export function resolveSessionMinutes(sessionId: string | null | undefined, vmMinutes: MeetingMinutesMock | null): MeetingMinutesMock | null {
  if (!sessionId) return vmMinutes;
  const entry = getSessionEntry<SessionCollaborationContentEntry>(sessionId);
  return entry?.minutes !== undefined ? entry.minutes : vmMinutes;
}

export function resolveSessionOfficialFeatures(sessionId: string | null | undefined, vmFeatures: FeatureMock[]): FeatureMock[] {
  if (!sessionId) return vmFeatures;
  const entry = getSessionEntry<SessionCollaborationContentEntry>(sessionId);
  return entry?.officialFeatures !== undefined ? entry.officialFeatures : vmFeatures;
}

export function resolveSessionOfficialTasks(
  sessionId: string | null | undefined,
  vmTaskDrafts: CollaborationOfficialTaskDraft[]
): CollaborationOfficialTaskDraft[] {
  if (!sessionId) return vmTaskDrafts;
  const entry = getSessionEntry<SessionCollaborationContentEntry>(sessionId);
  return entry?.officialTasks !== undefined ? entry.officialTasks : vmTaskDrafts;
}

/** Confirmed task set if user saved one; `undefined` means never confirmed in this session. */
export function resolveSessionConfirmedTasks(sessionId: string | null | undefined): CollaborationOfficialTaskDraft[] | undefined {
  if (!sessionId) return undefined;
  const entry = getSessionEntry<SessionCollaborationContentEntry>(sessionId);
  return entry?.confirmedTasks === undefined ? undefined : entry.confirmedTasks;
}

export function sessionHasMinutesOverride(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<SessionCollaborationContentEntry>(sessionId)?.minutes !== undefined;
}

export function sessionHasOfficialFeaturesOverride(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<SessionCollaborationContentEntry>(sessionId)?.officialFeatures !== undefined;
}

export function sessionHasOfficialTasksOverride(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<SessionCollaborationContentEntry>(sessionId)?.officialTasks !== undefined;
}

export function sessionHasConfirmedTaskSet(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return getSessionEntry<SessionCollaborationContentEntry>(sessionId)?.confirmedTasks !== undefined;
}

