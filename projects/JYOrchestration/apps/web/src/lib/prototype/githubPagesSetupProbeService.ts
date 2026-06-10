export type GitHubPagesSourceModeV1 = "actions" | "branch" | "disabled" | "unknown";

export const GITHUB_PAGES_ACTIONS_SOURCE_USER_MESSAGE =
  "GitHub Pages 설정이 필요합니다.\n저장소 Settings → Pages에서 Source를 GitHub Actions로 선택한 뒤 다시 통합 및 Preview 준비를 실행해 주세요." as const;

export const GITHUB_PAGES_ACTIONS_SOURCE_SHORT_MESSAGE =
  "GitHub Pages 설정이 필요합니다. Source를 GitHub Actions로 선택해 주세요." as const;

export const GITHUB_PAGES_BRANCH_SOURCE_SWITCH_MESSAGE =
  "GitHub Pages 배포 방식을 GitHub Actions로 변경하는 것이 필요합니다.\n저장소 Settings → Pages에서 Source를 GitHub Actions로 선택해 주세요." as const;

export const GITHUB_PAGES_SOURCE_UNKNOWN_MESSAGE =
  "GitHub Pages 설정 상태를 확인하지 못했습니다.\n저장소 Settings → Pages에서 Source가 GitHub Actions인지 확인해 주세요." as const;

export function parseGitHubPagesSourceModeFromApiResponse(input: {
  readonly httpStatus: number;
  readonly body: unknown;
}): Readonly<{
  readonly mode: GitHubPagesSourceModeV1;
  readonly userSafeMessage: string | null;
  readonly remediationCode: "set_pages_source_actions" | "none";
  readonly preflightStatus: "passed" | "warning" | "failed";
}> {
  if (input.httpStatus === 404) {
    return {
      mode: "disabled",
      userSafeMessage: GITHUB_PAGES_ACTIONS_SOURCE_USER_MESSAGE,
      remediationCode: "set_pages_source_actions",
      preflightStatus: "failed",
    };
  }
  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    return {
      mode: "unknown",
      userSafeMessage: GITHUB_PAGES_SOURCE_UNKNOWN_MESSAGE,
      remediationCode: "set_pages_source_actions",
      preflightStatus: "warning",
    };
  }
  const o = input.body as Record<string, unknown>;
  const buildType = String(o.build_type ?? "").trim().toLowerCase();
  if (buildType === "workflow") {
    return {
      mode: "actions",
      userSafeMessage: null,
      remediationCode: "none",
      preflightStatus: "passed",
    };
  }
  const source = o.source;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const src = source as Record<string, unknown>;
    const branch = String(src.branch ?? "").trim();
    if (branch) {
      return {
        mode: "branch",
        userSafeMessage: GITHUB_PAGES_BRANCH_SOURCE_SWITCH_MESSAGE,
        remediationCode: "set_pages_source_actions",
        preflightStatus: "warning",
      };
    }
  }
  if (buildType === "legacy" || buildType === "pages") {
    return {
      mode: "branch",
      userSafeMessage: GITHUB_PAGES_BRANCH_SOURCE_SWITCH_MESSAGE,
      remediationCode: "set_pages_source_actions",
      preflightStatus: "warning",
    };
  }
  return {
    mode: "unknown",
    userSafeMessage: GITHUB_PAGES_SOURCE_UNKNOWN_MESSAGE,
    remediationCode: "set_pages_source_actions",
    preflightStatus: "warning",
  };
}

export function resolvePagesSourcePreflightForIntegration(
  mode: GitHubPagesSourceModeV1,
  messages: Readonly<{
    readonly disabled: string;
    readonly branch: string;
    readonly unknown: string;
  }>,
): Readonly<{
  readonly status: "passed" | "warning" | "failed";
  readonly userSafeMessage: string | null;
  readonly remediationCode: "set_pages_source_actions" | "none";
}> {
  switch (mode) {
    case "actions":
      return { status: "passed", userSafeMessage: null, remediationCode: "none" };
    case "disabled":
      return {
        status: "failed",
        userSafeMessage: messages.disabled,
        remediationCode: "set_pages_source_actions",
      };
    case "branch":
      return {
        status: "failed",
        userSafeMessage: messages.branch,
        remediationCode: "set_pages_source_actions",
      };
    default:
      return {
        status: "warning",
        userSafeMessage: messages.unknown,
        remediationCode: "set_pages_source_actions",
      };
  }
}
