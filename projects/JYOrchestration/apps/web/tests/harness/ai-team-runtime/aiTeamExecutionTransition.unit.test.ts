import { describe, expect, it } from "vitest";

import { parseOpenPrStatus, parsePrStatusForTeamRuntime } from "@/lib/ai-team-runtime/prStatusParse";
import { canResumeTeamRuntimeMerge } from "@/lib/ai-team-runtime/roleSeparatedMergeResume";
import { buildTeamRuntimeSummaryFromRun } from "@/lib/ai-team-runtime/serialize";
import { AI_TEAM_EXECUTION_STATUS } from "@/lib/ai-team-runtime/status";
import {
  assertTeamExecutionTransition,
  canTeamExecutionTransition,
} from "@/lib/ai-team-runtime/transition";

describe("ai-team-runtime transitions", () => {
  it("allows happy path transitions", () => {
    expect(
      canTeamExecutionTransition(AI_TEAM_EXECUTION_STATUS.REQUESTED, AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING)
    ).toBe(true);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING,
        AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING
      )
    ).toBe(true);
    expect(
      canTeamExecutionTransition(AI_TEAM_EXECUTION_STATUS.REVIEW_RUNNING, AI_TEAM_EXECUTION_STATUS.SECURITY_RUNNING)
    ).toBe(true);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.SECURITY_RUNNING,
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING
      )
    ).toBe(true);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
        AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING
      )
    ).toBe(true);
    expect(
      canTeamExecutionTransition(AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING, AI_TEAM_EXECUTION_STATUS.COMPLETED)
    ).toBe(true);
  });

  it("forbids illegal shortcuts", () => {
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING,
        AI_TEAM_EXECUTION_STATUS.COMPLETED
      )
    ).toBe(false);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING,
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING
      )
    ).toBe(false);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.SECURITY_FAILED,
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING
      )
    ).toBe(false);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
        AI_TEAM_EXECUTION_STATUS.COMPLETED
      )
    ).toBe(false);
    expect(
      canTeamExecutionTransition(
        AI_TEAM_EXECUTION_STATUS.REQUESTED,
        "not_a_real_status" as typeof AI_TEAM_EXECUTION_STATUS.REQUESTED
      )
    ).toBe(false);
  });

  it("assertTeamExecutionTransition throws on invalid transition", () => {
    expect(() =>
      assertTeamExecutionTransition(AI_TEAM_EXECUTION_STATUS.DEVELOPER_RUNNING, AI_TEAM_EXECUTION_STATUS.COMPLETED)
    ).toThrow(/invalid_transition/);
  });
});

describe("ai-team-runtime fourth fix helpers", () => {
  it("parseOpenPrStatus extracts url and number", () => {
    const open = parseOpenPrStatus("open:13:https://github.com/a/b/pull/13");
    expect(open?.pullRequestNumber).toBe(13);
    expect(open?.pullRequestUrl).toBe("https://github.com/a/b/pull/13");
    expect(parsePrStatusForTeamRuntime("merged")?.pullRequestState).toBe("MERGED");
  });

  it("parses open:<url> prStatus with number from URL path", () => {
    const openUrlOnly = parseOpenPrStatus("open:https://github.com/a/b/pull/13");
    expect(openUrlOnly?.pullRequestNumber).toBe(13);
    expect(openUrlOnly?.pullRequestUrl).toBe("https://github.com/a/b/pull/13");

    const parsed = parsePrStatusForTeamRuntime("open:https://github.com/a/b/pull/13");
    expect(parsed?.pullRequestState).toBe("OPEN");
    expect(parsed?.pullRequestNumber).toBe(13);
    expect(parsed?.pullRequestUrl).toBe("https://github.com/a/b/pull/13");
  });

  it("canResumeTeamRuntimeMerge requires merge_pending and merge_running", () => {
    expect(
      canResumeTeamRuntimeMerge({
        singleTaskId: "task1",
        isEnvTestTask: false,
        workflowStatus: "merge_pending",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
      })
    ).toBe(true);
    expect(
      canResumeTeamRuntimeMerge({
        singleTaskId: "task1",
        isEnvTestTask: false,
        workflowStatus: "merge_pending",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING,
      })
    ).toBe(false);
    expect(
      canResumeTeamRuntimeMerge({
        singleTaskId: "task1",
        isEnvTestTask: true,
        workflowStatus: "merge_pending",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
      })
    ).toBe(false);
    expect(
      canResumeTeamRuntimeMerge({
        singleTaskId: null,
        isEnvTestTask: false,
        workflowStatus: "merge_pending",
        teamExecutionStatus: AI_TEAM_EXECUTION_STATUS.MERGE_RUNNING,
      })
    ).toBe(false);
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
});
