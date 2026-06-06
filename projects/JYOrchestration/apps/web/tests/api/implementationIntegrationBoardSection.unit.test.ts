import { describe, expect, it } from "vitest";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

const NOW = "2026-06-03T12:00:00.000Z";

describe("buildImplementationIntegrationBoardSection", () => {
  const scope = buildImplementationPreviewScopeV1({
    generatedAt: NOW,
    included: [
      { codeTaskId: "CT-1", taskId: "DEV-A", title: "Shell", commitSha: "sha" },
    ],
    excluded: [
      {
        codeTaskId: "CT-2",
        taskId: "DEV-A",
        title: "Other",
        status: "prompt_ready",
        reason: "미완료",
      },
    ],
    warnings: [],
  });

  const readyRuntime: ImplementationPreviewRuntimeV1 = {
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
    excludedCodeTaskIds: ["CT-2"],
    warnings: [],
    errorMessage: null,
  };

  it("shows preview status lines and url when runtime is ready", () => {
    const vm = buildImplementationIntegrationBoardSection({
      eligibility: {
        canIntegrate: true,
        included: [],
        excluded: [],
        warnings: [],
        hasAppShell: true,
        hasAnyScreenTask: true,
      },
      integratedPipelineLines: [],
      previewScope: scope,
      previewRuntime: readyRuntime,
    });
    expect(vm.previewRuntimeReady).toBe(true);
    expect(vm.previewUrl).toContain("/preview");
    expect(vm.previewStatusLines).toContain("Preview 준비 완료");
    expect(vm.summaryLines.some((line) => line.includes("완료된 CodeTask"))).toBe(true);
  });

  it("shows integration branch and PR merge affordances from plan", () => {
    const vm = buildImplementationIntegrationBoardSection({
      eligibility: {
        canIntegrate: true,
        included: [],
        excluded: [],
        warnings: [],
        hasAppShell: true,
        hasAnyScreenTask: true,
      },
      integratedPipelineLines: [],
      previewScope: scope,
      previewRuntime: readyRuntime,
      integrationPlan: {
        version: "code_task_integration_plan_v1",
        projectId: "p1",
        targetRepository: "https://github.com/o/r",
        baseBranch: "main",
        integrationBranch: "integration/p1-20260603-1200",
        createdAt: NOW,
        included: [],
        excluded: [],
        strategy: "merge",
        status: "pr_ready",
        pullRequestUrl: "https://github.com/o/r/pull/9",
        pullRequestNumber: 9,
        checkResult: { status: "passed", checks: [{ id: "branch_exists", status: "passed" }] },
      },
    });
    expect(vm.integrationPlanLines.some((l) => l.includes("integration/p1"))).toBe(true);
    expect(vm.integrationPullRequestUrl).toContain("/pull/9");
    expect(vm.canMergeIntegrationPullRequest).toBe(true);
  });
});
