import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_QUEUE_VERSION } from "@/lib/prototype/codeTaskExecutionQueue";
import { buildCodeTaskExecutionQueueSnapshotFromDbJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";

describe("buildCodeTaskExecutionQueueSnapshotFromDbJob", () => {
  it("derives queue snapshot from job.selectedCodeTaskIds and runs", () => {
    const snapshot = buildCodeTaskExecutionQueueSnapshotFromDbJob({
      bundle: {
        job: {
          id: "job-1",
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
          id: "run-b",
          projectId: "p1",
          jobId: "job-1",
          codeTaskId: "CODE-B",
          runtimeState: "queued",
          cursorAgentId: null,
          branchName: null,
          commitSha: null,
          pullRequestUrl: null,
          failureReason: null,
          lastHeartbeatAt: null,
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-06-04T00:00:00.000Z",
        },
        runs: [
          {
            id: "run-a",
            projectId: "p1",
            jobId: "job-1",
            codeTaskId: "CODE-A",
            runtimeState: "completed",
            cursorAgentId: "agent",
            branchName: null,
            commitSha: "abc",
            pullRequestUrl: null,
            failureReason: null,
            lastHeartbeatAt: null,
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
          {
            id: "run-b",
            projectId: "p1",
            jobId: "job-1",
            codeTaskId: "CODE-B",
            runtimeState: "queued",
            cursorAgentId: null,
            branchName: null,
            commitSha: null,
            pullRequestUrl: null,
            failureReason: null,
            lastHeartbeatAt: null,
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        ],
      },
      nowIso: "2026-06-04T12:00:00.000Z",
    });

    expect(snapshot?.version).toBe(CODE_TASK_EXECUTION_QUEUE_VERSION);
    expect(snapshot?.selectedCodeTaskIds).toEqual(["CODE-A", "CODE-B", "CODE-C"]);
    expect(snapshot?.currentIndex).toBe(1);
    expect(snapshot?.status).toBe("running");
  });
});
