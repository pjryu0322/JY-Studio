import { describe, expect, it } from "vitest";
import { shouldShowManualGithubVerifyRetry } from "@/lib/prototype/implementationCodeTaskGithubVerifyRetryUi";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import { CODE_TASK_EXECUTION_QUEUE_VERSION } from "@/lib/prototype/codeTaskExecutionQueue";

describe("shouldShowManualGithubVerifyRetry", () => {
  it("shows when queue is running and current run is github_verifying", () => {
    expect(
      shouldShowManualGithubVerifyRetry({
        queue: {
          version: CODE_TASK_EXECUTION_QUEUE_VERSION,
          status: "running",
          selectedCodeTaskIds: ["ct-1"],
          currentIndex: 0,
        },
        runs: [
          {
            version: CODE_TASK_EXECUTION_RUN_VERSION,
            runId: "r1",
            projectId: "p1",
            processTaskId: "t1",
            workItemId: "w1",
            codeTaskId: "ct-1",
            status: "github_verifying",
            attemptNo: 1,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        currentCodeTaskId: "ct-1",
        taskCursor: null,
      }),
    ).toBe(true);
  });

  it("hides when queue is idle", () => {
    expect(
      shouldShowManualGithubVerifyRetry({
        queue: {
          version: CODE_TASK_EXECUTION_QUEUE_VERSION,
          status: "idle",
          selectedCodeTaskIds: [],
          currentIndex: 0,
        },
        runs: [],
        currentCodeTaskId: "ct-1",
        taskCursor: { status: "github_verifying" } as never,
      }),
    ).toBe(false);
  });
});
