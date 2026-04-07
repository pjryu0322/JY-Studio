export type RequirementStatus = "DRAFT" | "IN_DISCUSSION" | "APPROVED" | "DONE";

export type RequirementMock = {
  id: string;
  title: string;
  description: string;
  status: RequirementStatus;
  sessionCount: number;
  featureCount: number;
};

export type CollaborationSessionMock = {
  id: string;
  requirementId: string;
  title: string;
  createdAt: string;
  status: "OPEN" | "CLOSED";
};

export type MeetingMinutesMock = {
  summary: string;
  decisions: string[];
  pending: string[];
  excluded: string[];
};

export type FeatureMock = {
  id: string;
  name: string;
  description: string;
  status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "DONE";
  userFlow: string[];
  nonFunctional: string[];
};

export const mockRequirements: RequirementMock[] = [
  {
    id: "req-101",
    title: "Project onboarding workflow",
    description: "Make it easy to create a project, invite members, and start the first collaboration session.",
    status: "IN_DISCUSSION",
    sessionCount: 2,
    featureCount: 4,
  },
  {
    id: "req-102",
    title: "Meeting minutes + derived features",
    description: "Capture meeting minutes and derive a clean feature list for execution planning.",
    status: "DRAFT",
    sessionCount: 1,
    featureCount: 2,
  },
  {
    id: "req-103",
    title: "Execution readiness visibility",
    description: "Show what’s ready, what’s blocked, and why across tasks and features.",
    status: "APPROVED",
    sessionCount: 3,
    featureCount: 6,
  },
];

export const mockSessions: CollaborationSessionMock[] = [
  {
    id: "sess-201",
    requirementId: "req-101",
    title: "Kickoff: onboarding flow",
    createdAt: "2026-04-07",
    status: "OPEN",
  },
  {
    id: "sess-202",
    requirementId: "req-101",
    title: "Follow-up: permissions + invite UX",
    createdAt: "2026-04-06",
    status: "CLOSED",
  },
  {
    id: "sess-203",
    requirementId: "req-102",
    title: "Minutes structure + feature extraction",
    createdAt: "2026-04-05",
    status: "OPEN",
  },
];

export function getMockRequirement(id: string): RequirementMock | null {
  return mockRequirements.find((r) => r.id === id) ?? null;
}

export function getMockSessionsForRequirement(requirementId: string): CollaborationSessionMock[] {
  return mockSessions.filter((s) => s.requirementId === requirementId);
}

export function getMockSession(id: string): CollaborationSessionMock | null {
  return mockSessions.find((s) => s.id === id) ?? null;
}

export function getMockMinutesForSession(sessionId: string): MeetingMinutesMock {
  return {
    summary:
      sessionId === "sess-201"
        ? "Aligned on onboarding steps and clarified ownership + next milestones."
        : "Captured discussion summary; pending items were identified for next iteration.",
    decisions: [
      "Use a single entry workflow for Requirement → Session → Minutes → Features.",
      "Keep placeholders for now; integrate backend in the next phase.",
    ],
    pending: ["Finalize tab navigation and deep-links.", "Define feature statuses and mapping to tasks."],
    excluded: ["No AI automation in this phase.", "No backend orchestration changes."],
  };
}

export function getMockFeaturesForSession(sessionId: string): FeatureMock[] {
  const base: FeatureMock[] = [
    {
      id: "feat-301",
      name: "Requirement workspace skeleton",
      description: "Provide navigable pages and tabs to visualize the workflow.",
      status: "IN_PROGRESS",
      userFlow: ["Open requirement list", "Open requirement detail", "Navigate minutes/features tabs"],
      nonFunctional: ["No runtime errors", "Minimal UX; no redesign"],
    },
    {
      id: "feat-302",
      name: "Collaboration workspace layout",
      description: "Discussion timeline + right-side summary panel for minutes/features.",
      status: "PLANNED",
      userFlow: ["Open session", "Add discussion item", "Review minutes summary"],
      nonFunctional: ["Lightweight local state only", "No backend wiring yet"],
    },
  ];
  if (sessionId === "sess-201") return base;
  return [
    ...base,
    {
      id: "feat-303",
      name: "Meeting minutes panel",
      description: "Reusable minutes panel (summary/decisions/pending/excluded).",
      status: "IN_PROGRESS",
      userFlow: ["View minutes in session", "View minutes in requirement detail"],
      nonFunctional: ["Reusable component", "Mock data for now"],
    },
  ];
}

