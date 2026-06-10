import { githubRestApiBase } from "@/lib/integration/githubRestCommon";
import { readGithubAcceptedPermissionsHeader } from "@/lib/integration/githubAcceptedPermissionsHeader";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import {
  GITHUB_PAGES_ACTIONS_SOURCE_USER_MESSAGE,
  GITHUB_PAGES_BRANCH_SOURCE_SWITCH_MESSAGE,
  GITHUB_PAGES_SOURCE_UNKNOWN_MESSAGE,
  parseGitHubPagesSourceModeFromApiResponse,
  resolvePagesSourcePreflightForIntegration,
} from "@/lib/prototype/githubPagesSetupProbeService";
import { JYO_PREVIEW_PAGES_WORKFLOW_FILE, probeJyoPreviewPagesWorkflowDispatch } from "@/lib/prototype/githubPagesWorkflowService";
import type { GitHubWorkflowDispatchRemediationCodeV1 } from "@/lib/prototype/githubPreviewDeploymentFailureClassifier";
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

function mapDispatchRemediationToPreflight(
  code: GitHubWorkflowDispatchRemediationCodeV1,
): GithubPreflightRemediationCodeV1 {
  switch (code) {
    case "none":
      return "none";
    case "enable_actions_permission":
      return "enable_actions_permission";
    case "enable_workflow_permission":
      return "enable_workflow_permission";
    case "ensure_workflow_file":
      return "ensure_workflow_file";
    case "ensure_workflow_dispatch":
      return "ensure_workflow_dispatch";
    case "fix_workflow_inputs":
      return "fix_workflow_inputs";
    case "fix_dispatch_ref":
      return "fix_dispatch_ref";
    case "enable_repository_actions":
      return "enable_repository_actions";
    case "retry_later":
      return "retry_later";
    case "operator_review_required":
      return "operator_review_required";
    default:
      return "manual_setup_required";
  }
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

async function refreshGithubCapabilityAcceptedPermissionsLive(input: {
  readonly ownerRepo: string;
  readonly token: string;
  readonly baseCap: GithubCapabilityValidationSnapshot | null;
}): Promise<GithubCapabilityValidationSnapshot | null> {
  const ownerRepo = input.ownerRepo.trim();
  const token = input.token.trim();
  if (!token || !ownerRepo.includes("/")) return input.baseCap;
  const [owner, repo] = ownerRepo.split("/");
  const api = githubRestApiBase();
  const res = await fetch(
    `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/github-provider-preflight-live",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  const accepted = readGithubAcceptedPermissionsHeader(res);
  const repoAccessOk = res.ok;
  return {
    ...(input.baseCap ?? {}),
    repoAccessOk: repoAccessOk || input.baseCap?.repoAccessOk === true,
    githubOperableOk: repoAccessOk || input.baseCap?.githubOperableOk === true,
    canonicalRepoGetAcceptedPermissions:
      accepted ?? input.baseCap?.canonicalRepoGetAcceptedPermissions ?? null,
    acceptedPermissionsHeader: accepted ?? input.baseCap?.acceptedPermissionsHeader ?? null,
    lastHttpStatus: res.status,
  };
}

export function derivePreviewDeploymentReadyFromPreflight(
  preflight: GithubProviderPreflightResultV1 | null | undefined,
): boolean {
  if (!preflight) return true;
  if (preflight.level === "blocked") return false;
  const blockers = new Set<GithubPreflightCheckKeyV1>([
    "actions_workflow_dispatch",
    "workflow_file_write",
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
  readonly projectId?: string | null;
  readonly integrationBranch?: string | null;
}): Promise<GithubProviderPreflightResultV1> {
  const nowIso = new Date().toISOString();
  const ownerRepo = input.ownerRepo.trim();
  const token = input.githubToken.trim();
  const integrationLive = input.mode === "before_integration_preview";
  let cap: GithubCapabilityValidationSnapshot | null = input.capabilitySnapshot ?? null;
  if (integrationLive) {
    cap = await refreshGithubCapabilityAcceptedPermissionsLive({
      ownerRepo,
      token,
      baseCap: cap,
    });
  }
  let accepted = cap?.canonicalRepoGetAcceptedPermissions ?? cap?.acceptedPermissionsHeader ?? null;

  const checks: GithubPreflightCheckResultV1[] = [];
  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  const repoOk = cap?.repoAccessOk === true;
  checks.push(
    check("repository_access", repoOk ? "passed" : cap ? "failed" : integrationLive ? "passed" : "unknown", {
      userSafeMessage: repoOk
        ? null
        : "GitHub 저장소를 확인할 수 없습니다. owner/repo 값을 확인해 주세요.",
      remediationCode: "check_repository",
      operatorMessage: cap?.lastErrorMessage ?? null,
    }),
  );

  checks.push(
    check("token_valid", cap?.githubOperableOk === true ? "passed" : cap ? "failed" : integrationLive ? "passed" : "unknown", {
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

  let actionsDispatchOk = permissionLevel(accepted, "actions") === "write";
  let actionsOperator: string | null = null;
  let actionsUserMessage: string | null = null;
  let actionsRemediation: GithubPreflightRemediationCodeV1 = "enable_actions_permission";

  const defaultBranch = input.defaultBranch.trim() || "main";
  const integrationBranch = String(input.integrationBranch ?? "").trim();
  const projectId = String(input.projectId ?? "").trim();
  const probeProjectId =
    projectId || (integrationLive ? "integration-preflight-probe" : "settings-preflight-probe");
  const probeSourceBranch = integrationBranch || defaultBranch;

  if (token && ownerRepo.includes("/") && probeProjectId) {
    const repoUrl = `https://github.com/${ownerRepo}`;
    const probe = await probeJyoPreviewPagesWorkflowDispatch({
      repoUrl,
      githubToken: token,
      workflowRefBranch: defaultBranch,
      projectId: probeProjectId,
      integrationBranch: probeSourceBranch,
    });
    actionsDispatchOk = probe.ok;
    actionsOperator = probe.operatorMessage;
    actionsUserMessage = probe.userSafeMessage;
    actionsRemediation = mapDispatchRemediationToPreflight(probe.remediationCode);
    if (!probe.ok && probe.failureKind === "permission_denied") {
      actionsDispatchOk = false;
    } else if (!probe.ok) {
      actionsDispatchOk = false;
    }
  } else if (token && ownerRepo.includes("/")) {
    const [owner, repo] = ownerRepo.split("/");
    const api = githubRestApiBase();
    const wfUrl = `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(JYO_PREVIEW_PAGES_WORKFLOW_FILE)}/dispatches`;
    const probe = await githubFetchStatus(wfUrl, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: defaultBranch,
        inputs: {
          project_id: "settings-preflight-probe",
          source_branch: defaultBranch,
          pages_path: "previews/settings-preflight-probe",
        },
      }),
    });
    if (probe.status === 204 || probe.status === 201) {
      actionsDispatchOk = true;
    } else if (probe.status === 403 || probe.status === 401) {
      actionsDispatchOk = false;
      actionsOperator = `workflow_dispatch HTTP ${probe.status}`;
      actionsRemediation = "enable_actions_permission";
    } else if (probe.status === 404) {
      actionsDispatchOk = false;
      actionsOperator = "workflow_dispatch workflow_missing";
      actionsRemediation = "ensure_workflow_file";
      actionsUserMessage =
        "Preview 배포 workflow를 찾지 못했습니다. workflow 파일이 기본 브랜치에 반영되었는지 확인해야 합니다.";
    } else if (probe.status === 422 || probe.status === 400) {
      actionsDispatchOk = false;
      actionsOperator = `workflow_dispatch HTTP ${probe.status}`;
      actionsRemediation = "fix_workflow_inputs";
      actionsUserMessage =
        "Preview 배포 workflow 실행 조건을 확인해야 합니다. workflow 입력값 또는 실행 branch 설정이 맞지 않습니다.";
    }
  }

  const workflowWrite =
    permissionLevel(accepted, "workflows") === "write" ||
    contentsWrite ||
    (integrationLive && actionsDispatchOk);

  checks.push(
    check("contents_write", contentsWrite ? "passed" : cap ? "failed" : integrationLive ? "passed" : "unknown", {
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

  checks.push(
    check("workflow_file_write", workflowWrite ? "passed" : integrationLive ? "failed" : cap ? "failed" : "unknown", {
      userSafeMessage: workflowWrite
        ? null
        : "GitHub workflow 파일 생성 권한이 필요합니다.",
      remediationCode: "enable_workflow_permission",
    }),
  );

  checks.push(
    check("actions_workflow_dispatch", actionsDispatchOk ? "passed" : "failed", {
      userSafeMessage: actionsDispatchOk
        ? null
        : actionsUserMessage ??
          "GitHub Actions 실행 권한이 필요합니다.\nGitHub 연동 권한을 다시 승인한 뒤 연결 테스트를 다시 실행해 주세요.",
      remediationCode: actionsRemediation,
      operatorMessage: actionsOperator,
    }),
  );

  checks.push(check("workflow_run_read", "skipped", { required: false }));

  let pagesOperator: string | null = null;
  let pagesSourceStatus: GithubPreflightCheckStatusV1 = "unknown";
  let pagesSourceUserMessage: string | null = null;
  let pagesSourceRemediation: GithubPreflightRemediationCodeV1 = "set_pages_source_actions";

  if (token && ownerRepo.includes("/")) {
    const [owner, repo] = ownerRepo.split("/");
    const api = githubRestApiBase();
    const pages = await githubFetchStatus(
      `${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`,
      token,
    );
    pagesOperator = `pages API HTTP ${pages.status}`;
    let pagesBody: unknown = null;
    if (pages.body) {
      try {
        pagesBody = JSON.parse(pages.body);
      } catch {
        pagesBody = null;
      }
    }
    const parsed = parseGitHubPagesSourceModeFromApiResponse({
      httpStatus: pages.status,
      body: pagesBody,
    });
    const integrationPreflight = resolvePagesSourcePreflightForIntegration(parsed.mode, {
      disabled: GITHUB_PAGES_ACTIONS_SOURCE_USER_MESSAGE,
      branch: GITHUB_PAGES_BRANCH_SOURCE_SWITCH_MESSAGE,
      unknown: GITHUB_PAGES_SOURCE_UNKNOWN_MESSAGE,
    });
    const useIntegrationStrict = integrationLive;
    pagesSourceStatus = useIntegrationStrict
      ? integrationPreflight.status
      : parsed.preflightStatus === "failed"
        ? "warning"
        : parsed.preflightStatus;
    pagesSourceUserMessage = useIntegrationStrict
      ? integrationPreflight.userSafeMessage
      : parsed.mode === "actions"
        ? null
        : parsed.userSafeMessage;
    pagesSourceRemediation = integrationPreflight.remediationCode;
    pagesOperator = `${pagesOperator}; sourceMode=${parsed.mode}`;
  }

  checks.push(
    check("gh_pages_branch_write", "skipped", {
      required: false,
      userSafeMessage: null,
      remediationCode: "none",
      operatorMessage: "gh-pages branch not required for Actions Pages deploy",
    }),
  );

  checks.push(
    check("pages_status_read", pagesSourceStatus, {
      required: integrationLive,
      userSafeMessage: pagesSourceUserMessage,
      remediationCode: pagesSourceRemediation,
      operatorMessage: pagesOperator,
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
