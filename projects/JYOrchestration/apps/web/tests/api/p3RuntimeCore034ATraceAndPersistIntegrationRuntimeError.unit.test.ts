import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { evaluateBuildIntegrationStepCompletion } from "@/lib/prototype/implementationBuildStepService";
import { IntegrationPipelineDomainError, toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { recoverCompletedIntegrationStepsFromPlan } from "@/lib/prototype/implementationIntegrationStepRecovery";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { mapIntegrationStepByKind } from "@/lib/prototype/implementationIntegrationStepMutations";
import {
  buildIntegrationRuntimeErrorDiagnostic,
  buildProjectIntegrationPipelineRuntimeErrorTimelineEntry,
} from "@/lib/prototype/integrationPipelineRuntimeDiagnostic";
import { validateIntegrationStepInput } from "@/lib/prototype/projectIntegrationPipelineValidation";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { formatExecutionLogTimelineLabel } from "@/lib/prototype/promptTimelineExecutionLogTabs";

const PID = "p-runtime-core-034a";
const NOW = "2026-06-09T01:00:00.000Z";

function integrationCodeTaskPlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: PID,
    generatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CODE-INT",
        parentTaskId: "DEV-INT",
        title: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
        description: "",
        changeType: "integration",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "integration",
          workBranch: "wip/integration/final-wiring",
          baseBranch: "main",
          executionMode: "integration_only",
        },
      },
    ],
  } as ImplementationCodeTaskPlanV1;
}

function mergedPlan(): CodeTaskIntegrationPlanV1 {
  return {
    version: "code_task_integration_plan_v1",
    projectId: PID,
    targetRepository: "https://github.com/o/r",
    baseBranch: "main",
    integrationBranch: "integration/test-branch",
    createdAt: NOW,
    status: "pr_ready",
    strategy: "merge",
    included: [
      {
        runId: "r1",
        processTaskId: "DEV-1",
        codeTaskId: "CODE-1",
        title: "T",
        workBranch: "wip/a",
        commitSha: "abc",
        order: 1,
      },
    ],
    excluded: [],
    pullRequestUrl: "https://github.com/o/r/pull/64",
    mergeResults: [{ codeTaskId: "CODE-1", workBranch: "wip/a", commitSha: "abc", status: "merged" }],
  };
}

function verifiedRun(): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: "r-CODE-1",
    projectId: PID,
    processTaskId: "DEV-1",
    workItemId: "wi",
    codeTaskId: "CODE-1",
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "abc",
    githubOutcome: {
      status: "verified",
      checkedAt: NOW,
      workBranch: "wip/a",
      commitSha: "abc",
      source: "github_rest",
    },
  };
}

function stepsWithStatuses(
  statuses: Partial<
    Record<"final_wiring" | "integration_branch" | "build" | "app_preview_target", ImplementationIntegrationStepV1["status"]>
  >,
) {
  let steps = buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: integrationCodeTaskPlan() });
  for (const [kind, status] of Object.entries(statuses) as [
    ImplementationIntegrationStepV1["kind"],
    ImplementationIntegrationStepV1["status"],
  ][]) {
    if (!status) continue;
    steps = mapIntegrationStepByKind(steps, kind, (s) => ({ ...s, status }));
  }
  return steps;
}

function snapshotWithSteps(
  statuses: Parameters<typeof stepsWithStatuses>[0],
) {
  return buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: [
      {
        unitId: "u1",
        codeTaskId: "CODE-1",
        processTaskId: "DEV-1",
        title: "T",
        order: 1,
        branchGroup: "screen",
        baseBranch: "main",
        workBranch: "wip/a",
        dependencies: [],
        status: "verified",
      },
    ],
    selectedExecutionUnitIds: ["u1"],
    codeTaskRuns: [verifiedRun()],
    integrationSteps: stepsWithStatuses(statuses),
    integrationPlan: mergedPlan(),
  });
}

describe("P3-Runtime-Core-03-4A integration runtime trace/persist", () => {
  it("1. build step with null plan returns domain validation not TypeError", () => {
    const v = validateIntegrationStepInput({
      projectId: PID,
      stepKind: "build",
      steps: buildDefaultIntegrationStepsFromBranchPlan({ codeTaskPlan: integrationCodeTaskPlan() }),
      plan: null,
    });
    expect(v.ok).toBe(false);
    expect(v.errorCode).toBe("integration_step_input_invalid");
    expect(() =>
      evaluateBuildIntegrationStepCompletion({ projectId: PID, plan: null }),
    ).not.toThrow();
  });

  it("2. raw TypeError maps to continue-preview user message", () => {
    const msg = toUserSafeIntegrationErrorMessage(new TypeError("Cannot read properties of undefined"));
    expect(msg).not.toMatch(/TypeError/);
    expect(msg).toContain("Preview 준비를 계속 진행");
    expect(msg).not.toContain("실행 로그");
  });

  it("3. runtime error log includes stepKind", () => {
    const entry = buildProjectIntegrationPipelineRuntimeErrorTimelineEntry({
      diagnostic: buildIntegrationRuntimeErrorDiagnostic({
        projectId: PID,
        stepKind: "build",
        context: {
          projectId: PID,
          stage: "implementation",
          mode: "integration_pipeline",
          trigger: "manual_integration_button",
          baseBranch: "main",
          sourceBranch: "wip/a",
          targetBranch: "wip/integration/final-wiring",
          integrationBranch: "integration/test",
          createPullRequest: true,
        },
        error: new Error("boom"),
        steps: stepsWithStatuses({}),
        plan: mergedPlan(),
        nowIso: NOW,
      }),
    });
    expect(entry.action).toBe("project_integration_pipeline_runtime_error");
    expect(formatExecutionLogTimelineLabel(entry)).toContain("통합 pipeline");
    expect(String(entry.responseText ?? "")).toContain("stepKind=build");
  });

  it("4. recovery completes final_wiring and integration_branch from plan", () => {
    const steps = stepsWithStatuses({});
    const result = recoverCompletedIntegrationStepsFromPlan({
      projectId: PID,
      steps,
      plan: mergedPlan(),
      nowIso: NOW,
    });
    expect(result.recovered).toBe(true);
    expect(result.recoveredKinds).toEqual(["integration_branch", "final_wiring"]);
    expect(result.timelineEntries.some((e) => e.action === "project_integration_pipeline_step_state_recovered")).toBe(
      true,
    );
  });

  it("5. build pending shows continue button label", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(
      snapshotWithSteps({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "pending",
      }),
    );
    expect(button.buttonLabel).toBe("Build 검증 및 Preview 준비 계속");
  });

  it("6. app_preview pending only shows Preview 준비 계속", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(
      snapshotWithSteps({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "completed",
        app_preview_target: "pending",
      }),
    );
    expect(button.buttonLabel).toBe("Preview 준비 계속");
  });

  it("7. domain step input invalid uses user-safe message without execution log hint", () => {
    const err = new IntegrationPipelineDomainError("integration_step_input_invalid");
    expect(toUserSafeIntegrationErrorMessage(err)).not.toContain("실행 로그");
  });
});
