import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { runAppPreviewTargetIntegrationStep } from "@/lib/prototype/implementationAppPreviewTargetStepService";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock("@/lib/prototype/githubPagesPreviewDeploymentService", () => ({
  deployIntegratedPreviewToGitHubPages: vi.fn(),
}));

vi.mock("@/lib/prototype/integrationPreviewPreflightService", () => ({
  runIntegrationPreviewPreflight: vi.fn(async () => ({
    ok: true,
    checkedAt: "2026-01-01T00:00:00.000Z",
  })),
  INTEGRATION_PREVIEW_PREFLIGHT_CONFIRMED_USER_MESSAGE: "confirmed",
}));

import { deployIntegratedPreviewToGitHubPages } from "@/lib/prototype/githubPagesPreviewDeploymentService";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

const baseSteps: readonly ImplementationIntegrationStepV1[] = [
  {
    stepId: "s1",
    kind: "app_preview_target",
    status: "pending",
    order: 4,
  },
];

describe("app preview target GitHub Pages", () => {
  it("9. externalPreviewUrl completes without deploy", async () => {
    const deployMock = vi.mocked(deployIntegratedPreviewToGitHubPages);
    deployMock.mockClear();

    const result = await runAppPreviewTargetIntegrationStep({
      projectId: "p",
      steps: baseSteps,
      plan: { integrationBranch: "integration/p" } as never,
      codeTaskPlan: null,
      taskList: null,
      codeTaskRuns: null,
      nowIso: "2026-01-01T00:00:00.000Z",
      externalPreviewUrl: "https://deploy.example/app",
      repoUrl: "https://github.com/o/r",
      githubToken: "token",
    });

    expect(result.ok).toBe(true);
    expect(deployMock).not.toHaveBeenCalled();
    expect(result.previewUrl).toBe("https://deploy.example/app");
  });

  it("11. deploy success completes app_preview_target", async () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      renderMode: "external_preview",
      openMode: "external_new_window",
      previewUrl: "https://o.github.io/r/previews/p/",
      externalPreviewUrl: "https://o.github.io/r/previews/p/",
      githubPagesUrl: "https://o.github.io/r/previews/p/",
      includedCodeTaskIds: [],
      excludedCodeTaskIds: [],
      warnings: [],
      runtimeKind: "actual_integrated_app",
    };
    vi.mocked(deployIntegratedPreviewToGitHubPages).mockResolvedValueOnce({
      ok: true,
      deployment: {
        status: "deployed",
        repositoryFullName: "o/r",
        sourceBranch: "integration/p",
        pagesBranch: "gh-pages",
        pagesPath: "previews/p/",
        pagesUrl: runtime.githubPagesUrl ?? null,
        deployedCommitSha: "sha",
        errorCode: null,
        userSafeMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      previewRuntime: runtime,
      timelineEntries: [],
    });

    const result = await runAppPreviewTargetIntegrationStep({
      projectId: "p",
      steps: baseSteps,
      plan: { integrationBranch: "integration/p" } as never,
      codeTaskPlan: null,
      taskList: null,
      codeTaskRuns: null,
      nowIso: "2026-01-01T00:00:00.000Z",
      repoUrl: "https://github.com/o/r",
      githubToken: "token",
    });

    expect(result.ok).toBe(true);
    expect(deployIntegratedPreviewToGitHubPages).toHaveBeenCalled();
    expect(result.previewUrl).toBe(runtime.previewUrl ?? runtime.externalPreviewUrl);
  });

  it("12. pages setup required pipeline status from deploy failure", async () => {
    vi.mocked(deployIntegratedPreviewToGitHubPages).mockResolvedValueOnce({
      ok: false,
      deployment: {
        status: "failed",
        repositoryFullName: "o/r",
        sourceBranch: "integration/p",
        pagesBranch: "gh-pages",
        pagesPath: "previews/p/",
        pagesUrl: null,
        deployedCommitSha: null,
        errorCode: "workflow_dispatch_failed",
        userSafeMessage: "GitHub Pages 설정이 필요합니다. Source를 GitHub Actions로 선택해 주세요.",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      timelineEntries: [],
      pipelineStatus: "app_preview_target_failed",
    });

    const result = await runAppPreviewTargetIntegrationStep({
      projectId: "p",
      steps: baseSteps,
      plan: { integrationBranch: "integration/p" } as never,
      codeTaskPlan: null,
      taskList: null,
      codeTaskRuns: null,
      nowIso: "2026-01-01T00:00:00.000Z",
      repoUrl: "https://github.com/o/r",
      githubToken: "token",
    });

    expect(result.ok).toBe(false);
    expect(result.pipelineStatus).toBe("app_preview_target_failed");
  });

  it("14. does not reference buildPreviewFromCompletedCodeTasks", () => {
    const stepServicePath = join(
      __dirname,
      "../../src/lib/prototype/implementationAppPreviewTargetStepService.ts",
    );
    const src = readFileSync(stepServicePath, "utf8");
    expect(src).not.toContain("buildPreviewFromCompletedCodeTasks");
  });
});
