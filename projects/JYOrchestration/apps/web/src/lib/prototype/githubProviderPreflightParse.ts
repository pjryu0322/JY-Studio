import type {
  GithubPreflightCheckKeyV1,
  GithubPreflightCheckResultV1,
  GithubPreflightCheckStatusV1,
  GithubProviderPreflightLevelV1,
  GithubProviderPreflightResultV1,
} from "@/lib/prototype/githubProviderPreflightTypes";

function readString(v: unknown): string {
  return String(v ?? "").trim();
}

const CHECK_KEYS = new Set<GithubPreflightCheckKeyV1>([
  "repository_access",
  "token_valid",
  "default_branch_access",
  "contents_read",
  "contents_write",
  "branch_create",
  "branch_update",
  "pull_request_create",
  "workflow_file_write",
  "actions_workflow_dispatch",
  "workflow_run_read",
  "gh_pages_branch_write",
  "pages_status_read",
  "pages_configuration_write",
  "cursor_api_access",
]);

const STATUSES = new Set<GithubPreflightCheckStatusV1>([
  "passed",
  "failed",
  "warning",
  "skipped",
  "unknown",
]);

export function parseGithubProviderPreflightV1(raw: unknown): GithubProviderPreflightResultV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const level = readString(o.level) as GithubProviderPreflightLevelV1;
  if (!["ready", "warning", "blocked"].includes(level)) return null;
  const checksRaw = Array.isArray(o.checks) ? o.checks : [];
  const checks: GithubPreflightCheckResultV1[] = [];
  for (const item of checksRaw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const key = readString(c.key) as GithubPreflightCheckKeyV1;
    const status = readString(c.status) as GithubPreflightCheckStatusV1;
    if (!CHECK_KEYS.has(key) || !STATUSES.has(status)) continue;
    checks.push({
      key,
      status,
      required: c.required !== false,
      userSafeMessage: readString(c.userSafeMessage) || null,
      operatorMessage: readString(c.operatorMessage) || null,
      remediationCode: (readString(c.remediationCode) || "none") as GithubPreflightCheckResultV1["remediationCode"],
    });
  }
  return {
    ok: o.ok === true,
    level,
    targetRepository: readString(o.targetRepository) || null,
    defaultBranch: readString(o.defaultBranch) || null,
    checks,
    userSummary: readString(o.userSummary) || "",
    blockedReasons: Array.isArray(o.blockedReasons)
      ? o.blockedReasons.map((x) => readString(x)).filter(Boolean)
      : [],
    warnings: Array.isArray(o.warnings) ? o.warnings.map((x) => readString(x)).filter(Boolean) : [],
    operatorDiagnosticsId: readString(o.operatorDiagnosticsId) || null,
    checkedAt: readString(o.checkedAt) || new Date().toISOString(),
  };
}
