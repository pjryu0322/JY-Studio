import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import { runGithubProviderPreflight } from "@/lib/prototype/githubProviderPreflightService";
import type {
  AutoGenerationCheckResultV1,
  PreviewDeploymentPreflightKeyV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import type { GithubPreflightCheckResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";
import type { GithubProviderPreflightResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";

const PREVIEW_KEYS: readonly PreviewDeploymentPreflightKeyV1[] = [
  "workflow_file_write",
  "actions_workflow_dispatch",
  "gh_pages_branch_write",
  "pages_status_read",
  "pages_configuration",
];

function mapStatus(
  s: GithubPreflightCheckResultV1["status"],
): AutoGenerationCheckResultV1["status"] {
  return s;
}

function mapOne(c: GithubPreflightCheckResultV1): AutoGenerationCheckResultV1 {
  let key = c.key as string;
  if (key === "pages_configuration_write") key = "pages_configuration";
  let userMsg = c.userSafeMessage;
  if (c.key === "workflow_file_write" && c.status === "failed") {
    userMsg = userMsg ?? "Preview 배포 workflow 파일 생성 권한이 필요합니다.";
  }
  if (c.key === "actions_workflow_dispatch" && c.status === "failed") {
    userMsg = userMsg ?? "GitHub Actions 실행 권한이 필요합니다.";
  }
  if (c.key === "gh_pages_branch_write" && c.status !== "passed") {
    userMsg = userMsg ?? "GitHub Pages 배포 branch 생성/수정 권한이 필요합니다.";
  }
  if ((c.key === "pages_status_read" || c.key === "pages_configuration_write") && c.status !== "passed") {
    userMsg = userMsg ?? "GitHub Pages 설정 확인이 필요합니다.";
  }
  return {
    key,
    status: mapStatus(c.status),
    required: c.key !== "pages_configuration_write",
    userSafeMessage: userMsg,
    operatorMessage: c.operatorMessage,
    remediationCode: c.remediationCode as AutoGenerationCheckResultV1["remediationCode"],
  };
}

export function mapPreviewPreflightChecksToAutoGenerationResults(
  checks: readonly GithubPreflightCheckResultV1[],
): readonly AutoGenerationCheckResultV1[] {
  const byKey = new Map(checks.map((c) => [c.key, c]));
  const out: AutoGenerationCheckResultV1[] = [];
  for (const key of PREVIEW_KEYS) {
    if (key === "pages_configuration") {
      const write = byKey.get("pages_configuration_write");
      const read = byKey.get("pages_status_read");
      const src = write ?? read;
      if (src) {
        out.push({
          ...mapOne(src),
          key: "pages_configuration",
          required: false,
        });
      } else {
        out.push({
          key: "pages_configuration",
          status: "unknown",
          required: false,
          userSafeMessage: "연결 테스트를 실행해 주세요.",
          operatorMessage: null,
          remediationCode: "enable_pages",
        });
      }
      continue;
    }
    const src = byKey.get(key as GithubPreflightCheckResultV1["key"]);
    if (src) out.push(mapOne(src));
    else {
      out.push({
        key,
        status: "unknown",
        required: key !== "pages_configuration",
        userSafeMessage: "연결 테스트를 실행해 주세요.",
        operatorMessage: null,
        remediationCode: "none",
      });
    }
  }
  return out;
}

export async function runPreviewDeploymentPreflight(input: {
  readonly ownerRepo: string;
  readonly defaultBranch: string;
  readonly githubToken: string;
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
  readonly mode?: "settings_connection_test" | "before_integration_preview";
}): Promise<readonly AutoGenerationCheckResultV1[]> {
  const preflight = await runGithubProviderPreflight({
    ownerRepo: input.ownerRepo,
    defaultBranch: input.defaultBranch,
    githubToken: input.githubToken,
    capabilitySnapshot: input.capabilitySnapshot ?? null,
    mode: input.mode === "before_integration_preview" ? "before_integration_preview" : "settings_connection_test",
  });
  return mapPreviewPreflightChecksToAutoGenerationResults(preflight.checks);
}

export async function runPreviewDeploymentPreflightWithGithubResult(input: {
  readonly ownerRepo: string;
  readonly defaultBranch: string;
  readonly githubToken: string;
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
  readonly mode?: "settings_connection_test" | "before_integration_preview";
}): Promise<
  Readonly<{
    readonly checks: readonly AutoGenerationCheckResultV1[];
    readonly preflight: GithubProviderPreflightResultV1;
  }>
> {
  const preflight = await runGithubProviderPreflight({
    ownerRepo: input.ownerRepo,
    defaultBranch: input.defaultBranch,
    githubToken: input.githubToken,
    capabilitySnapshot: input.capabilitySnapshot ?? null,
    mode: input.mode === "before_integration_preview" ? "before_integration_preview" : "settings_connection_test",
  });
  return {
    checks: mapPreviewPreflightChecksToAutoGenerationResults(preflight.checks),
    preflight,
  };
}
