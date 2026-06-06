import { describe, expect, it } from "vitest";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  deriveCodeTaskRunPhase,
  deriveCodeTaskRunProgressSteps,
  deriveCodeTaskRunStatusLabel,
} from "@/lib/prototype/codeTaskRunDerivedView";
import { patchRunWithQualityOutcome } from "@/lib/prototype/codeTaskQualityOutcome";
import { isCodeTaskRunPreviewIncluded } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import {
  buildImplementationRuntimeQueueFromLegacy,
  selectNextRunnableCodeTaskRun,
} from "@/lib/prototype/implementationRuntimeQueueModel";
import {
  isCursorSessionStaleForRun,
  mapTaskCursorExecutionToCursorSession,
} from "@/lib/prototype/cursorSessionModel";
import { diagnoseImplementationRuntimeState } from "@/lib/prototype/implementationRuntimeStateDiagnostics";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";

function run(partial: Partial<CodeTaskExecutionRunV1>): CodeTaskExecutionRunV1 {
  return {
    runId: partial.runId ?? "run-1",
    version: "code_task_execution_run_v1",
    projectId: "p1",
    processTaskId: partial.processTaskId ?? "DEV-MOCK-001",
    workItemId: "wi-1",
    codeTaskId: partial.codeTaskId ?? "CODE-1",
    status: partial.status ?? "queued",
    attemptNo: 1,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...partial,
  };
}

describe("P3-M41 deriveCodeTaskRunPhase", () => {
  it("completed run is completed phase", () => {
    expect(
      deriveCodeTaskRunPhase({
        run: run({ status: "completed", commitSha: "abc" }),
      }),
    ).toBe("completed");
  });

  it("github verified run shows github_verified phase", () => {
    expect(
      deriveCodeTaskRunPhase({
        run: run({
          status: "github_verified",
          commitSha: "abc",
          githubOutcome: {
            status: "verified",
            checkedAt: "2026-06-04T00:00:00.000Z",
            workBranch: "wip/x",
            commitSha: "abc",
            source: "github_rest",
          },
        }),
      }),
    ).toBe("github_verified");
  });

  it("stale cursor github_verifying does not override verified run", () => {
    expect(
      deriveCodeTaskRunPhase({
        run: run({
          status: "github_verified",
          githubOutcome: {
            status: "verified",
            checkedAt: "2026-06-04T00:00:00.000Z",
            workBranch: "wip/x",
            commitSha: "abc",
            source: "github_rest",
          },
        }),
        cursorSession: {
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          status: "github_verifying",
        } as TaskCursorExecutionV1,
      }),
    ).toBe("github_verified");
  });

  it("quality passed run shows completed phase when run completed", () => {
    const r = run({
      status: "completed",
      commitSha: "abc",
      qualityOutcome: { status: "passed", checkedAt: "2026-06-04T00:00:00.000Z" },
    });
    expect(deriveCodeTaskRunPhase({ run: r })).toBe("completed");
  });
});

describe("P3-M41 queue selector", () => {
  it("does not select completed run as next", () => {
    const runs = [
      run({ runId: "r1", codeTaskId: "C1", status: "completed", commitSha: "a" }),
      run({ runId: "r2", codeTaskId: "C2", status: "prompt_ready" }),
    ];
    const queue = buildImplementationRuntimeQueueFromLegacy({
      queue: startCodeTaskExecutionQueue({
        projectId: "p1",
        selectedCodeTaskIds: ["C1", "C2"],
      }),
      runs,
    });
    expect(selectNextRunnableCodeTaskRun({ queue, runs })?.runId).toBe("r2");
  });

  it("does not select github_verified as next runnable", () => {
    const runs = [run({ runId: "r1", codeTaskId: "C1", status: "github_verified", commitSha: "a" })];
    const queue = buildImplementationRuntimeQueueFromLegacy({
      queue: startCodeTaskExecutionQueue({ projectId: "p1", selectedCodeTaskIds: ["C1"] }),
      runs,
    });
    expect(selectNextRunnableCodeTaskRun({ queue, runs })).toBeNull();
  });
});

describe("P3-M41 integration preview", () => {
  it("includes completed run with commit", () => {
    expect(isCodeTaskRunPreviewIncluded(run({ status: "completed", commitSha: "abc" }))).toBe(true);
  });

  it("excludes github_verified only", () => {
    expect(
      isCodeTaskRunPreviewIncluded(
        run({
          status: "github_verified",
          commitSha: "abc",
          githubOutcome: {
            status: "verified",
            checkedAt: "2026-06-04T00:00:00.000Z",
            workBranch: "wip/x",
            commitSha: "abc",
            source: "github_rest",
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("P3-M41 quality outcome on run", () => {
  it("patch sets completed when gate passed", () => {
    const patch = patchRunWithQualityOutcome({
      run: run({ status: "github_verified", commitSha: "abc" }),
      qualityOutcome: { status: "passed", checkedAt: "2026-06-04T00:00:00.000Z" },
      nowIso: "2026-06-04T00:00:00.000Z",
    });
    expect(patch.status).toBe("completed");
  });
});

describe("P3-M41 diagnostics", () => {
  it("flags stale cursor session after run completed", () => {
    const runs = [run({ runId: "r1", status: "completed", commitSha: "abc" })];
    const session = mapTaskCursorExecutionToCursorSession({
      projectId: "p1",
      taskId: "DEV-MOCK-001",
      status: "cursor_running",
      cursorRunId: "r1",
      workItemIds: [],
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    } as TaskCursorExecutionV1);
    const issues = diagnoseImplementationRuntimeState({
      runs,
      queue: buildImplementationRuntimeQueueFromLegacy({ queue: null, runs }),
      cursorSessions: session ? [session] : [],
    });
    expect(issues.some((i) => i.code === "cursor_session_stale_after_run_completed")).toBe(true);
  });
});

describe("P3-M41 progress steps", () => {
  it("github_verified phase marks gate step active", () => {
    const steps = deriveCodeTaskRunProgressSteps({
      run: run({
        status: "github_verified",
        commitSha: "abc",
        githubOutcome: {
          status: "verified",
          checkedAt: "2026-06-04T00:00:00.000Z",
          workBranch: "wip/x",
          commitSha: "abc",
          source: "github_rest",
        },
      }),
    });
    expect(steps.find((s) => s.id === "github_verifying")?.state).toBe("done");
    expect(steps.find((s) => s.id === "lightweight_checking")?.state).toBe("active");
  });
});

describe("P3-M41 cursor session stale", () => {
  it("detects stale github_verifying when run verified", () => {
    const session = mapTaskCursorExecutionToCursorSession({
      projectId: "p1",
      taskId: "T",
      status: "github_verifying",
      workItemIds: [],
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    } as TaskCursorExecutionV1);
    expect(
      isCursorSessionStaleForRun({
        session,
        run: run({
          githubOutcome: {
            status: "verified",
            checkedAt: "2026-06-04T00:00:00.000Z",
            workBranch: "wip/x",
            commitSha: "abc",
            source: "github_rest",
          },
          commitSha: "abc",
        }),
      }),
    ).toBe(true);
  });
});

describe("P3-M41 status label", () => {
  it("uses run-derived detail for verified github", () => {
    const label = deriveCodeTaskRunStatusLabel({
      run: run({
        status: "github_verified",
        githubOutcome: {
          status: "verified",
          checkedAt: "2026-06-04T00:00:00.000Z",
          workBranch: "wip/x",
          commitSha: "abc",
          source: "github_rest",
        },
      }),
    });
    expect(label.detail).toContain("GitHub commit 확인 완료");
  });
});
