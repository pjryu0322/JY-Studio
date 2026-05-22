import { beforeEach, describe, expect, it, vi } from "vitest";

const appendEventMock = vi.fn();

vi.mock("@/lib/runtime/runtimeEventService", () => ({
  appendRuntimeEvent: (...args: unknown[]) => appendEventMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskExecutionRun: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    task: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/execution/executionReviewWithAiMembers", () => ({
  countExecutionReviewAiMembers: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/ai-team-runtime/teamRuntimeLoopBridge", () => ({
  markTeamRuntimeReviewRunning: vi.fn(),
  markTeamRuntimeReviewFailed: vi.fn(),
  applyTeamRuntimeAfterReviewHarness: vi.fn(),
  markTeamRuntimeMergeRunning: vi.fn(),
  markTeamRuntimeCompleted: vi.fn(),
}));

import { runReviewerPhase, runSecurityPhase } from "@/lib/runtime/pipelineExecutionPhases";

const ctx = {
  projectId: "p1",
  taskId: "t1",
  actorUserId: "u1",
  execRunId: "r1",
  executionJobId: "job-1",
  repoUrl: "https://github.com/o/r",
  baseBranch: "main",
  githubAccessToken: null,
  requireApprovalBeforeApply: false,
  mergedAllowedGlobs: [] as string[],
  stopOnTestFailure: true,
  stopOnOutOfScopeChange: true,
  taskTitle: "Task",
  taskDescription: null,
  acceptanceCriteriaJson: [],
};

describe("pipelineExecutionPhases events", () => {
  beforeEach(() => {
    appendEventMock.mockReset();
    appendEventMock.mockResolvedValue(undefined);
  });

  it("runReviewerPhase emits REVIEW_STARTED when reviewers missing", async () => {
    const res = await runReviewerPhase(ctx);
    expect(res.ok).toBe(false);
    const types = appendEventMock.mock.calls.map((c) => (c[0] as { eventType: string }).eventType);
    expect(types).toContain("REVIEW_STARTED");
  });

  it("runSecurityPhase emits SECURITY_FAILED when harness rejects", async () => {
    const { applyTeamRuntimeAfterReviewHarness } = await import(
      "@/lib/ai-team-runtime/teamRuntimeLoopBridge"
    );
    vi.mocked(applyTeamRuntimeAfterReviewHarness).mockResolvedValueOnce({
      ok: false,
      reason: "blocked",
    });

    const res = await runSecurityPhase(ctx, []);
    expect(res.ok).toBe(false);
    const types = appendEventMock.mock.calls.map((c) => (c[0] as { eventType: string }).eventType);
    expect(types).toContain("SECURITY_STARTED");
    expect(types).toContain("SECURITY_FAILED");
  });

  it("runSecurityPhase emits SECURITY_COMPLETED on success", async () => {
    const { applyTeamRuntimeAfterReviewHarness } = await import(
      "@/lib/ai-team-runtime/teamRuntimeLoopBridge"
    );
    vi.mocked(applyTeamRuntimeAfterReviewHarness).mockResolvedValueOnce({ ok: true });

    const res = await runSecurityPhase(ctx, []);
    expect(res.ok).toBe(true);
    const types = appendEventMock.mock.calls.map((c) => (c[0] as { eventType: string }).eventType);
    expect(types).toContain("SECURITY_STARTED");
    expect(types).toContain("SECURITY_COMPLETED");
  });
});
