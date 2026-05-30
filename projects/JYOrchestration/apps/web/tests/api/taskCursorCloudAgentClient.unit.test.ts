import { describe, expect, it, vi } from "vitest";
import type { TaskCursorApiExecuteRequest } from "@/lib/prototype/taskCursorApiClient";

vi.mock("@/lib/execution/cursorExecutionAdapter", () => ({
  launchCursorAgent: vi.fn(),
  pollCursorAgent: vi.fn(async () => ({
    ok: true,
    statusUpper: "FINISHED",
    result: {
      runId: "bc-test",
      summary: "Done",
      changedFiles: [],
      branchName: "wip/cursor/dev-mock-001",
      executionStatus: "succeeded",
    },
  })),
}));

import { pollTaskCursorCloudAgentStep } from "@/lib/prototype/taskCursorCloudAgentClient";

const baseRequest: TaskCursorApiExecuteRequest = {
  projectId: "p1",
  taskId: "DEV-MOCK-001",
  workItemIds: ["wi-1"],
  workItems: [],
  cursorApiUrl: "https://api.cursor.com",
  cursorApiToken: "cursor-token",
  targetRepository: {
    repoFullName: "owner/repo",
    gitRepoUrl: "https://github.com/owner/repo",
    defaultBranch: "main",
    provider: "github",
  },
  workspacePath: "/tmp/repo",
  baseBranch: "main",
  workBranch: "wip/cursor/dev-mock-001",
  commitMessage: "wip",
  prompt: "implement mock",
  allowedPathGlobs: ["src/**"],
};

describe("pollTaskCursorCloudAgentStep", () => {
  it("defers commit discovery to GitHub when agent finishes without commit metadata", async () => {
    const step = await pollTaskCursorCloudAgentStep({ request: baseRequest, agentId: "bc-test" });
    expect(step.kind).toBe("completed");
    if (step.kind === "completed") {
      expect(step.result.ok).toBe(true);
      expect(step.result.commitSha).toBeUndefined();
      expect(step.result.testResults?.[0]).toContain("GitHub branch");
    }
  });
});
