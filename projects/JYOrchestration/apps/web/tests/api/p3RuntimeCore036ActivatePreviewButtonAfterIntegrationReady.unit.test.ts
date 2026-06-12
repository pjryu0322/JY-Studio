import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readImplementationStagePanelSources } from "../helpers/implementationStagePanelSources";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { INTEGRATION_WIRING_PROCESS_TASK_TITLE } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import {
  INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE,
} from "@/lib/prototype/implementationIntegrationErrors";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { buildDefaultIntegrationStepsFromBranchPlan } from "@/lib/prototype/implementationIntegrationStepBuilder";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import { mapIntegrationStepByKind } from "@/lib/prototype/implementationIntegrationStepMutations";
import {
  evaluateImplementationPreviewButtonState,
  shouldSuppressIntegrationContinueUserMessage,
} from "@/lib/prototype/implementationPreviewButtonPolicy";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { evaluateImplementationPreviewReadiness } from "@/lib/prototype/implementationPreviewReadiness";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import type { ImplementationRuntimeSnapshotV1 } from "@/lib/prototype/implementationRuntimeSnapshot";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";
import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";

const PID = "p-runtime-core-036";
const NOW = "2026-06-09T01:30:00.000Z";
const INTEGRATION_BRANCH = "integration/cmphxk7y1001-20260609-0130";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prototypeDir = join(__dirname, "../../src/lib/prototype");
const componentsDir = join(__dirname, "../../src/components/preview");

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

function mergedIntegrationPlan(): CodeTaskIntegrationPlanV1 {
  return {
    version: "code_task_integration_plan_v1",
    projectId: PID,
    targetRepository: "https://github.com/o/r",
    baseBranch: "main",
    integrationBranch: INTEGRATION_BRANCH,
    createdAt: NOW,
    status: "pr_ready",
    strategy: "merge",
    included: [],
    excluded: [],
    mergeResults: [],
  };
}

function stepsWithStatuses(
  statuses: Partial<
    Record<
      "final_wiring" | "integration_branch" | "build" | "app_preview_target",
      ImplementationIntegrationStepV1["status"]
    >
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

function integratedRuntime(overrides?: Partial<ImplementationPreviewRuntimeV1>): ImplementationPreviewRuntimeV1 {
  const actualUrl = `https://example.github.io/repo/previews/${encodeURIComponent(PID)}/`;
  return {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "ready",
    generatedAt: NOW,
    previewUrl: actualUrl,
    externalPreviewUrl: actualUrl,
    githubPagesUrl: actualUrl,
    runtimeKind: "actual_integrated_app",
    sourceIntegrationBranch: INTEGRATION_BRANCH,
    openMode: "external_new_window",
    renderMode: "external_preview",
    sourceScopeVersion: "implementation_preview_scope_v1",
    includedCodeTaskIds: ["CODE-1"],
    excludedCodeTaskIds: [],
    warnings: [],
    errorMessage: null,
    ...overrides,
  };
}

function integrationStepsState(
  statuses: Parameters<typeof stepsWithStatuses>[0],
): { readonly implementationIntegrationStepsV1: { readonly steps: readonly ImplementationIntegrationStepV1[] } } {
  return { implementationIntegrationStepsV1: { steps: stepsWithStatuses(statuses) } };
}

function snapshotReady(overrides?: {
  readonly runtime?: ImplementationPreviewRuntimeV1;
}): ImplementationRuntimeSnapshotV1 {
  return buildImplementationRuntimeSnapshot({
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
    integrationPlan: mergedIntegrationPlan(),
    previewRuntime: overrides?.runtime ?? integratedRuntime(),
  });
}

describe("P3-Runtime-Core-03-6 activate Preview after integration ready", () => {
  it("1. integratedAppPreviewReady enables integrated_app_preview mode", () => {
    const snapshot = snapshotReady();
    const state = evaluateImplementationPreviewButtonState({
      projectId: PID,
      snapshot,
      previewRuntime: integratedRuntime(),
      integratedAppPreviewReady: true,
    });
    expect(state.mode).toBe("integrated_app_preview");
    expect(state.enabled).toBe(true);
    expect(state.label).toBe("Preview 보기");
  });

  it("2. code task preview only keeps actual Preview button disabled", () => {
    const snapshot = snapshotReady();
    const state = evaluateImplementationPreviewButtonState({
      projectId: PID,
      snapshot: {
        ...snapshot,
        preview: {
          ...snapshot.preview,
          integratedAppPreviewReady: false,
          codeTaskPreviewReady: true,
          previewUrl: null,
        },
      },
      previewRuntime: integratedRuntime({
        previewUrl: null,
        internalAppPreviewUrl: null,
        appPreviewUrl: null,
        externalPreviewUrl: null,
        githubPagesUrl: null,
        runtimeKind: "codetask_diagnostic_preview",
        sourceIntegrationBranch: null,
        openMode: "scope_summary_fallback",
        renderMode: "scope_summary_fallback",
      }),
      integratedAppPreviewReady: false,
      codeTaskPreviewReady: true,
    });
    expect(state.mode).toBe("disabled");
    expect(state.enabled).toBe(false);
    expect(state.url).toBeNull();
  });

  it("3. failed CodeTask disables Preview button", () => {
    const snapshot = snapshotReady();
    const state = evaluateImplementationPreviewButtonState({
      projectId: PID,
      snapshot: {
        ...snapshot,
        preview: { ...snapshot.preview, integratedAppPreviewReady: false },
        codeTask: { ...snapshot.codeTask, failed: 1 },
      },
      previewRuntime: integratedRuntime({
        sourceIntegrationBranch: null,
        internalAppPreviewUrl: null,
        openMode: "scope_summary_fallback",
        renderMode: "scope_summary_fallback",
      }),
      integratedAppPreviewReady: false,
    });
    expect(state.mode).toBe("disabled");
    expect(state.enabled).toBe(false);
  });

  it("4. integrated preview uses app preview URL from runtime", () => {
    const runtime = integratedRuntime({
      externalPreviewUrl: "https://deploy.example/app",
    });
    const state = evaluateImplementationPreviewButtonState({
      projectId: PID,
      snapshot: snapshotReady({ runtime }),
      previewRuntime: runtime,
      integratedAppPreviewReady: true,
    });
    expect(state.url).toBe("https://deploy.example/app");
  });

  it("5. missing actual preview URL does not fall back to diagnostic scope URL", () => {
    const runtime = integratedRuntime({
      previewUrl: null,
      internalAppPreviewUrl: null,
      appPreviewUrl: null,
      externalPreviewUrl: null,
      githubPagesUrl: null,
      runtimeKind: "actual_integrated_app",
    });
    const state = evaluateImplementationPreviewButtonState({
      projectId: PID,
      snapshot: snapshotReady({ runtime }),
      previewRuntime: runtime,
      integratedAppPreviewReady: true,
    });
    expect(state.url).toBeNull();
    expect(state.enabled).toBe(false);
  });

  it("6. integrated_app_preview_ready status suppresses continue toast", () => {
    expect(
      shouldSuppressIntegrationContinueUserMessage({
        status: "integrated_app_preview_ready",
        previewReady: false,
      }),
    ).toBe(true);
  });

  it("7. previewReady suppresses continue message text", () => {
    expect(
      shouldSuppressIntegrationContinueUserMessage({
        previewReady: true,
        message: "Preview 준비를 계속 진행해야 합니다.",
      }),
    ).toBe(true);
  });

  it("8. previewReady success message constant is user-facing", () => {
    expect(INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE).toContain("실제 앱 Preview가 준비되었습니다.");
    expect(INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE).toContain("Preview 버튼");
  });

  it("9. all integration steps completed marks integratedAppPreviewReady", () => {
    const readiness = evaluateImplementationPreviewReadiness({
      projectId: PID,
      codeTaskPlan: integrationCodeTaskPlan(),
      codeTaskRuns: [verifiedRun("CODE-1", "wip/screen/task-1")],
      eligibility: evaluateCodeTaskIntegration({
        codeTaskPlan: integrationCodeTaskPlan(),
        taskList: null,
        codeTaskRuns: [verifiedRun("CODE-1", "wip/screen/task-1")],
      }),
      previewRuntime: integratedRuntime(),
      integrationPlan: mergedIntegrationPlan(),
      requirementsState: integrationStepsState({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "completed",
        app_preview_target: "completed",
      }),
    });
    expect(readiness.integratedAppPreviewReady).toBe(true);
  });

  it("10. board section shows 통합 및 Preview 준비 완료 when integrated ready", () => {
    const snapshot = snapshotReady();
    const vm = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility: evaluateCodeTaskIntegration({
        codeTaskPlan: integrationCodeTaskPlan(),
        taskList: null,
        codeTaskRuns: [verifiedRun("CODE-1", "wip/screen/task-1")],
      }),
      integratedPipelineLines: [],
      previewRuntime: integratedRuntime(),
      runtimeSnapshot: snapshot,
      requirementsState: integrationStepsState({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "completed",
        app_preview_target: "completed",
      }),
    });
    expect(vm.integratedAppPreviewReady).toBe(true);
    expect(vm.previewStatusLines[0]).toBe("통합 및 Preview 준비 완료");
  });

  it("11. integrated ready UI does not prioritize code task preview copy", () => {
    const snapshot = snapshotReady();
    const vm = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility: evaluateCodeTaskIntegration({
        codeTaskPlan: integrationCodeTaskPlan(),
        taskList: null,
        codeTaskRuns: [verifiedRun("CODE-1", "wip/screen/task-1")],
      }),
      integratedPipelineLines: [],
      previewRuntime: integratedRuntime(),
      runtimeSnapshot: snapshot,
      requirementsState: integrationStepsState({
        final_wiring: "completed",
        integration_branch: "completed",
        build: "completed",
        app_preview_target: "completed",
      }),
    });
    expect(vm.previewStatusLines.some((l) => l.includes("CodeTask 결과 미리보기"))).toBe(false);
  });

  it("12. integrated snapshot stays ready when legacy codeTaskPreviewReady is also true", () => {
    const snapshot = snapshotReady();
    expect(snapshot.preview.integratedAppPreviewReady).toBe(true);
    expect(snapshot.preview.codeTaskPreviewReady).toBe(true);
    const state = evaluateImplementationPreviewButtonState({
      projectId: PID,
      snapshot,
      previewRuntime: integratedRuntime(),
    });
    expect(state.mode).toBe("integrated_app_preview");
  });

  it("13. execution board uses single implementation-preview-open-button", () => {
    const src = readFileSync(join(componentsDir, "ImplementationExecutionBoardPanel.tsx"), "utf8");
    expect(src).toContain('data-testid="implementation-preview-open-button"');
    expect(src).toContain("evaluateImplementationPreviewButtonState");
    expect(src).not.toContain("implementation-codetask-diagnostic-preview-open-button");
    expect(src).not.toContain("implementation-integrated-app-preview-open-button");
  });

  it("14. source branch resolver prefers context.sourceBranch", () => {
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

  it("15. failed CodeTask blocks integration eligibility", () => {
    const eligibility = evaluateCodeTaskIntegration({
      codeTaskPlan: integrationCodeTaskPlan(),
      taskList: null,
      codeTaskRuns: [
        {
          ...verifiedRun("CODE-1", "wip/screen/task-1"),
          status: "failed",
        },
      ],
    });
    expect(eligibility.canIntegrate).toBe(false);
  });

  it("16. integration client suppresses continue and maps success message", () => {
    const src = readFileSync(join(prototypeDir, "implementationIntegrationClient.ts"), "utf8");
    expect(src).toContain("resolveIntegrationPipelineUserToast");
  });

  it("17. PrototypePreviewPanel wires integration steps into execution board", () => {
    const src = readImplementationStagePanelSources();
    expect(src).toContain("implementationIntegrationStepsV1={");
    expect(src).toContain("shouldSuppressIntegrationContinueUserMessage");
    expect(src).toContain("INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE");
  });
});
