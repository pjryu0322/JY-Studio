import { describe, expect, it } from "vitest";

import { buildTeamRuntimeAdditiveFields } from "@/lib/ai-team-runtime/apiTeamRuntime";

describe("buildTeamRuntimeAdditiveFields", () => {
  it("passes task context into timeline approval stage", () => {
    const fields = buildTeamRuntimeAdditiveFields(
      { id: "run-1", status: "running" },
      true,
      { executionWorkflowStatus: "awaiting_human" }
    );

    expect(fields.teamRuntime.timeline?.find((t) => t.id === "approval")?.status).toBe("blocked");
  });

  it("includes startedAt and completedAt on timeline items", () => {
    const fields = buildTeamRuntimeAdditiveFields(
      {
        id: "run-1",
        status: "running",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        branchName: "feat/x",
        commitSha: "abc1234567890",
      },
      false
    );

    const git = fields.teamRuntime.timeline?.find((t) => t.id === "git");
    expect(git?.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(git?.completedAt).toBeTruthy();
  });
});
