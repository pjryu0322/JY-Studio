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
  resolveCompletedCodeTaskId,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import { resolveNextQuickRunCodeTaskId } from "@/lib/prototype/implementationSelectedCodeTaskSequence";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("implementationQuickRunCodeTaskContinuation", () => {
  it("resolveNextQuickRunCodeTaskId returns next id in job selection after completion", () => {
    const next = resolveNextQuickRunCodeTaskId({
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

  it("resolveCompletedCodeTaskId uses DB job current when cursorRunId is missing on JSON run", () => {
    const execution = {
      projectId: "p1",
      taskId: "DEV-FEATURE-001",
      status: "scm_pending",
      commitSha: "96839e1a",
    } as TaskCursorExecutionV1;
    const resolved = resolveCompletedCodeTaskId({
      execution,
      runs: [],
      dbBundle: {
        job: {
          id: "j1",
          projectId: "p1",
          status: "running",
          currentCodeTaskId: "CODE-DEV-FEATURE-001-001",
          selectedCodeTaskIds: [
            "CODE-DEV-FEATURE-001-001",
            "CODE-DEV-FRAME-001-001",
          ],
          failureReason: null,
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-06-05T00:00:00.000Z",
        },
        currentRun: {
          id: "r1",
          projectId: "p1",
          jobId: "j1",
          codeTaskId: "CODE-DEV-FEATURE-001-001",
          runtimeState: "completed",
          cursorAgentId: "agent-1",
          branchName: "wip/x",
          commitSha: "96839e1a",
          pullRequestUrl: null,
          failureReason: null,
          startedAt: null,
          lastHeartbeatAt: null,
          completedAt: "2026-06-05T00:00:00.000Z",
        },
        runs: [],
      },
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        projectId: "p1",
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
        tasks: [
          {
            codeTaskId: "CODE-DEV-FEATURE-001-001",
            parentTaskId: "DEV-FEATURE-001",
            title: "Feature",
            description: "",
            changeType: "feature",
            acceptanceCriteria: [],
            verificationHints: [],
            forbiddenPaths: [],
            candidateFiles: [],
          },
        ],
      },
    });
    expect(resolved).toBe("CODE-DEV-FEATURE-001-001");
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
      runs: [],
      baseState: {},
    });
    expect(plan).toBeNull();
  });
});
