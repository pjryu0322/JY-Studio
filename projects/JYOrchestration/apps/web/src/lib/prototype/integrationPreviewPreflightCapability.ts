import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";
import {
  AUTO_GENERATION_CONNECTION_TEST_JSON_KEY,
  extractConnectionTestFromCapabilityJson,
  mergeCapabilityWithConnectionTest,
  type AutoGenerationCheckResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import type { GithubProviderPreflightResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";
import { mergeGithubCapabilityWithPreflight } from "@/lib/prototype/autoGenerationSettingsState";

export function mergeLiveIntegrationPreviewPreflightIntoCapabilityJson(input: {
  readonly capability: Record<string, unknown>;
  readonly previewDeploymentPreflight: readonly AutoGenerationCheckResultV1[];
  readonly previewDeploymentReady: boolean;
  readonly checkedAt: string;
  readonly githubProviderPreflight: GithubProviderPreflightResultV1;
  readonly failure?: Readonly<{
    readonly key: string;
    readonly remediationCode: string;
    readonly checkedAt: string;
  }> | null;
}): Record<string, unknown> {
  let merged = mergeGithubCapabilityWithPreflight(
    input.capability,
    input.githubProviderPreflight,
  );

  merged = {
    ...merged,
    previewDeploymentPreflightCheckedAt: input.checkedAt,
    previewDeploymentPreflightStale: false,
    previewDeploymentReady: input.previewDeploymentReady,
    actionsWorkflowDispatchOk: input.previewDeploymentReady,
    workflowFileWriteOk: input.previewDeploymentReady,
    ghPagesBranchWriteOk: input.previewDeploymentReady,
    lastPreviewDeploymentPreflightFailure: input.failure ?? null,
  };

  const existingConnection = extractConnectionTestFromCapabilityJson(merged);
  if (existingConnection) {
    const normalized = normalizeAutoGenerationConnectionTestResult({
      basicConnection: existingConnection.basicConnection,
      envcheck: existingConnection.envcheck,
      previewDeploymentPreflight: input.previewDeploymentPreflight,
      checkedAt: input.checkedAt,
      settingsConnectionTestOnly: true,
    });
    merged = mergeCapabilityWithConnectionTest(merged, normalized);
  }

  return merged;
}
