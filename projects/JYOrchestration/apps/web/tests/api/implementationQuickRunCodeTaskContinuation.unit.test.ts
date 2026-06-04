import { describe, expect, it } from "vitest";
import {
  CODE_TASK_EXECUTION_QUEUE_VERSION,
  type CodeTaskExecutionQueueV1,
} from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import {
  buildImplementationQuickRunStartedPatch,
  type ImplementationQuickRunV1,
} from "@/lib/prototype/implementationQuickRun";
import {
  planQuickRunCodeTaskContinuationAfterAutoGate,
  resolveNextQuickRunCodeTaskId,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("implementationQuickRunCodeTaskContinuation", () => {
  const queue: CodeTaskExecutionQueueV1 = {
    version: CODE_TASK_EXECUTION_QUEUE_VERSION,
    projectId: "p1",
    selectedCodeTaskIds: ["CODE-A", "CODE-B", "CODE-C"],
    currentIndex: 0,
    status: "running",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    stopOnFailure: true,
  };

  it("resolveNextQuickRunCodeTaskId prefers DB queued current run", () => {
    const next = resolveNextQuickRunCodeTaskId({
      queue,
      completedCodeTaskId: "CODE-A",
      dbBundle: {
        job: {
          id: "j1",
          projectId: "p1",
          status: "running",
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
          runtimeState: "queued",
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
      },
    });
    expect(next).toBe("CODE-B");
  });

  it("plan returns null when auto gate not passed", () => {
    const quickRun: ImplementationQuickRunV1 = buildImplementationQuickRunStartedPatch({
      projectId: "p1",
      selectedTaskIds: ["T-A", "T-B"],
    });
    const execution = {
      projectId: "p1",
      taskId: "T-A",
      status: "scm_pending",
      commitSha: "abc123",
    } as TaskCursorExecutionV1;
    const autoGate = {
      version: 1,
      projectId: "p1",
      taskId: "T-A",
      status: "review_running",
    } as ImplementationAutoQualityGateV1;

    const plan = planQuickRunCodeTaskContinuationAfterAutoGate({
      projectId: "p1",
      quickRun,
      taskCursorExecution: execution,
      autoGate,
      queue,
      runs: [],
      baseState: {},
    });
    expect(plan).toBeNull();
  });
});
