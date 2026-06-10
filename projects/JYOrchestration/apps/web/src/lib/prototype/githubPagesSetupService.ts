import { githubRestApiBase } from "@/lib/integration/githubRestCommon";
import { summarizeGithubResponseBodyForOperatorLog } from "@/lib/prototype/githubPreviewDeploymentFailureClassifier";
import {
  type GitHubPagesSourceModeV1,
  parseGitHubPagesSourceModeFromApiResponse,
} from "@/lib/prototype/githubPagesSetupProbeService";

export type { GitHubPagesSourceModeV1 };

export type GitHubPagesAutoConfigureFailureKindV1 =
  | "permission_denied"
  | "pages_not_enabled"
  | "repository_not_found"
  | "unsupported_repository"
  | "api_rate_limited"
  | "github_unavailable"
  | "invalid_request"
  | "unknown";

export type GitHubPagesAutoConfigureRemediationCodeV1 =
  | "none"
  | "set_pages_source_actions"
  | "add_pages_admin_permissions"
  | "enable_pages_manually"
  | "retry_later"
  | "operator_review_required";

export type GitHubPagesAutoConfigureResultV1 = Readonly<{
  readonly ok: boolean;
  readonly alreadyConfigured: boolean;
  readonly attempted: boolean;
  readonly sourceModeBefore: GitHubPagesSourceModeV1;
  readonly sourceModeAfter: GitHubPagesSourceModeV1 | null;
  readonly failureKind: GitHubPagesAutoConfigureFailureKindV1 | null;
  readonly remediationCode: GitHubPagesAutoConfigureRemediationCodeV1;
  readonly userSafeMessage: string | null;
  readonly operatorMessage: string | null;
  readonly httpStatus?: number | null;
  readonly checkedAt: string;
}>;

export const GITHUB_PAGES_AUTO_CONFIGURE_IN_PROGRESS_USER_MESSAGE =
  "GitHub Pages 배포 방식을 자동 설정하는 중입니다..." as const;

export const GITHUB_PAGES_AUTO_CONFIGURE_PERMISSION_DENIED_USER_MESSAGE =
  "GitHub Pages 자동 설정 권한이 부족합니다.\nGitHub Token 권한에서 Pages와 Administration을 Read/Write로 추가한 뒤 다시 실행해 주세요." as const;

export const GITHUB_PAGES_AUTO_CONFIGURE_SUCCESS_OPERATOR_NOTE =
  "GitHub Pages Source confirmed as GitHub Actions" as const;

const PAGES_BUILD_TYPE_WORKFLOW_BODY = JSON.stringify({ build_type: "workflow" });

async function githubPagesApiFetch(input: {
  readonly owner: string;
  readonly repo: string;
  readonly token: string;
  readonly method: "GET" | "POST" | "PUT";
}): Promise<
  Readonly<{
    readonly status: number;
    readonly bodyText: string;
    readonly bodyJson: unknown;
  }>
> {
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pages`;
  const res = await fetch(url, {
    method: input.method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${input.token}`,
      "User-Agent": "JYOrchestration/github-pages-setup",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(input.method === "GET" ? {} : { "Content-Type": "application/json" }),
    },
    ...(input.method === "GET" ? {} : { body: PAGES_BUILD_TYPE_WORKFLOW_BODY }),
  });
  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = bodyText;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = bodyText;
  }
  return { status: res.status, bodyText, bodyJson };
}

export function classifyGitHubPagesAutoConfigureHttpFailure(input: {
  readonly httpStatus: number;
  readonly responseBody?: unknown;
  readonly responseHeaders?: Record<string, string | null> | null;
}): Readonly<{
  readonly failureKind: GitHubPagesAutoConfigureFailureKindV1;
  readonly remediationCode: GitHubPagesAutoConfigureRemediationCodeV1;
  readonly userSafeMessage: string;
}> {
  const status = input.httpStatus;
  const remaining = String(input.responseHeaders?.["x-ratelimit-remaining"] ?? "").trim();
  if (status === 429 || remaining === "0") {
    return {
      failureKind: "api_rate_limited",
      remediationCode: "retry_later",
      userSafeMessage:
        "GitHub API 요청 제한으로 Pages 자동 설정을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  if (status === 401 || status === 403) {
    return {
      failureKind: "permission_denied",
      remediationCode: "add_pages_admin_permissions",
      userSafeMessage: GITHUB_PAGES_AUTO_CONFIGURE_PERMISSION_DENIED_USER_MESSAGE,
    };
  }
  if (status === 404) {
    return {
      failureKind: "pages_not_enabled",
      remediationCode: "enable_pages_manually",
      userSafeMessage:
        "GitHub Pages 설정 상태를 확인하지 못했습니다. 저장소 접근 권한과 Pages 설정을 확인해 주세요.",
    };
  }
  if (status === 422) {
    return {
      failureKind: "invalid_request",
      remediationCode: "operator_review_required",
      userSafeMessage:
        "GitHub Pages 자동 설정 요청이 처리되지 않았습니다. 운영자 로그를 확인해 주세요.",
    };
  }
  if (status >= 500) {
    return {
      failureKind: "github_unavailable",
      remediationCode: "retry_later",
      userSafeMessage: "GitHub 응답이 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    failureKind: "unknown",
    remediationCode: "operator_review_required",
    userSafeMessage:
      "GitHub Pages 자동 설정 요청이 처리되지 않았습니다. 운영자 로그를 확인해 주세요.",
  };
}

function logPagesSetup(action: string, fields: Record<string, unknown>): void {
  console.info(JSON.stringify({ action, ...fields }));
}

export async function getGitHubPagesSourceMode(input: {
  readonly owner: string;
  readonly repo: string;
  readonly githubToken: string;
  readonly projectId?: string | null;
  readonly repositoryFullName?: string | null;
}): Promise<
  Readonly<{
    readonly mode: GitHubPagesSourceModeV1;
    readonly httpStatus: number;
    readonly checkedAt: string;
  }>
> {
  const checkedAt = new Date().toISOString();
  const token = input.githubToken.trim();
  logPagesSetup("github_pages_source_check_started", {
    projectId: input.projectId ?? null,
    repositoryFullName: input.repositoryFullName ?? `${input.owner}/${input.repo}`,
  });
  if (!token) {
    logPagesSetup("github_pages_source_check_completed", {
      projectId: input.projectId ?? null,
      sourceModeBefore: "unknown",
      httpStatus: null,
      failureKind: "unknown",
    });
    return { mode: "unknown", httpStatus: 0, checkedAt };
  }
  const res = await githubPagesApiFetch({
    owner: input.owner,
    repo: input.repo,
    token,
    method: "GET",
  });
  const parsed = parseGitHubPagesSourceModeFromApiResponse({
    httpStatus: res.status,
    body: res.bodyJson,
  });
  logPagesSetup("github_pages_source_check_completed", {
    projectId: input.projectId ?? null,
    repositoryFullName: input.repositoryFullName ?? `${input.owner}/${input.repo}`,
    sourceModeBefore: parsed.mode,
    httpStatus: res.status,
    responseBodySummary: summarizeGithubResponseBodyForOperatorLog(res.bodyJson),
    checkedAt,
  });
  return { mode: parsed.mode, httpStatus: res.status, checkedAt };
}

export async function ensureGitHubPagesActionsSource(input: {
  readonly repositoryFullName: string;
  readonly owner: string;
  readonly repo: string;
  readonly projectId: string;
  readonly githubToken: string;
  readonly defaultBranch: string;
}): Promise<GitHubPagesAutoConfigureResultV1> {
  void input.defaultBranch;
  const checkedAt = new Date().toISOString();
  const token = input.githubToken.trim();
  const baseLog = {
    projectId: input.projectId,
    repositoryFullName: input.repositoryFullName,
  };

  if (!token) {
    return {
      ok: false,
      alreadyConfigured: false,
      attempted: false,
      sourceModeBefore: "unknown",
      sourceModeAfter: null,
      failureKind: "unknown",
      remediationCode: "operator_review_required",
      userSafeMessage: "GitHub Pages Preview 배포에 필요한 토큰이 없습니다.",
      operatorMessage: "missing_token",
      httpStatus: null,
      checkedAt,
    };
  }

  const initialGet = await githubPagesApiFetch({
    owner: input.owner,
    repo: input.repo,
    token,
    method: "GET",
  });
  const initialParsed = parseGitHubPagesSourceModeFromApiResponse({
    httpStatus: initialGet.status,
    body: initialGet.bodyJson,
  });
  const sourceModeBefore = initialParsed.mode;

  if (initialGet.status === 401 || initialGet.status === 403) {
    const classified = classifyGitHubPagesAutoConfigureHttpFailure({
      httpStatus: initialGet.status,
      responseBody: initialGet.bodyJson,
    });
    logPagesSetup("github_pages_actions_source_autoconfigure_failed", {
      ...baseLog,
      sourceModeBefore,
      httpStatus: initialGet.status,
      failureKind: classified.failureKind,
      remediationCode: classified.remediationCode,
      responseBodySummary: summarizeGithubResponseBodyForOperatorLog(initialGet.bodyJson),
      checkedAt,
    });
    logPagesSetup("github_pages_actions_source_required_user_action", {
      ...baseLog,
      remediationCode: classified.remediationCode,
    });
    return {
      ok: false,
      alreadyConfigured: false,
      attempted: false,
      sourceModeBefore,
      sourceModeAfter: null,
      failureKind: classified.failureKind,
      remediationCode: classified.remediationCode,
      userSafeMessage: classified.userSafeMessage,
      operatorMessage: `pages GET HTTP ${initialGet.status}`,
      httpStatus: initialGet.status,
      checkedAt,
    };
  }

  if (sourceModeBefore === "actions") {
    return {
      ok: true,
      alreadyConfigured: true,
      attempted: false,
      sourceModeBefore,
      sourceModeAfter: "actions",
      failureKind: null,
      remediationCode: "none",
      userSafeMessage: null,
      operatorMessage: null,
      httpStatus: initialGet.status,
      checkedAt,
    };
  }

  logPagesSetup("github_pages_actions_source_autoconfigure_started", {
    ...baseLog,
    sourceModeBefore,
  });

  const usePost = initialGet.status === 404;
  const mutate = await githubPagesApiFetch({
    owner: input.owner,
    repo: input.repo,
    token,
    method: usePost ? "POST" : "PUT",
  });

  const mutateOk = mutate.status === 200 || mutate.status === 201 || mutate.status === 204;
  if (!mutateOk) {
    const classified = classifyGitHubPagesAutoConfigureHttpFailure({
      httpStatus: mutate.status,
      responseBody: mutate.bodyJson,
    });
    logPagesSetup("github_pages_actions_source_autoconfigure_failed", {
      ...baseLog,
      sourceModeBefore,
      httpStatus: mutate.status,
      failureKind: classified.failureKind,
      remediationCode: classified.remediationCode,
      responseBodySummary: summarizeGithubResponseBodyForOperatorLog(mutate.bodyJson),
      checkedAt,
    });
    logPagesSetup("github_pages_actions_source_required_user_action", {
      ...baseLog,
      remediationCode:
        classified.remediationCode === "add_pages_admin_permissions"
          ? classified.remediationCode
          : "set_pages_source_actions",
    });
    return {
      ok: false,
      alreadyConfigured: false,
      attempted: true,
      sourceModeBefore,
      sourceModeAfter: null,
      failureKind: classified.failureKind,
      remediationCode:
        classified.remediationCode === "add_pages_admin_permissions"
          ? "add_pages_admin_permissions"
          : classified.remediationCode === "retry_later"
            ? "retry_later"
            : "set_pages_source_actions",
      userSafeMessage:
        classified.remediationCode === "add_pages_admin_permissions"
          ? classified.userSafeMessage
          : classified.remediationCode === "retry_later"
            ? classified.userSafeMessage
            : parseGitHubPagesSourceModeFromApiResponse({
                httpStatus: initialGet.status,
                body: initialGet.bodyJson,
              }).userSafeMessage ?? initialParsed.userSafeMessage,
      operatorMessage: `pages ${usePost ? "POST" : "PUT"} HTTP ${mutate.status}`,
      httpStatus: mutate.status,
      checkedAt,
    };
  }

  const verifyGet = await githubPagesApiFetch({
    owner: input.owner,
    repo: input.repo,
    token,
    method: "GET",
  });
  const verifyParsed = parseGitHubPagesSourceModeFromApiResponse({
    httpStatus: verifyGet.status,
    body: verifyGet.bodyJson,
  });
  const sourceModeAfter = verifyParsed.mode;
  const ok = verifyParsed.mode === "actions";

  if (ok) {
    logPagesSetup("github_pages_actions_source_autoconfigure_completed", {
      ...baseLog,
      sourceModeBefore,
      sourceModeAfter,
      httpStatus: verifyGet.status,
      remediationCode: "none",
      checkedAt,
    });
    return {
      ok: true,
      alreadyConfigured: false,
      attempted: true,
      sourceModeBefore,
      sourceModeAfter,
      failureKind: null,
      remediationCode: "none",
      userSafeMessage: null,
      operatorMessage: GITHUB_PAGES_AUTO_CONFIGURE_SUCCESS_OPERATOR_NOTE,
      httpStatus: verifyGet.status,
      checkedAt,
    };
  }

  logPagesSetup("github_pages_actions_source_autoconfigure_failed", {
    ...baseLog,
    sourceModeBefore,
    sourceModeAfter,
    httpStatus: verifyGet.status,
    failureKind: "unknown",
    remediationCode: "set_pages_source_actions",
    responseBodySummary: summarizeGithubResponseBodyForOperatorLog(verifyGet.bodyJson),
    checkedAt,
  });
  logPagesSetup("github_pages_actions_source_required_user_action", {
    ...baseLog,
    remediationCode: "set_pages_source_actions",
  });

  return {
    ok: false,
    alreadyConfigured: false,
    attempted: true,
    sourceModeBefore,
    sourceModeAfter,
    failureKind: "unknown",
    remediationCode: "set_pages_source_actions",
    userSafeMessage:
      parseGitHubPagesSourceModeFromApiResponse({
        httpStatus: verifyGet.status,
        body: verifyGet.bodyJson,
      }).userSafeMessage ?? initialParsed.userSafeMessage,
    operatorMessage: `pages verify GET mode=${sourceModeAfter}`,
    httpStatus: verifyGet.status,
    checkedAt,
  };
}
