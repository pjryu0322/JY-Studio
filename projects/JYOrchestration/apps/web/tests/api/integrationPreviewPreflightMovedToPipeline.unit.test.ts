import { describe, expect, it, vi } from "vitest";
import { runAppPreviewTargetIntegrationStep } from "@/lib/prototype/implementationAppPreviewTargetStepService";
import * as preflightModule from "@/lib/prototype/integrationPreviewPreflightService";
import * as deployModule from "@/lib/prototype/githubPagesPreviewDeploymentService";

describe("integrationPreviewPreflightMovedToPipeline", () => {
  it("runs integration preview preflight before GitHub Pages deploy", async () => {
    const preflightSpy = vi.spyOn(preflightModule, "runIntegrationPreviewPreflight").mockResolvedValue({
      ok: false,
      kind: "github_preview_permission_required",
      userSafeMessage: "GitHub Actions 실행 권한이 필요합니다.",
      remediationCode: "enable_actions_permission",
      checks: [],
      checkedAt: new Date().toISOString(),
    });
    const deploySpy = vi.spyOn(deployModule, "deployIntegratedPreviewToGitHubPages");

    const steps = [
      {
        stepId: "s1",
        kind: "app_preview_target" as const,
        status: "pending" as const,
        label: "Preview",
      },
    ];

    const result = await runAppPreviewTargetIntegrationStep({
      projectId: "p1",
      steps,
      plan: { integrationBranch: "jyo/int/p1" } as never,
      codeTaskPlan: null,
      taskList: null,
      codeTaskRuns: null,
      nowIso: new Date().toISOString(),
      repoUrl: "https://github.com/o/r",
      githubToken: "ghp_test",
      baseBranch: "main",
    });

    expect(preflightSpy).toHaveBeenCalled();
    expect(deploySpy).not.toHaveBeenCalled();
    expect(result.pipelineStatus).toBe("github_preview_permission_required");
    expect(result.userSafeMessage).toContain("GitHub Actions");

    preflightSpy.mockRestore();
    deploySpy.mockRestore();
  });
});
