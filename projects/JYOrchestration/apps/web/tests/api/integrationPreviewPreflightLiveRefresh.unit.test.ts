import { describe, expect, it, vi } from "vitest";
import * as previewModule from "@/lib/prototype/previewDeploymentPreflightService";
import { runIntegrationPreviewPreflight } from "@/lib/prototype/integrationPreviewPreflightService";

describe("integrationPreviewPreflightLiveRefresh", () => {
  it("6. always calls live preflight even when stale failed snapshot exists in capability", async () => {
    const spy = vi.spyOn(previewModule, "runPreviewDeploymentPreflightWithGithubResult").mockResolvedValue({
      checks: [
        {
          key: "actions_workflow_dispatch",
          status: "passed",
          required: true,
          userSafeMessage: null,
          operatorMessage: null,
          remediationCode: "none",
        },
      ],
      preflight: {
        ok: true,
        level: "ready",
        targetRepository: "o/r",
        defaultBranch: "main",
        checks: [],
        userSummary: "ok",
        blockedReasons: [],
        warnings: [],
        operatorDiagnosticsId: "x",
        checkedAt: new Date().toISOString(),
      },
    });

    const outcome = await runIntegrationPreviewPreflight({
      ownerRepo: "o/r",
      defaultBranch: "main",
      githubToken: "ghp_test",
      capabilitySnapshot: {
        previewDeploymentReady: false,
        previewDeploymentPreflightCheckedAt: "2020-01-01T00:00:00.000Z",
        autoGenerationConnectionTestV1: {
          previewDeploymentReady: false,
          checkedAt: "2020-01-01T00:00:00.000Z",
        },
      },
      integrationRunStartedAt: new Date().toISOString(),
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "before_integration_preview" }),
    );
    expect(outcome.ok).toBe(true);
    spy.mockRestore();
  });

  it("9. live preflight failed returns permission kind with checkedAt", async () => {
    vi.spyOn(previewModule, "runPreviewDeploymentPreflightWithGithubResult").mockResolvedValue({
      checks: [
        {
          key: "actions_workflow_dispatch",
          status: "failed",
          required: true,
          userSafeMessage: "fail",
          operatorMessage: null,
          remediationCode: "enable_actions_permission",
        },
      ],
      preflight: {
        ok: false,
        level: "blocked",
        targetRepository: "o/r",
        defaultBranch: "main",
        checks: [],
        userSummary: "fail",
        blockedReasons: ["fail"],
        warnings: [],
        operatorDiagnosticsId: "x",
        checkedAt: new Date().toISOString(),
      },
    });

    const outcome = await runIntegrationPreviewPreflight({
      ownerRepo: "o/r",
      defaultBranch: "main",
      githubToken: "ghp_test",
      integrationRunStartedAt: new Date().toISOString(),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.kind).toBe("github_preview_permission_required");
      expect(outcome.checkedAt).toBeTruthy();
    }
    vi.restoreAllMocks();
  });
});
