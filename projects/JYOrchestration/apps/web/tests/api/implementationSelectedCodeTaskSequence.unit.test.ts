import { describe, expect, it } from "vitest";
import {
  CODE_TASK_EXECUTION_QUEUE_VERSION,
  type CodeTaskExecutionQueueV1,
} from "@/lib/prototype/codeTaskExecutionQueue";
import {
  resolveNextCodeTaskIdAfterCompletion,
  resolveNextQuickRunCodeTaskId,
  resolveSelectedCodeTaskIdsForContinuation,
} from "@/lib/prototype/implementationSelectedCodeTaskSequence";

describe("implementationSelectedCodeTaskSequence", () => {
  const jobBundle = {
    job: {
      id: "j1",
      projectId: "p1",
      status: "running" as const,
      currentCodeTaskId: "CODE-B",
      selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
      failureReason: null,
      startedAt: null,
      completedAt: null,
      updatedAt: "2026-06-04T00:00:00.000Z",
    },
    currentRun: {
      id: "r2",
      projectId: "p1",
      jobId: "j1",
      codeTaskId: "CODE-B",
      runtimeState: "queued" as const,
      cursorAgentId: null,
      branchName: null,
      commitSha: null,
      pullRequestUrl: null,
      failureReason: null,
      startedAt: null,
      lastHeartbeatAt: null,
      completedAt: null,
    },
    runs: [],
  };

  it("resolveNextCodeTaskIdAfterCompletion walks job selection order", () => {
    expect(
      resolveNextCodeTaskIdAfterCompletion({
        selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
        completedCodeTaskId: "CODE-A",
      }),
    ).toBe("CODE-B");
    expect(
      resolveNextCodeTaskIdAfterCompletion({
        selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
        completedCodeTaskId: "CODE-C",
      }),
    ).toBeNull();
  });

  it("resolveSelectedCodeTaskIdsForContinuation prefers job over partial JSON queue", () => {
    const partialQueue: CodeTaskExecutionQueueV1 = {
      version: CODE_TASK_EXECUTION_QUEUE_VERSION,
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A"],
      currentIndex: 0,
      status: "running",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      stopOnFailure: true,
    };
    expect(
      resolveSelectedCodeTaskIdsForContinuation({
        dbBundle: jobBundle,
        legacyQueue: partialQueue,
      }),
    ).toEqual(["CODE-A", "CODE-B", "CODE-C"]);
  });

  it("resolveNextQuickRunCodeTaskId uses job selection only when job exists", () => {
    const partialQueue: CodeTaskExecutionQueueV1 = {
      version: CODE_TASK_EXECUTION_QUEUE_VERSION,
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A"],
      currentIndex: 0,
      status: "running",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      stopOnFailure: true,
    };
    expect(
      resolveNextQuickRunCodeTaskId({
        completedCodeTaskId: "CODE-A",
        dbBundle: jobBundle,
        queue: partialQueue,
      }),
    ).toBe("CODE-B");
  });

  it("resolveNextQuickRunCodeTaskId uses JSON queue when no job selection", () => {
    const queue: CodeTaskExecutionQueueV1 = {
      version: CODE_TASK_EXECUTION_QUEUE_VERSION,
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A", "CODE-B"],
      currentIndex: 0,
      status: "running",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      stopOnFailure: true,
    };
    expect(
      resolveNextQuickRunCodeTaskId({
        completedCodeTaskId: "CODE-A",
        dbBundle: { job: null, currentRun: null, runs: [] },
        queue,
      }),
    ).toBe("CODE-B");
  });
});
