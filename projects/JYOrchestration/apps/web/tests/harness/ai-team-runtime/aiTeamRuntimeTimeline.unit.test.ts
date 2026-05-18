import { describe, expect, it } from "vitest";

import { AI_TEAM_EXECUTION_STATUS } from "@/lib/ai-team-runtime/status";
import { buildAiTeamRuntimeTimeline } from "@/lib/ai-team-runtime/timeline";

function stageIds(timeline: ReturnType<typeof buildAiTeamRuntimeTimeline>) {
  return timeline.map((t) => t.id);
}

describe("buildAiTeamRuntimeTimeline", () => {
  it("returns 7 stages in fixed order for empty run", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: { id: "run-1" },
    });
    expect(stageIds(timeline)).toEqual([
      "developer",
      "git",
      "review",
      "security",
      "approval",
      "scm",
      "completion",
    ]);
    expect(timeline.every((t) => t.titleKo.length > 0)).toBe(true);
  });

  it("marks developer and git succeeded when branch/commit/changedFiles exist", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        branchName: "feat/x",
        commitSha: "abc1234567890",
        changedFiles: ["a.ts"],
        cursorRunId: "cursor-1",
      },
    });
    expect(timeline.find((t) => t.id === "developer")?.status).toBe("succeeded");
    expect(timeline.find((t) => t.id === "git")?.status).toBe("succeeded");
    expect(timeline.find((t) => t.id === "git")?.changedFileCount).toBe(1);
  });

  it("parses prStatus into git/scm PR fields", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        prStatus: "open:13:https://github.com/a/b/pull/13",
        commitSha: "sha",
      },
    });
    const git = timeline.find((t) => t.id === "git");
    expect(git?.prNumber).toBe(13);
    expect(git?.prUrl).toBe("https://github.com/a/b/pull/13");
  });

  it("blocks approval when teamExecutionStatus is approval_waiting", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
        evaluationReason: "승인 대기",
      },
      requireApproval: true,
    });
    expect(timeline.find((t) => t.id === "approval")?.status).toBe("blocked");
    expect(timeline.find((t) => t.id === "approval")?.blockReason).toContain("승인");
  });

  it("shows approval succeeded and scm running for merge_running", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
        commitSha: "sha",
      },
      requireApproval: true,
    });
    expect(timeline.find((t) => t.id === "approval")?.status).toBe("succeeded");
    expect(timeline.find((t) => t.id === "scm")?.status).toBe("running");
  });

  it("shows scm blocked when evaluationReason has SCM hold", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
        evaluationReason: "auto-merge disabled: policy",
      },
      task: { executionWorkflowStatus: "merge_pending" },
    });
    expect(timeline.find((t) => t.id === "scm")?.status).toBe("blocked");
    expect(timeline.find((t) => t.id === "scm")?.blockReason).toContain("auto-merge");
  });

  it("marks completion succeeded when teamExecutionStatus is completed", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.COMPLETED,
        status: "done",
      },
    });
    expect(timeline.find((t) => t.id === "completion")?.status).toBe("succeeded");
  });

  it("marks completion failed when runError is set", () => {
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.FAILED,
        runError: "cursor failed",
        status: "failed",
      },
    });
    expect(timeline.find((t) => t.id === "completion")?.status).toBe("failed");
    expect(timeline.find((t) => t.id === "completion")?.blockReason).toContain("cursor");
  });

  it("does not throw on malformed evaluationReviewerSteps", () => {
    expect(() =>
      buildAiTeamRuntimeTimeline({
        run: {
          id: "run-1",
          evaluationReviewerSteps: [{ bad: true }, null, "x"],
          teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING,
        },
      })
    ).not.toThrow();
    const timeline = buildAiTeamRuntimeTimeline({
      run: {
        id: "run-1",
        evaluationReviewerSteps: [{ bad: true }, null, "x"],
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING,
      },
    });
    expect(timeline.find((t) => t.id === "review")?.status).toBe("running");
    expect(timeline).toHaveLength(7);
  });
});
