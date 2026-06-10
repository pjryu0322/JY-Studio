import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  extractConnectionTestFromCapabilityJson,
  deriveAutoGenerationReadyFromConnectionTest,
  type AutoGenerationSettingsConnectionTestResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { derivePreviewDeploymentReadyFromPreflight } from "@/lib/prototype/githubProviderPreflightService";
import {
  GITHUB_PROVIDER_PREFLIGHT_JSON_KEY,
  type GithubProviderPreflightResultV1,
} from "@/lib/prototype/githubProviderPreflightTypes";
import { parseGithubProviderPreflightV1 } from "@/lib/prototype/githubProviderPreflightParse";

export type AutoGenerationSettingsConnectionStateV1 = Readonly<{
  readonly githubRepositoryStatus: "ok" | "failed" | "unknown";
  readonly githubTokenStatus: "ok" | "failed" | "unknown";
  readonly cursorApiStatus: "ok" | "failed" | "unknown";
  readonly githubPreflight: GithubProviderPreflightResultV1 | null;
  readonly connectionTest: AutoGenerationSettingsConnectionTestResultV1 | null;
  readonly autoGenerationReady: boolean;
  readonly previewDeploymentReady: boolean;
}>;

export function extractGithubProviderPreflightFromCapabilityJson(
  raw: unknown,
): GithubProviderPreflightResultV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const nested = (raw as Record<string, unknown>)[GITHUB_PROVIDER_PREFLIGHT_JSON_KEY];
  return parseGithubProviderPreflightV1(nested);
}

export function mergeGithubCapabilityWithPreflight(
  capability: Record<string, unknown>,
  preflight: GithubProviderPreflightResultV1,
): Record<string, unknown> {
  return { ...capability, [GITHUB_PROVIDER_PREFLIGHT_JSON_KEY]: preflight };
}

export function resolvePreviewDeploymentReadyFromCapabilityJson(raw: unknown): boolean {
  const connectionTest = extractConnectionTestFromCapabilityJson(raw);
  if (connectionTest) return connectionTest.previewDeploymentReady;
  const preflight = extractGithubProviderPreflightFromCapabilityJson(raw);
  return derivePreviewDeploymentReadyFromPreflight(preflight);
}

export function resolveAutoGenerationReadyFromCapabilityJson(raw: unknown): boolean {
  const connectionTest = extractConnectionTestFromCapabilityJson(raw);
  if (connectionTest) {
    return deriveAutoGenerationReadyFromConnectionTest(connectionTest);
  }
  return true;
}

export function resolveAutoGenerationSettingsConnectionState(
  executionSetup: ExecutionSetupDto | null,
): AutoGenerationSettingsConnectionStateV1 {
  const es = executionSetup;
  const cap = es?.githubCapabilityValidation ?? null;
  const preflight = extractGithubProviderPreflightFromCapabilityJson(cap);
  const connectionTest = extractConnectionTestFromCapabilityJson(cap);

  const repoName = String(es?.gitRepoName ?? "").trim();
  const repoOk = es?.repoConnectionOk === true && Boolean(repoName);
  const tokenOk =
    es?.githubAuthConnectionOk === true &&
    es?.githubCapabilityValidation?.githubOperableOk === true;
  const cursorOk = es?.cursorApiConnectionOk === true;

  return {
    githubRepositoryStatus: !repoName ? "unknown" : repoOk ? "ok" : "failed",
    githubTokenStatus: tokenOk ? "ok" : es?.hasGithubAccessToken ? "failed" : "unknown",
    cursorApiStatus: cursorOk ? "ok" : es?.hasCursorToken ? "unknown" : "unknown",
    githubPreflight: preflight,
    connectionTest,
    autoGenerationReady: resolveAutoGenerationReadyFromCapabilityJson(cap),
    previewDeploymentReady: resolvePreviewDeploymentReadyFromCapabilityJson(cap),
  };
}
