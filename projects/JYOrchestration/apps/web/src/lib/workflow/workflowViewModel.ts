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

export type RequirementDetailView = {
  requirementId: string;
  requirement: RequirementMock | null;
  found: boolean;
  sessions: CollaborationSessionMock[];
  latestSession: CollaborationSessionMock | null;
  minutes: MeetingMinutesMock | null;
  features: FeatureMock[];
};

export function getRequirementDetailView(requirementId: string): RequirementDetailView {
  const requirement = getMockRequirement(requirementId);
  const sessions = requirement ? getMockSessionsForRequirement(requirementId) : [];
  const latestSession = sessions[0] ?? null;
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

