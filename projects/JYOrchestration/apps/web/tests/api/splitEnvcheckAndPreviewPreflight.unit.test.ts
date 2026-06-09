import { describe, expect, it } from "vitest";
import {
  buildConnectionTestUserSummary,
  buildBasicConnectionChecks,
  deriveAutoGenerationReadyFromConnectionTest,
  derivePreviewDeploymentReadyFromConnectionTest,
  type AutoGenerationCheckResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { buildEnvcheckResultsFromSources } from "@/lib/prototype/envcheckConnectionTestService";

function check(key: string, status: AutoGenerationCheckResultV1["status"]): AutoGenerationCheckResultV1 {
  return {
    key,
    status,
    required: true,
    userSafeMessage: status === "failed" ? "fail" : null,
    operatorMessage: "raw operator",
    remediationCode: "none",
  };
}

describe("splitEnvcheckAndPreviewPreflight", () => {
  it("returns separate envcheck and preview arrays in connection test build", async () => {
    const envcheck = buildEnvcheckResultsFromSources({
      source: {
        workflowStatus: "merged",
        envTestStage1FailureLine: null,
        branchName: "envcheck/t-hello-world-abcdef12",
        terminalOk: true,
      },
      capability: { githubOperableOk: true, prCreateOk: true, steps: [] } as never,
    });
    expect(envcheck.map((c) => c.key)).toEqual([
      "branch_create",
      "file_write",
      "pull_request_create_or_update",
    ]);
    expect(envcheck.every((c) => c.status === "passed")).toBe(true);
  });

  it("autoGenerationReady true when envcheck passed and preview actions failed", () => {
    const basic = buildBasicConnectionChecks({
      gitRepoName: "o/r",
      repoConnectionOk: true,
      githubAuthConnectionOk: true,
      githubCapabilityValidation: { githubOperableOk: true },
      cursorApiConnectionOk: true,
      hasGithubAccessToken: true,
      hasCursorToken: true,
    } as never);
    const envcheck = [
      check("branch_create", "passed"),
      check("file_write", "passed"),
      check("pull_request_create_or_update", "passed"),
    ];
    const preview = [
      check("workflow_file_write", "passed"),
      check("actions_workflow_dispatch", "failed"),
      check("gh_pages_branch_write", "passed"),
      check("pages_status_read", "passed"),
    ];
    expect(deriveAutoGenerationReadyFromConnectionTest({ basicConnection: basic, envcheck })).toBe(true);
    expect(derivePreviewDeploymentReadyFromConnectionTest(preview)).toBe(false);
    const summary = buildConnectionTestUserSummary({
      autoGenerationReady: true,
      previewDeploymentReady: false,
    });
    expect(summary).toContain("Preview 배포");
    expect(summary).not.toContain("PR을 생성·갱신하지 못했습니다");
  });

  it("autoGenerationReady false when envcheck failed and preview skipped", () => {
    const envcheck = buildEnvcheckResultsFromSources({
      source: {
        workflowStatus: "failed",
        envTestStage1FailureLine: "PR 실패",
        branchName: null,
        terminalOk: false,
      },
      capability: null,
    });
    expect(envcheck.find((c) => c.key === "pull_request_create_or_update")?.status).toBe("failed");
    expect(envcheck.find((c) => c.key === "pull_request_create_or_update")?.userSafeMessage).not.toContain(
      "GitHub Actions",
    );
    const basic = buildBasicConnectionChecks({
      gitRepoName: "o/r",
      repoConnectionOk: true,
      githubAuthConnectionOk: true,
      githubCapabilityValidation: { githubOperableOk: true },
      cursorApiConnectionOk: true,
      hasGithubAccessToken: true,
      hasCursorToken: true,
    } as never);
    expect(
      deriveAutoGenerationReadyFromConnectionTest({ basicConnection: basic, envcheck }),
    ).toBe(false);
  });

  it("userSummary does not mix envcheck and preview failure phrases", () => {
    const blocked = buildConnectionTestUserSummary({
      autoGenerationReady: false,
      previewDeploymentReady: false,
    });
    expect(blocked).toContain("기본 연결");
    const warning = buildConnectionTestUserSummary({
      autoGenerationReady: true,
      previewDeploymentReady: false,
    });
    expect(warning).toContain("Actions");
  });
});
