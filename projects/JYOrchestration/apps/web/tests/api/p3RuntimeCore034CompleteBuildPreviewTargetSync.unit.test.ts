import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  evaluateBuildIntegrationStepCompletion,
  runBuildIntegrationStep,
} from "@/lib/prototype/implementationBuildStepService";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { integrationPlanHasSuccessfulMerge } from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { reconcileIntegrationStepsWithIntegrationPlan } from "@/lib/prototype/implementationIntegrationStepPlanReconcile";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { mapIntegrationStepByKind } from "@/lib/prototype/implementationIntegrationStepMutations";
import { buildIntegrationStepStatusLines } from "@/lib/prototype/implementationIntegrationStatus";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import {
  buildImplementationRuntimeSnapshot,
} from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { isIntegratedAppRenderTarget } from "@/lib/prototype/implementationAppPreviewTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { buildProjectIntegrationPipelinePersistState } from "@/lib/prototype/projectIntegrationPipelinePersist";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";
import { buildImplementationIntegrationPipelineEligibilityFromSnapshot } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import { integrationReadyBoardGateSummary } from "./integrationEligibilityBoardGateFixtures";
import { formatExecutionLogTimelineLabel } from "@/lib/prototype/promptTimelineExecutionLogTabs";

const PID = "p-runtime-core-034";
const NOW = "2026-06-09T00:25:00.000Z";
const INTEGRATION_BRANCH = "integration/cmphxk7y1001-20260609-0025";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");
const componentsDir = join(__dirname, "../../src/components/preview");
const routePath = join(
  __dirname,
  "../../src/app/api/prototype/integration/run-pipeline/route.ts",
);

function unit(n: number): ImplementationExecutionUnitV1 {
  return {
    unitId: `unit-${n}`,
    codeTaskId: `CODE-${n}`,
    processTaskId: `DEV-${n}`,
    title: `Task ${n}`,
    order: n,
    branchGroup: "screen",
    baseBranch: "main",
    workBranch: `wip/screen/task-${n}`,
    dependencies: [],
    status: "verified",
  };
}

function verifiedRun(codeTaskId: string, workBranch: string): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `r-${codeTaskId}`,
    projectId: PID,
    processTaskId: "DEV",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    commitSha: "abc",
    githubOutcome: {
      status: "verified",
      checkedAt: NOW,
      workBranch,
      commitSha: "abc",
      source: "github_rest",
    },
  };
}

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

function mergedIntegrationPlan(
  status: CodeTaskIntegrationPlanV1["status"] = "pr_ready",
): CodeTaskIntegrationPlanV1 {
  return {
    version: "code_task_integration_plan_v1",
    projectId: PID,
    targetRepository: "https://github.com/o/r",
    baseBranch: "main",
    integrationBranch: INTEGRATION_BRANCH,
    createdAt: NOW,
    status,
    strategy: "merge",
    included: [
      {
        runId: "r-1",
        processTaskId: "DEV-1",
        codeTaskId: "CODE-1",
        title: "Task 1",
        workBranch: "wip/screen/task-1",
        commitSha: "abc",
        order: 1,
      },
    ],
    excluded: [],
    mergeResults: [{ codeTaskId: "CODE-1", workBranch: "wip/screen/task-1", commitSha: "abc", status: "merged" }],
    pullRequestUrl: "https://github.com/o/r/pull/64",
    pullRequestNumber: 64,
  };
}

function stepsWithStatuses(
  statuses: Partial<
    Record<"final_wiring" | "integration_branch" | "build" | "app_preview_target", ImplementationIntegrationStepV1["status"]>
  >,
): readonly ImplementationIntegrationStepV1[] {
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

function snapshotAfterMerge(
  stepStatuses: Parameters<typeof stepsWithStatuses>[0],
  plan: CodeTaskIntegrationPlanV1 | null = mergedIntegrationPlan(),
) {
  const units = [unit(1)];
  const runs = [verifiedRun("CODE-1", "wip/screen/task-1")];
  const steps = stepsWithStatuses(stepStatuses);
  return buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: units,
    selectedExecutionUnitIds: units.map((u) => u.unitId),
    codeTaskRuns: runs,
    integrationSteps: steps,
    integrationPlan: plan,
  });
}

describe("P3-Runtime-Core-03-4 build/preview target sync", () => {
  it("1. persist merges orchestrationPatch and previewRuntimePatch into state", () => {
    const steps = stepsWithStatuses({ final_wiring: "completed" });
    const runtime = {
      version: "implementation_preview_runtime_v1",
      status: "ready",
      previewUrl: "/preview/app/generated",
      sourceIntegrationBranch: INTEGRATION_BRANCH,
      openMode: "internal_renderer",
      renderMode: "internal_app",
    } as ImplementationPreviewRuntimeV1;
    const merged = buildProjectIntegrationPipelinePersistState({
      projectId: PID,
      persisted: { promptTimeline: [] },
      outcome: {
        ok: true,
        status: "build_pending",
        previewReady: false,
        timelineEntries: [],
        orchestrationPatch: { implementationIntegrationStepsV1: steps },
        previewRuntimePatch: { implementationPreviewRuntimeV1: runtime },
      },
      plan: mergedIntegrationPlan(),
      nowIso: NOW,
    });
    expect(merged.implementationIntegrationStepsV1).toBeDefined();
    expect(merged.implementationPreviewRuntimeV1).toEqual(runtime);
    expect(merged.codeTaskIntegrationPlanV1).toBeDefined();
    const actions = (merged.promptTimeline ?? []).map((e) => String(e.action ?? ""));
    expect(actions).toContain("project_integration_pipeline_result_persist_started");
    expect(actions).toContain("project_integration_pipeline_result_persisted");
  });

  it("2. run-pipeline route uses buildProjectIntegrationPipelinePersistState", () => {
    const src = readFileSync(routePath, "utf8");
    expect(src).toContain("buildProjectIntegrationPipelinePersistState");
    expect(src).toContain("buildImplementationExecutionSummaryCounts");
    expect(src).not.toMatch(/mergeRequirementsStateJson\s*\(\s*persisted/);
  });

  it("3. post-persist summary recomputes snapshot from merged state", () => {
    const plan = mergedIntegrationPlan();
    const steps = reconcileIntegrationStepsWithIntegrationPlan({
      steps: stepsWithStatuses({ final_wiring: "pending", integration_branch: "pending" }),
      plan,
      nowIso: NOW,
    });
    const orchestrationPatch = buildProjectIntegrationPipelinePersistState({
      projectId: PID,
      persisted: {},
      outcome: {
        ok: true,
        status: "build_pending",
        previewReady: false,
        timelineEntries: [],
        orchestrationPatch: { implementationIntegrationStepsV1: steps },
      },
      plan,
      nowIso: NOW,
    });
    const summary = buildImplementationExecutionSummaryCounts({
      projectId: PID,
      requirementsState: orchestrationPatch,
      codeTaskPlan: integrationCodeTaskPlan(),
      taskList: null,
      runs: [verifiedRun("CODE-1", "wip/screen/task-1")],
    });
    expect(summary.runtimeSnapshot.integration.integrationBranchStatus).toBe("completed");
  });

  it("4. build step completes when merge succeeded on integration branch", async () => {
    const evaluation = evaluateBuildIntegrationStepCompletion({
      projectId: PID,
      plan: mergedIntegrationPlan(),
    });
    expect(evaluation.ok).toBe(true);
    const result = await runBuildIntegrationStep({
      projectId: PID,
      steps: stepsWithStatuses({ build: "pending" }),
      plan: mergedIntegrationPlan(),
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.steps.find((s) => s.kind === "build")?.status).toBe("completed");
    expect(result.timelineEntries.map((e) => e.action)).toContain("implementation_integration_build_completed");
  });

  it("5. build step fails when plan is conflict", () => {
    const evaluation = evaluateBuildIntegrationStepCompletion({
      projectId: PID,
      plan: { ...mergedIntegrationPlan("conflict"), failureMessage: "conflict" },
    });
    expect(evaluation.ok).toBe(false);
  });

  it("6. reconcile marks wiring and branch completed after successful merge plan", () => {
    const reconciled = reconcileIntegrationStepsWithIntegrationPlan({
      steps: stepsWithStatuses({ final_wiring: "running", integration_branch: "pending" }),
      plan: mergedIntegrationPlan(),
      nowIso: NOW,
    });
    expect(reconciled.find((s) => s.kind === "final_wiring")?.status).toBe("completed");
    expect(reconciled.find((s) => s.kind === "integration_branch")?.status).toBe("completed");
  });

  it("7. integrated render target requires actual preview runtime on integration branch", () => {
    const plan = mergedIntegrationPlan();
    const runtime = {
      version: "implementation_preview_runtime_v1",
      status: "ready",
      previewUrl: "https://deploy.example/app",
      externalPreviewUrl: "https://deploy.example/app",
      sourceIntegrationBranch: INTEGRATION_BRANCH,
      openMode: "external_new_window",
      renderMode: "external_preview",
      runtimeKind: "actual_integrated_app",
      sourceScopeVersion: "implementation_preview_scope_v1",
      includedCodeTaskIds: [],
      excludedCodeTaskIds: [],
      warnings: [],
    } as ImplementationPreviewRuntimeV1;
    expect(
      isIntegratedAppRenderTarget({ projectId: PID, runtime, integrationPlan: plan }),
    ).toBe(true);
  });

  it("8. scope_summary_fallback runtime is not integrated app target", () => {
    const runtime = {
      version: "implementation_preview_runtime_v1",
      status: "ready",
      previewUrl: "https://example.com",
      sourceIntegrationBranch: INTEGRATION_BRANCH,
      openMode: "scope_summary_fallback",
      renderMode: "scope_summary_fallback",
    } as ImplementationPreviewRuntimeV1;
    expect(
      isIntegratedAppRenderTarget({
        projectId: PID,
        runtime,
        integrationPlan: mergedIntegrationPlan(),
      }),
    ).toBe(false);
  });

  it("9. build pending keeps integratedAppPreviewReady false and shows continue button", () => {
    const snapshot = snapshotAfterMerge({
      final_wiring: "completed",
      integration_branch: "completed",
      build: "pending",
      app_preview_target: "pending",
    });
    expect(snapshot.preview.integratedAppPreviewReady).toBe(false);
    expect(snapshot.integration.canRunIntegration).toBe(true);
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(true);
    expect(button.enabled).toBe(true);
    expect(button.buttonLabel).toBe("Build 검증 및 Preview 준비 계속");
  });

  it("10. all integration steps completed + actual integrated runtime marks preview ready", () => {
    const plan = mergedIntegrationPlan();
    const runtime = {
      version: "implementation_preview_runtime_v1",
      status: "ready",
      previewUrl: "https://deploy.example/app",
      externalPreviewUrl: "https://deploy.example/app",
      sourceIntegrationBranch: INTEGRATION_BRANCH,
      openMode: "external_new_window",
      renderMode: "external_preview",
      runtimeKind: "actual_integrated_app",
      sourceScopeVersion: "implementation_preview_scope_v1",
      includedCodeTaskIds: [],
      excludedCodeTaskIds: [],
      warnings: [],
    } as ImplementationPreviewRuntimeV1;
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: [unit(1)],
      selectedExecutionUnitIds: ["unit-1"],
      codeTaskRuns: [verifiedRun("CODE-1", "wip/screen/task-1")],
      integrationSteps: stepsWithStatuses({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "completed",
        app_preview_target: "completed",
      }),
      integrationPlan: plan,
      previewRuntime: runtime,
    });
    expect(snapshot.preview.integratedAppPreviewReady).toBe(true);
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.show).toBe(false);
  });

  it("11. app_preview_target pending shows continue button", () => {
    const snapshot = snapshotAfterMerge({
      final_wiring: "completed",
      integration_branch: "completed",
      build: "completed",
      app_preview_target: "pending",
    });
    const button = evaluateIntegrationPipelineButtonFromSnapshot(snapshot);
    expect(button.continueBuildPreview).toBe(true);
    expect(button.buttonLabel).toBe("Preview 준비 계속");
  });

  it("12. pipeline eligibility allows continue build/preview path", () => {
    const snapshot = snapshotAfterMerge({
      final_wiring: "completed",
      integration_branch: "completed",
      build: "pending",
    });
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(snapshot, {
      boardGateSummary: integrationReadyBoardGateSummary({ integrationReadyCodeTaskIds: ["CODE-1"] }),
    });
    expect(eligibility.canRun).toBe(true);
  });

  it("13. board panel uses dynamic integration button label", () => {
    const panelSrc = readFileSync(join(componentsDir, "ImplementationExecutionBoardPanel.tsx"), "utf8");
    const footerSrc = readFileSync(join(componentsDir, "ImplementationExecutionBoardIntegrationFooter.tsx"), "utf8");
    expect(panelSrc).toContain("integrationButtonState");
    expect(footerSrc).toContain("integrationButtonState.buttonLabel");
    expect(footerSrc).toContain("Build 검증 및 Preview 준비 계속 중…");
  });

  it("14. board section hides raw integration branch name after merge", () => {
    const section = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility: {
        canIntegrate: true,
        included: [],
        excluded: [],
        warnings: [],
      },
      integratedPipelineLines: [],
      integrationPlan: mergedIntegrationPlan(),
    });
    const joined = section.integrationPlanLines.join("\n");
    expect(joined).toContain("통합 branch가 준비되었습니다.");
    expect(joined).not.toContain(INTEGRATION_BRANCH);
  });

  it("15. integration step lines use four-stage user labels", () => {
    const lines = buildIntegrationStepStatusLines(
      stepsWithStatuses({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "pending",
        app_preview_target: "pending",
      }),
    );
    expect(lines).toEqual([
      "최종 연결/통합 Wiring: 완료",
      "통합 branch: 완료",
      "Build 검증: 대기",
      "실제 앱 Preview: 대기",
    ]);
  });

  it("16. execution log labels include pipeline persist actions", () => {
    expect(
      formatExecutionLogTimelineLabel({ action: "project_integration_pipeline_result_persist_started" }),
    ).toContain("저장");
    expect(
      formatExecutionLogTimelineLabel({ action: "project_integration_pipeline_result_persisted" }),
    ).toContain("완료");
  });

  it("17. regression: context.sourceBranch preferred", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/screen/workspace",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: INTEGRATION_BRANCH,
      topologyChainHead: "wip/integration/final-wiring",
      includedWorkBranches: ["wip/screen/workspace", "wip/feature/core-flow"],
    });
    expect(result.ok).toBe(true);
    expect(result.sourceBranch).toBe("wip/screen/workspace");
  });

  it("18. regression: final-wiring branch not used as source", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/integration/final-wiring",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: INTEGRATION_BRANCH,
      topologyChainHead: null,
      includedWorkBranches: ["wip/integration/final-wiring", "wip/screen/workspace"],
    });
    expect(result.ok).toBe(false);
  });

  it("19. failed CodeTask blocks integration canRun when not on continue path", () => {
    const units = [unit(1), { ...unit(2), status: "failed" as const }];
    const runs = [verifiedRun("CODE-1", "wip/1"), verifiedRun("CODE-2", "wip/2")];
    const snapshot = buildImplementationRuntimeSnapshot({
      projectId: PID,
      executionUnits: units,
      selectedExecutionUnitIds: units.map((u) => u.unitId),
      codeTaskRuns: runs,
      integrationSteps: stepsWithStatuses({ final_wiring: "pending" }),
    });
    expect(snapshot.integration.canRunIntegration).toBe(false);
    const eligibility = buildImplementationIntegrationPipelineEligibilityFromSnapshot(snapshot, {
      boardGateSummary: integrationReadyBoardGateSummary({ integrationReadyCodeTaskIds: ["CODE-1"] }),
    });
    expect(eligibility.canRun).toBe(false);
  });

  it("20. merge success helper matches pr_ready plan with included tasks", () => {
    expect(integrationPlanHasSuccessfulMerge(mergedIntegrationPlan())).toBe(true);
    expect(integrationPlanHasSuccessfulMerge({ ...mergedIntegrationPlan("failed"), included: [] })).toBe(
      false,
    );
  });

  it("21. no prisma schema changes in prototype integration modules touched by 03-4", () => {
    const names = [
      "implementationIntegrationPlanMergeStatus.ts",
      "implementationIntegrationStepPlanReconcile.ts",
      "projectIntegrationPipelinePersist.ts",
    ];
    for (const name of names) {
      const src = readFileSync(join(prototypeDir, name), "utf8");
      expect(src).not.toContain("prisma.");
    }
  });
});
