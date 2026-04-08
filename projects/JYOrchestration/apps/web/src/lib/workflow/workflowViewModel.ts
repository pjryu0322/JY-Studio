import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";
import {
  getMockFeaturesForSession,
  getMockMinutesForSession,
  getMockRequirement,
  getMockSession,
  getMockSessionsForRequirement,
  type CollaborationSessionMock,
  type FeatureMock,
  type MeetingMinutesMock,
  type RequirementMock,
  mockRequirements,
  mockSessions,
} from "@/lib/mock/workflowMock";

export type RequirementsListView = {
  requirements: RequirementMock[];
};

export function getRequirementsListView(): RequirementsListView {
  return { requirements: mockRequirements };
}

export type CollaborationListRow = {
  session: CollaborationSessionMock;
  requirement: RequirementMock | null;
};

export type CollaborationListView = {
  sessions: CollaborationListRow[];
};

export function getCollaborationListView(): CollaborationListView {
  return {
    sessions: mockSessions.map((s) => ({ session: s, requirement: getMockRequirement(s.requirementId) })),
  };
}

/**
 * Latest session policy (explicit & deterministic):
 * - Prefer OPEN sessions
 * - Then sort by createdAt descending (YYYY-MM-DD)
 * - Tie-breaker by id desc (stable)
 */
export function pickLatestSession(sessions: CollaborationSessionMock[]): CollaborationSessionMock | null {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => {
    const aOpen = a.status === "OPEN" ? 1 : 0;
    const bOpen = b.status === "OPEN" ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    if (a.id !== b.id) return a.id < b.id ? 1 : -1;
    return 0;
  });
  return sorted[0] ?? null;
}

export type RequirementDetailView = {
  requirementId: string;
  requirement: RequirementMock | null;
  found: boolean;
  sessions: CollaborationSessionMock[];
  latestSession: CollaborationSessionMock | null;
  minutes: MeetingMinutesMock | null;
  features: FeatureMock[];
  /** View-model task drafts (empty until backend); collaboration store may override per latest session. */
  taskDrafts: CollaborationOfficialTaskDraft[];
};

export function getRequirementDetailView(requirementId: string): RequirementDetailView {
  const requirement = getMockRequirement(requirementId);
  const sessions = requirement ? getMockSessionsForRequirement(requirementId) : [];
  const latestSession = pickLatestSession(sessions);
  const minutes = latestSession ? getMockMinutesForSession(latestSession.id) : null;
  const features = latestSession ? getMockFeaturesForSession(latestSession.id) : [];
  return {
    requirementId,
    requirement,
    found: Boolean(requirement),
    sessions,
    latestSession,
    minutes,
    features,
    taskDrafts: [],
  };
}

export type CollaborationWorkspaceView = {
  sessionId: string;
  session: CollaborationSessionMock | null;
  found: boolean;
  requirement: RequirementMock | null;
  minutes: MeetingMinutesMock | null;
  features: FeatureMock[];
};

export function getCollaborationWorkspaceView(sessionId: string): CollaborationWorkspaceView {
  const session = getMockSession(sessionId);
  const requirement = session ? getMockRequirement(session.requirementId) : null;
  const minutes = session ? getMockMinutesForSession(session.id) : null;
  const features = session ? getMockFeaturesForSession(session.id) : [];
  return {
    sessionId,
    session,
    found: Boolean(session),
    requirement,
    minutes,
    features,
  };
}

