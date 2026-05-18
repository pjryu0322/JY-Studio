import { describe, expect, it } from "vitest";

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
      canTeamExecutionTransition(AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING, AI_TEAM_EXECUTION_STATUS.COMPLETED)
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
