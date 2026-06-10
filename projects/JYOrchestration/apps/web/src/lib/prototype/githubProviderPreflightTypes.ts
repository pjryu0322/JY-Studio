export type GithubPreflightCheckKeyV1 =
  | "repository_access"
  | "token_valid"
  | "default_branch_access"
  | "contents_read"
  | "contents_write"
  | "branch_create"
  | "branch_update"
  | "pull_request_create"
  | "workflow_file_write"
  | "actions_workflow_dispatch"
  | "workflow_run_read"
  | "gh_pages_branch_write"
  | "pages_status_read"
  | "pages_configuration_write"
  | "cursor_api_access";

export type GithubPreflightCheckStatusV1 = "passed" | "failed" | "warning" | "skipped" | "unknown";

export type GithubPreflightRemediationCodeV1 =
  | "none"
  | "reauthorize_github"
  | "enable_actions_permission"
  | "enable_workflow_permission"
  | "enable_pages"
  | "check_repository"
  | "check_token"
  | "check_cursor_api"
  | "manual_setup_required"
  | "ensure_workflow_file"
  | "ensure_workflow_dispatch"
  | "fix_workflow_inputs"
  | "fix_dispatch_ref"
  | "enable_repository_actions"
  | "retry_later"
  | "operator_review_required";

export type GithubPreflightCheckResultV1 = Readonly<{
  readonly key: GithubPreflightCheckKeyV1;
  readonly status: GithubPreflightCheckStatusV1;
  readonly required: boolean;
  readonly userSafeMessage: string | null;
  readonly operatorMessage: string | null;
  readonly remediationCode: GithubPreflightRemediationCodeV1;
}>;

export type GithubProviderPreflightLevelV1 = "ready" | "warning" | "blocked";

export type GithubProviderPreflightResultV1 = Readonly<{
  readonly ok: boolean;
  readonly level: GithubProviderPreflightLevelV1;
  readonly targetRepository: string | null;
  readonly defaultBranch: string | null;
  readonly checks: readonly GithubPreflightCheckResultV1[];
  readonly userSummary: string;
  readonly blockedReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly operatorDiagnosticsId: string | null;
  readonly checkedAt: string;
}>;

export const GITHUB_PROVIDER_PREFLIGHT_JSON_KEY = "githubProviderPreflightV1" as const;
