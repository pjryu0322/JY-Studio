import { describe, expect, it } from "vitest";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  applyQualityOutcomeToCodeTaskRun,
  applyQualityGateRunningToRunsList,
  applyAutoGateOutcomeToRunsList,
  patchRunForQualityGateRunning,
} from "@/lib/prototype/codeTaskQualityOutcome";
import { deriveCodeTaskExecutionFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { isCodeTaskRunPreviewIncluded } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import {
  findNextRunnableCodeTaskIdInSelection,
  selectNextRunnableCodeTaskRun,
  buildImplementationRuntimeQueueFromLegacy,
} from "@/lib/prototype/implementationRuntimeQueueModel";
import {
  diagnoseImplementationRuntimeState,
  logImplementationRuntimeStateDiagnostics,
} from "@/lib/prototype/implementationRuntimeStateDiagnostics";
import { hasAutoQualityGatePassedForTask } from "@/lib/prototype/taskCursorQuickRunInflightPolicy";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const NOW = "2026-06-04T00:00:00.000Z";

function run(partial: Partial<CodeTaskExecutionRunV1>): CodeTaskExecutionRunV1 {
  return {
    runId: partial.runId ?? "run-1",
    version: "code_task_execution_run_v1",
    projectId: "p1",
    processTaskId: partial.processTaskId ?? "DEV-A",
    workItemId: "wi-1",
    codeTaskId: partial.codeTaskId ?? "CT-1",
    status: partial.status ?? "queued",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe("P3-M42 quality gate → completed on run", () => {
  it("applyQualityOutcomeToCodeTaskRun promotes to completed", () => {
    const updated = applyQualityOutcomeToCodeTaskRun({
      run: run({ status: "quality_gate_running", commitSha: "abc" }),
      qualityOutcome: { status: "passed", checkedAt: NOW },
      nowIso: NOW,
    });
    expect(updated.status).toBe("completed");
    expect(updated.qualityOutcome?.status).toBe("passed");
    expect(updated.completedAt).toBe(NOW);
  });

  it("quality_gate_running patch before gate", () => {
    const patch = patchRunForQualityGateRunning({
      run: run({ status: "github_verified", commitSha: "abc" }),
      nowIso: NOW,
    });
    expect(patch.status).toBe("quality_gate_running");
  });
});

describe("P3-M42 flow phase run-only", () => {
  it("github_verified without quality stays github_verified even if autoGate passed", () => {
    const autoGate: ImplementationAutoQualityGateV1 = {
      version: "implementation_auto_quality_gate_v1",
      projectId: "p1",
      taskId: "DEV-A",
      sourceCommitSha: "abc",
      changedFiles: [],
      status: "passed",
      startedAt: NOW,
      updatedAt: NOW,
    };
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-A",
      autoGate,
      latestRun: run({
        status: "github_verified",
        commitSha: "abc",
        githubOutcome: {
          status: "verified",
          checkedAt: NOW,
          workBranch: "wip/x",
          commitSha: "abc",
          source: "github_rest",
        },
      }),
    });
    expect(phase).toBe("github_verified");
  });

  it("quality_gate_running maps to lightweight_checking", () => {
    expect(
      deriveCodeTaskExecutionFlowPhase({
        parentTaskId: "DEV-A",
        latestRun: run({ status: "quality_gate_running", commitSha: "abc" }),
      }),
    ).toBe("lightweight_checking");
  });
});

describe("P3-M42 integration preview run-only", () => {
  it("excludes github_verified with verified outcome only", () => {
    expect(
      isCodeTaskRunPreviewIncluded(
        run({
          status: "github_verified",
          commitSha: "abc",
          githubOutcome: {
            status: "verified",
            checkedAt: NOW,
            workBranch: "wip/x",
            commitSha: "abc",
            source: "github_rest",
          },
        }),
      ),
    ).toBe(false);
  });

  it("includes completed with quality outcome", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list" as const,
      tasks: [
        {
          codeTaskId: "CT-1",
          parentTaskId: "DEV-A",
          title: "Shell",
          description: "",
          changeType: "screen" as const,
          targetHints: [],
          dependencies: [],
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
        },
      ],
      readiness: { ready: true, missing: [] },
    };
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan,
      taskList: null,
      codeTaskRuns: [
        run({
          status: "completed",
          commitSha: "abc",
          qualityOutcome: { status: "passed", checkedAt: NOW },
        }),
      ],
    });
    expect(result.included).toHaveLength(1);
  });
});

describe("P3-M42 EventLog-only legacy", () => {
  it("hasAutoQualityGatePassedForTask ignores timeline without run quality", () => {
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        action: "implementation_auto_quality_gate_passed",
        fields: { taskId: "DEV-A" },
        createdAt: NOW,
        responseText: "",
      },
    ];
    expect(
      hasAutoQualityGatePassedForTask({
        taskId: "DEV-A",
        promptTimeline: timeline,
        runs: [
          run({
            status: "github_verified",
            commitSha: "abc",
          }),
        ],
        codeTaskId: "CT-1",
      }),
    ).toBe(false);
  });

  it("diagnostics flags event passed without run completion", () => {
    const r = run({
      status: "github_verified",
      commitSha: "abc",
    });
    const issues = diagnoseImplementationRuntimeState({
      runs: [r],
      queue: buildImplementationRuntimeQueueFromLegacy({ queue: null, runs: [r] }),
      cursorSessions: [],
      events: [
        {
          type: "implementation_auto_quality_gate_passed",
          codeTaskId: "CT-1",
          runId: "run-1",
          at: NOW,
        },
      ],
    });
    expect(issues.some((i) => i.code === "event_completed_but_run_not_completed")).toBe(true);
  });
});

describe("P3-M42 queue next runnable", () => {
  it("skips github_verified for next dispatch", () => {
    const runs = [
      run({ runId: "r1", codeTaskId: "C1", status: "github_verified", commitSha: "a" }),
      run({ runId: "r2", codeTaskId: "C2", status: "prompt_ready" }),
    ];
    const queue = buildImplementationRuntimeQueueFromLegacy({
      queue: startCodeTaskExecutionQueue({ projectId: "p1", selectedCodeTaskIds: ["C1", "C2"] }),
      runs,
    });
    expect(selectNextRunnableCodeTaskRun({ queue, runs })?.codeTaskId).toBe("C2");
  });

  it("findNextRunnableCodeTaskIdInSelection skips terminal runs", () => {
    const runs = [
      run({ codeTaskId: "C1", status: "completed", commitSha: "a", qualityOutcome: { status: "passed", checkedAt: NOW } }),
      run({ codeTaskId: "C2", status: "prompt_ready" }),
    ];
    expect(
      findNextRunnableCodeTaskIdInSelection({
        selectedCodeTaskIds: ["C1", "C2"],
        afterCodeTaskId: "C1",
        runs,
      }),
    ).toBe("C2");
  });
});

describe("P3-M42 auto gate outcome on runs list", () => {
  it("applyAutoGateOutcomeToRunsList sets completed", () => {
    const runs = [run({ status: "quality_gate_running", commitSha: "abc" })];
    const autoGate: ImplementationAutoQualityGateV1 = {
      version: "implementation_auto_quality_gate_v1",
      projectId: "p1",
      taskId: "DEV-A",
      sourceCommitSha: "abc",
      changedFiles: [],
      status: "passed",
      startedAt: NOW,
      updatedAt: NOW,
      completedAt: NOW,
    };
    const next = applyAutoGateOutcomeToRunsList({
      runs,
      codeTaskId: "CT-1",
      autoGate,
      nowIso: NOW,
    });
    expect(next[0]?.status).toBe("completed");
  });

  it("applyQualityGateRunningToRunsList", () => {
    const next = applyQualityGateRunningToRunsList({
      runs: [run({ status: "github_verified", commitSha: "abc" })],
      codeTaskId: "CT-1",
      nowIso: NOW,
    });
    expect(next[0]?.status).toBe("quality_gate_running");
  });
});

describe("P3-M42 diagnostics log", () => {
  it("logImplementationRuntimeStateDiagnostics is callable", () => {
    expect(() =>
      logImplementationRuntimeStateDiagnostics([
        {
          code: "run_completed_without_qualityOutcome",
          message: "test",
        },
      ]),
    ).not.toThrow();
  });
});
