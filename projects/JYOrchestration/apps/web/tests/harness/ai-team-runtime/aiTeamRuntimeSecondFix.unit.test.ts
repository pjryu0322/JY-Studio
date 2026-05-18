import { describe, expect, it } from "vitest";

import { parsePrStatusForTeamRuntime } from "@/lib/ai-team-runtime/prStatusParse";
import { buildTeamRuntimeSummaryFromRun } from "@/lib/ai-team-runtime/serialize";
import { AI_TEAM_EXECUTION_STATUS } from "@/lib/ai-team-runtime/status";
import { canTeamExecutionTransition } from "@/lib/ai-team-runtime/transition";

describe("ai-team-runtime second fix", () => {
  it("parses open:N:url prStatus for teamRuntime.pr", () => {
    const pr = parsePrStatusForTeamRuntime("open:13:https://github.com/org/repo/pull/13");
    expect(pr?.pullRequestNumber).toBe(13);
    expect(pr?.pullRequestUrl).toBe("https://github.com/org/repo/pull/13");
    expect(pr?.pullRequestState).toBe("OPEN");
  });

  it("buildTeamRuntimeSummaryFromRun includes pr from prStatus", () => {
    const summary = buildTeamRuntimeSummaryFromRun({
      status: "reviewing",
      teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
      prStatus: "open:42:https://github.com/a/b/pull/42",
    });
    expect(summary.pr?.pullRequestNumber).toBe(42);
    expect(summary.approval.status).toBe("waiting");
  });

  it("forbids security_failed to approval_waiting", () => {
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED,
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING
      )
    ).toBe(false);
    expect(
      canTeamExecutionTransition(AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED, AI_TEAM_EXECUTION_STATUS.FAILED)
    ).toBe(true);
  });

  it("allows approval_waiting to merge_running only after explicit approval path", () => {
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
        AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING
      )
    ).toBe(true);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING,
        AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING
      )
    ).toBe(false);
  });

  it("maps merged prStatus", () => {
    expect(parsePrStatusForTeamRuntime("merged")?.pullRequestState).toBe("MERGED");
  });
});
