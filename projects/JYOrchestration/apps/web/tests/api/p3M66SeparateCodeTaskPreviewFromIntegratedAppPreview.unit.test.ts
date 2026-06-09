import { describe, expect, it } from "vitest";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { evaluateImplementationPreviewReadiness } from "@/lib/prototype/implementationPreviewReadiness";
import {
  getCodeTaskDiagnosticPreviewOpenTarget,
  getIntegratedAppPreviewOpenTarget,
} from "@/lib/prototype/implementationPreviewOpenTarget";
import { isIntegrationPreviewRuntimeReady } from "@/lib/prototype/implementationIntegrationButtonPolicy";

const NOW = "2026-06-03T12:00:00.000Z";

const diagnosticReadyRuntime: ImplementationPreviewRuntimeV1 = {
  version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  status: "ready",
  generatedAt: NOW,
  previewUrl: "/projects/p1/preview?scope=latest",
  appPreviewUrl: "/projects/p1/preview/app?scope=latest",
  internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
  renderMode: "internal_generated_app",
  openMode: "internal_renderer",
  sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
  includedCodeTaskIds: ["CT-1"],
  excludedCodeTaskIds: [INTEGRATION_WIRING_CODE_TASK_ID],
  warnings: [],
  errorMessage: null,
};

describe("P3-M66 preview readiness separation", () => {
  const scope = buildImplementationPreviewScopeV1({
    generatedAt: NOW,
    included: [{ codeTaskId: "CT-1", taskId: "DEV-A", title: "Feature", commitSha: "sha" }],
    excluded: [
      {
        codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
        taskId: "DEV-INT",
        title: "최종 연결/통합 Wiring",
        status: "대기",
        reason: "미완료",
      },
    ],
    warnings: [],
  });

  const eligibility = {
    canIntegrate: true,
    included: [
      {
        codeTaskId: "CT-1",
        taskId: "DEV-A",
        title: "Feature",
        status: "completed",
        source: "runtime_run" as const,
      },
    ],
    excluded: [
      {
        codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
        taskId: "DEV-INT",
        title: "최종 연결/통합 Wiring",
        status: "대기",
        reason: "not_started" as const,
      },
    ],
    warnings: [],
    hasAppShell: true,
    hasAnyScreenTask: true,
  };

  it("final wiring pending: code task preview only, no integrated ready", () => {
    const readiness = evaluateImplementationPreviewReadiness({
      projectId: "p1",
      codeTaskPlan: null,
      eligibility,
      previewRuntime: diagnosticReadyRuntime,
    });
    expect(readiness.mode).toBe("final_wiring_pending");
    expect(readiness.codeTaskPreviewReady).toBe(true);
    expect(readiness.integratedAppPreviewReady).toBe(false);
    expect(readiness.statusTitleLines).not.toContain("통합 완료");
    expect(readiness.statusTitleLines.some((l) => l.includes("Wiring"))).toBe(true);
  });

  it("integration precheck blocked mode", () => {
    const readiness = evaluateImplementationPreviewReadiness({
      projectId: "p1",
      codeTaskPlan: null,
      eligibility,
      previewRuntime: diagnosticReadyRuntime,
      integrationPlan: {
        version: "code_task_integration_plan_v1",
        projectId: "p1",
        targetRepository: "https://github.com/o/r",
        baseBranch: "main",
        integrationBranch: "",
        createdAt: NOW,
        included: [],
        excluded: [],
        strategy: "merge",
        status: "failed",
        failureMessage: "completed branch changed files overlap (52 files)",
      },
    });
    expect(readiness.mode).toBe("integration_blocked");
    expect(readiness.integratedAppPreviewReady).toBe(false);
  });

  it("board section does not show 통합 완료 when only diagnostic runtime", () => {
    const vm = buildImplementationIntegrationBoardSection({
      projectId: "p1",
      eligibility,
      integratedPipelineLines: [],
      previewScope: scope,
      previewRuntime: diagnosticReadyRuntime,
    });
    expect(vm.integratedAppPreviewReady).toBe(false);
    expect(vm.codeTaskPreviewReady).toBe(true);
    expect(vm.previewStatusLines).not.toContain("통합 완료");
    expect(vm.previewStatusLines).not.toContain("Preview 준비 완료");
  });

  it("diagnostic open target uses scope url; integrated target blocked without branch", () => {
    const diagnostic = getCodeTaskDiagnosticPreviewOpenTarget({
      runtime: diagnosticReadyRuntime,
      codeTaskPreviewReady: true,
    });
    expect(diagnostic.label).toBe("Preview");
    expect(diagnostic.url).toContain("/preview?scope=latest");
    const integrated = getIntegratedAppPreviewOpenTarget({
      runtime: diagnosticReadyRuntime,
      integratedAppPreviewReady: false,
    });
    expect(integrated.url).toBeNull();
    expect(integrated.label).toBe("실제 앱 Preview 보기");
  });

  it("isIntegrationPreviewRuntimeReady requires integration branch on runtime", () => {
    expect(isIntegrationPreviewRuntimeReady(diagnosticReadyRuntime)).toBe(false);
    expect(
      isIntegrationPreviewRuntimeReady({
        ...diagnosticReadyRuntime,
        sourceIntegrationBranch: "integration/p1-test",
      }),
    ).toBe(true);
  });
});
