import { githubRestApiBase } from "@/lib/integration/githubRestCommon";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import { JYO_PREVIEW_PAGES_WORKFLOW_FILE } from "@/lib/prototype/githubPagesWorkflowService";
import type {
  GithubPreflightCheckKeyV1,
  GithubPreflightCheckResultV1,
  GithubPreflightCheckStatusV1,
  GithubPreflightRemediationCodeV1,
  GithubProviderPreflightLevelV1,
  GithubProviderPreflightResultV1,
} from "@/lib/prototype/githubProviderPreflightTypes";

function check(
  key: GithubPreflightCheckKeyV1,
  status: GithubPreflightCheckStatusV1,
  input: {
    readonly required?: boolean;
    readonly userSafeMessage?: string | null;
    readonly operatorMessage?: string | null;
    readonly remediationCode?: GithubPreflightRemediationCodeV1;
  },
): GithubPreflightCheckResultV1 {
  return {
    key,
    status,
    required: input.required ?? true,
    userSafeMessage: input.userSafeMessage ?? null,
    operatorMessage: input.operatorMessage ?? null,
    remediationCode: input.remediationCode ?? "none",
  };
}

function permissionLevel(accepted: string | null | undefined, name: string): "write" | "read" | "none" {
  const text = String(accepted ?? "").toLowerCase();
  if (!text) return "none";
  const re = new RegExp(`${name}\\s*=\\s*(write|read)`, "i");
  const m = text.match(re);
  if (!m) return "none";
  return m[1] === "write" ? "write" : "read";
}

async function githubFetchStatus(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<{ readonly status: number; readonly body: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/github-provider-preflight",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text().catch(() => "");
  return { status: res.status, body: body.slice(0, 500) };
}

export function derivePreviewDeploymentReadyFromPreflight(
  preflight: GithubProviderPreflightResultV1 | null | undefined,
): boolean {
  if (!preflight) return true;
  if (preflight.level === "blocked") return false;
  const blockers = new Set<GithubPreflightCheckKeyV1>([
    "actions_workflow_dispatch",
    "workflow_file_write",
    "gh_pages_branch_write",
    "pages_status_read",
  ]);
  for (const c of preflight.checks) {
    if (!c.required) continue;
    if (!blockers.has(c.key)) continue;
    if (c.status === "failed") return false;
  }
  return preflight.ok;
}

export async function runGithubProviderPreflight(input: {
  readonly ownerRepo: string;
  readonly defaultBranch: string;
  readonly githubToken: string;
  readonly cursorApiConfigured?: boolean;
  readonly capabilitySnapshot?: GithubCapabilityValidationSnapshot | null;
  readonly mode: "settings_connection_test" | "before_quick_run" | "before_integration_preview";
}): Promise<GithubProviderPreflightResultV1> {
  void input.mode;
  const nowIso = new Date().toISOString();
  const ownerRepo = input.ownerRepo.trim();
  const token = input.githubToken.trim();
  const cap = input.capabilitySnapshot ?? null;
  const accepted = cap?.canonicalRepoGetAcceptedPermissions ?? cap?.acceptedPermissionsHeader ?? null;

  const checks: GithubPreflightCheckResultV1[] = [];
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  const repoOk = cap?.repoAccessOk === true;
  checks.push(
    check("repository_access", repoOk ? "passed" : cap ? "failed" : "unknown", {
      userSafeMessage: repoOk
        ? null
        : "GitHub 저장소를 확인할 수 없습니다. owner/repo 값을 확인해 주세요.",
      remediationCode: "check_repository",
      operatorMessage: cap?.lastErrorMessage ?? null,
    }),
  );

  checks.push(
    check("token_valid", cap?.githubOperableOk === true ? "passed" : cap ? "failed" : "unknown", {
      userSafeMessage: cap?.githubOperableOk
        ? null
        : "GitHub Token 권한을 확인할 수 없습니다. Token을 다시 저장한 뒤 연결 테스트를 실행해 주세요.",
      remediationCode: "check_token",
    }),
  );

  checks.push(
    check("default_branch_access", repoOk ? "passed" : "unknown", {
      required: false,
    }),
  );

  const contentsWrite =
    cap?.prCreateOk === true ||
    permissionLevel(accepted, "contents") === "write" ||
    cap?.steps?.some((s) => s.step === "repo_compare_self" && s.ok);
  checks.push(
    check("contents_write", contentsWrite ? "passed" : cap ? "failed" : "unknown", {
      userSafeMessage: contentsWrite
        ? null
        : "GitHub 파일 생성/수정 권한이 필요합니다.",
      remediationCode: "reauthorize_github",
    }),
  );

  checks.push(
    check("contents_read", repoOk ? "passed" : "unknown", { required: false }),
  );

  const branchOk = cap?.steps?.some((s) => s.step === "repo_compare_self" && s.ok) ?? repoOk;
  checks.push(
    check("branch_create", branchOk ? "passed" : cap ? "failed" : "unknown", {
      userSafeMessage: branchOk ? null : "GitHub branch 생성 권한이 필요합니다.",
      remediationCode: "reauthorize_github",
    }),
  );
  checks.push(check("branch_update", branchOk ? "passed" : "unknown", { required: false }));

  const prOk = cap?.prCreateOk === true;
  checks.push(
    check("pull_request_create", prOk ? "passed" : cap ? "warning" : "unknown", {
      required: false,
      userSafeMessage: prOk ? null : "GitHub PR 생성 권한이 없으면 통합 PR 단계가 제한될 수 있습니다.",
      remediationCode: "reauthorize_github",
    }),
  );

  const workflowWrite = permissionLevel(accepted, "workflows") === "write" || contentsWrite;
  checks.push(
    check("workflow_file_write", workflowWrite ? "passed" : cap ? "failed" : "unknown", {
      userSafeMessage: workflowWrite
        ? null
        : "GitHub workflow 파일 생성 권한이 필요합니다.",
      remediationCode: "enable_workflow_permission",
    }),
  );

  let actionsDispatchOk = permissionLevel(accepted, "actions") === "write";
  let actionsOperator: string | null = null;
  if (token && ownerRepo.includes("/")) {
    const [owner, repo] = ownerRepo.split("/");
    const api = githubRestApiBase();
    const wfUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(JYO_PREVIEW_PAGES_WORKFLOW_FILE)}/dispatches`;
    const probe = await githubFetchStatus(wfUrl, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: input.defaultBranch.trim() || "main", inputs: {} }),
    });
    if (probe.status === 204 || probe.status === 201) {
      actionsDispatchOk = true;
    } else if (probe.status === 403 || probe.status === 401) {
      actionsDispatchOk = false;
      actionsOperator = `workflow_dispatch HTTP ${probe.status}`;
    } else if (probe.status === 404) {
      actionsDispatchOk = workflowWrite;
      actionsOperator = "workflow_dispatch workflow_missing";
    }
  }
  checks.push(
    check("actions_workflow_dispatch", actionsDispatchOk ? "passed" : "failed", {
      userSafeMessage: actionsDispatchOk
        ? null
        : "GitHub Actions 실행 권한이 필요합니다.\nGitHub 연동 권한을 다시 승인한 뒤 연결 테스트를 다시 실행해 주세요.",
      remediationCode: "enable_actions_permission",
      operatorMessage: actionsOperator,
    }),
  );

  checks.push(check("workflow_run_read", "skipped", { required: false }));

  let ghPagesOk = false;
  let pagesReadOk = false;
  let pagesOperator: string | null = null;
  if (token && ownerRepo.includes("/")) {
    const [owner, repo] = ownerRepo.split("/");
    const api = githubRestApiBase();
    const ref = await githubFetchStatus(
      `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/gh-pages`,
      token,
    );
    ghPagesOk = ref.status === 200 || ref.status === 201 || contentsWrite;
    if (ref.status === 403) {
      ghPagesOk = false;
      pagesOperator = `gh-pages ref HTTP ${ref.status}`;
    }
    const pages = await githubFetchStatus(
      `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`,
      token,
    );
    pagesReadOk = pages.status === 200;
    if (pages.status === 404) {
      pagesReadOk = false;
    }
  }

  checks.push(
    check("gh_pages_branch_write", ghPagesOk ? "passed" : "warning", {
      userSafeMessage: ghPagesOk ? null : "GitHub Pages 배포 branch(gh-pages) 확인이 필요합니다.",
      remediationCode: "enable_pages",
      operatorMessage: pagesOperator,
    }),
  );

  checks.push(
    check("pages_status_read", pagesReadOk ? "passed" : "warning", {
      userSafeMessage: pagesReadOk
        ? null
        : "GitHub Pages 설정이 비활성화되어 있거나 확인할 수 없습니다.",
      remediationCode: "enable_pages",
    }),
  );

  checks.push(check("pages_configuration_write", "skipped", { required: false }));

  checks.push(
    check("cursor_api_access", input.cursorApiConfigured ? "passed" : "unknown", {
      required: false,
      userSafeMessage: input.cursorApiConfigured ? null : "Cursor API 연결을 확인해 주세요.",
      remediationCode: "check_cursor_api",
    }),
  );

  for (const c of checks) {
    if (!c.required) {
      if (c.status === "warning" && c.userSafeMessage) warnings.push(c.userSafeMessage);
      continue;
    }
    if (c.status === "failed" && c.userSafeMessage) blockedReasons.push(c.userSafeMessage);
    if (c.status === "warning" && c.userSafeMessage) warnings.push(c.userSafeMessage);
  }

  const requiredFailed = checks.some((c) => c.required && c.status === "failed");
  let level: GithubProviderPreflightLevelV1 = "ready";
  if (requiredFailed) level = "blocked";
  else if (warnings.length > 0) level = "warning";

  const userSummary =
    blockedReasons[0] ??
    warnings[0] ??
    (level === "ready" ? "자동 생성 및 Preview 배포 사전점검이 완료되었습니다." : "사전점검 결과를 확인해 주세요.");

  return {
    ok: !requiredFailed,
    level,
    targetRepository: ownerRepo || null,
    defaultBranch: input.defaultBranch.trim() || null,
    checks,
    userSummary,
    blockedReasons,
    warnings,
    operatorDiagnosticsId: `github-preflight-${Date.now()}`,
    checkedAt: nowIso,
  };
}
