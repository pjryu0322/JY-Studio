import { describe, expect, it } from "vitest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";
import { mergeCapabilityWithConnectionTest } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import {
  extractGithubProviderPreflightFromCapabilityJson,
  mergeGithubCapabilityWithPreflight,
  resolveAutoGenerationReadyFromCapabilityJson,
  resolveAutoGenerationSettingsConnectionState,
  resolvePreviewDeploymentReadyFromCapabilityJson,
} from "@/lib/prototype/autoGenerationSettingsState";
import { GITHUB_PROVIDER_PREFLIGHT_JSON_KEY } from "@/lib/prototype/githubProviderPreflightTypes";
import type { GithubProviderPreflightResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";

const blockedPreflight: GithubProviderPreflightResultV1 = {
  ok: false,
  level: "blocked",
  targetRepository: "o/r",
  defaultBranch: "main",
  checks: [
    {
      key: "actions_workflow_dispatch",
      status: "failed",
      required: true,
      userSafeMessage: "권한 필요",
      operatorMessage: null,
      remediationCode: "enable_actions_permission",
    },
  ],
  userSummary: "",
  blockedReasons: [],
  warnings: [],
  operatorDiagnosticsId: null,
  checkedAt: "2026-06-01T00:00:00.000Z",
};

const readyPreflight: GithubProviderPreflightResultV1 = {
  ...blockedPreflight,
  ok: true,
  level: "ready",
  checks: [
    {
      key: "actions_workflow_dispatch",
      status: "passed",
      required: true,
      userSafeMessage: null,
      operatorMessage: null,
      remediationCode: "none",
    },
    {
      key: "workflow_file_write",
      status: "passed",
      required: true,
      userSafeMessage: null,
      operatorMessage: null,
      remediationCode: "none",
    },
    {
      key: "gh_pages_branch_write",
      status: "passed",
      required: true,
      userSafeMessage: null,
      operatorMessage: null,
      remediationCode: "none",
    },
    {
      key: "pages_status_read",
      status: "passed",
      required: true,
      userSafeMessage: null,
      operatorMessage: null,
      remediationCode: "none",
    },
  ],
};

describe("autoGenerationSettingsPreflightState", () => {
  it("parses nested preflight from capability json", () => {
    const merged = mergeGithubCapabilityWithPreflight({ githubOperableOk: true }, blockedPreflight);
    const parsed = extractGithubProviderPreflightFromCapabilityJson(merged);
    expect(parsed?.level).toBe("blocked");
    expect(merged[GITHUB_PROVIDER_PREFLIGHT_JSON_KEY]).toBeTruthy();
  });

  it("previewDeploymentReady is false when preflight blocked", () => {
    const cap = mergeGithubCapabilityWithPreflight({ githubOperableOk: true }, blockedPreflight);
    expect(resolvePreviewDeploymentReadyFromCapabilityJson(cap)).toBe(false);
  });

  it("previewDeploymentReady is true when required checks passed", () => {
    const cap = mergeGithubCapabilityWithPreflight({ githubOperableOk: true }, readyPreflight);
    expect(resolvePreviewDeploymentReadyFromCapabilityJson(cap)).toBe(true);
  });

  it("keeps base github repo/token/cursor status rows logic", () => {
    const state = resolveAutoGenerationSettingsConnectionState({
      gitRepoName: "o/r",
      repoConnectionOk: true,
      githubAuthConnectionOk: true,
      hasGithubAccessToken: true,
      githubCapabilityValidation: {
        githubOperableOk: true,
        [GITHUB_PROVIDER_PREFLIGHT_JSON_KEY]: readyPreflight,
      },
      cursorApiConnectionOk: true,
      hasCursorToken: true,
    } as never);
    expect(state.githubRepositoryStatus).toBe("ok");
    expect(state.githubTokenStatus).toBe("ok");
    expect(state.cursorApiStatus).toBe("ok");
  });

  it("resolveAutoGenerationReady ignores stale preflight blocked when envcheck connection test is passed", () => {
    const passed = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      previewDeploymentPreflight: [
        { key: "actions_workflow_dispatch", status: "failed", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "enable_actions_permission" },
      ],
    });
    const cap = mergeCapabilityWithConnectionTest(
      mergeGithubCapabilityWithPreflight({ githubOperableOk: true }, blockedPreflight),
      passed,
    );
    expect(passed.autoGenerationReady).toBe(true);
    expect(resolveAutoGenerationReadyFromCapabilityJson(cap)).toBe(true);
  });
});
