import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { buildIntegrationBranchName } from "@/lib/prototype/implementationIntegrationPlan";
import { INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE } from "@/lib/prototype/implementationIntegrationErrors";

export function encodeGithubRefBranchPath(branch: string): string {
  const s = String(branch ?? "").trim();
  if (!s) return "";
  return s
    .split("/")
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

type RefResponse = Readonly<{ readonly object?: Readonly<{ readonly sha?: string }> }>;

async function githubFetchJson<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<
  | Readonly<{ readonly ok: true; readonly data: T; readonly status: number }>
  | Readonly<{ readonly ok: false; readonly status: number; readonly body: string }>
> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/github-integration-branch",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  const txt = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: txt.slice(0, 500) };
  try {
    return { ok: true, data: JSON.parse(txt) as T, status: res.status };
  } catch {
    return { ok: false, status: res.status, body: txt.slice(0, 500) };
  }
}

export async function fetchBranchHeadCommitSha(input: {
  readonly repoUrl: string;
  readonly branch: string;
  readonly githubToken: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly sha: string }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly httpStatus?: number }>
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) return { ok: false, message: "GitHub 저장소 URL이 올바르지 않습니다." };
  const refPath = encodeGithubRefBranchPath(input.branch);
  if (!refPath) return { ok: false, message: "branch가 비어 있습니다." };
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/ref/heads/${refPath}`;
  const res = await githubFetchJson<RefResponse>(url, input.githubToken);
  if (!res.ok) {
    return {
      ok: false,
      message: `branch ref 조회 실패 HTTP ${res.status}`,
      httpStatus: res.status,
    };
  }
  const sha = String(res.data.object?.sha ?? "").trim();
  if (!sha) return { ok: false, message: "branch head SHA가 없습니다." };
  return { ok: true, sha };
}

export function isGithubReferenceAlreadyExistsErrorBody(body: string): boolean {
  const trimmed = String(body ?? "").trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes("reference already exists")) return true;
  try {
    const parsed = JSON.parse(trimmed) as { message?: string };
    return String(parsed.message ?? "")
      .toLowerCase()
      .includes("already exists");
  } catch {
    return false;
  }
}

export function isValidProjectIntegrationBranchName(
  integrationBranch: string,
  projectId: string,
): boolean {
  const branch = integrationBranch.trim();
  if (!branch.startsWith("integration/")) return false;
  const slug = projectId.trim().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 12) || "project";
  return branch.includes(slug);
}

export type EnsureGithubIntegrationBranchResult = Readonly<{
  readonly ok: boolean;
  readonly status: "created" | "already_exists" | "failed";
  readonly integrationBranch: string;
  readonly baseCommitSha: string | null;
  readonly message: string;
  readonly rawError?: unknown;
}>;

export async function ensureGithubIntegrationBranch(input: {
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly projectId: string;
  readonly githubToken: string;
  readonly integrationBranch: string;
  readonly allowExisting?: boolean;
}): Promise<EnsureGithubIntegrationBranchResult> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) {
    return {
      ok: false,
      status: "failed",
      integrationBranch: input.integrationBranch,
      baseCommitSha: null,
      message: "GitHub 저장소 URL이 올바르지 않습니다.",
    };
  }
  const token = input.githubToken.trim();
  if (!token) {
    return {
      ok: false,
      status: "failed",
      integrationBranch: input.integrationBranch,
      baseCommitSha: null,
      message: "GitHub token이 필요합니다.",
    };
  }

  const branchName = input.integrationBranch.trim();
  if (!branchName) {
    return {
      ok: false,
      status: "failed",
      integrationBranch: "",
      baseCommitSha: null,
      message: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
    };
  }
  if (!isValidProjectIntegrationBranchName(branchName, input.projectId)) {
    return {
      ok: false,
      status: "failed",
      integrationBranch: branchName,
      baseCommitSha: null,
      message: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
    };
  }

  const allowExisting = input.allowExisting !== false;
  const existingHead = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: branchName,
    githubToken: token,
  });
  if (existingHead.ok) {
    if (!allowExisting) {
      return {
        ok: false,
        status: "failed",
        integrationBranch: branchName,
        baseCommitSha: existingHead.sha,
        message: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
      };
    }
    return {
      ok: true,
      status: "already_exists",
      integrationBranch: branchName,
      baseCommitSha: existingHead.sha,
      message: "기존 통합 branch를 이어서 사용합니다.",
    };
  }

  const baseHead = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: input.baseBranch,
    githubToken: token,
  });
  if (!baseHead.ok) {
    return {
      ok: false,
      status: "failed",
      integrationBranch: branchName,
      baseCommitSha: null,
      message: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
      rawError: baseHead.message,
    };
  }

  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/refs`;
  const createRes = await githubFetchJson<{ ref?: string }>(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseHead.sha,
    }),
  });

  if (!createRes.ok) {
    if (
      createRes.status === 422 &&
      isGithubReferenceAlreadyExistsErrorBody(createRes.body) &&
      allowExisting
    ) {
      const reused = await fetchBranchHeadCommitSha({
        repoUrl: input.repoUrl,
        branch: branchName,
        githubToken: token,
      });
      if (reused.ok) {
        return {
          ok: true,
          status: "already_exists",
          integrationBranch: branchName,
          baseCommitSha: reused.sha,
          message: "기존 통합 branch를 이어서 사용합니다.",
          rawError: { rawStatus: 422, reason: "reference_already_exists", body: createRes.body },
        };
      }
    }
    return {
      ok: false,
      status: "failed",
      integrationBranch: branchName,
      baseCommitSha: null,
      message: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE,
      rawError: { status: createRes.status, body: createRes.body },
    };
  }

  return {
    ok: true,
    status: "created",
    integrationBranch: branchName,
    baseCommitSha: baseHead.sha,
    message: "integration branch created",
  };
}

export async function createGithubIntegrationBranch(input: {
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly projectId: string;
  readonly githubToken: string;
  readonly integrationBranch?: string;
  readonly now?: Date;
}): Promise<
  | Readonly<{ readonly ok: true; readonly integrationBranch: string; readonly baseCommitSha: string }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const branchName =
    input.integrationBranch?.trim() ||
    buildIntegrationBranchName({ projectId: input.projectId, now: input.now });

  const ensured = await ensureGithubIntegrationBranch({
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    projectId: input.projectId,
    githubToken: input.githubToken,
    integrationBranch: branchName,
    allowExisting: true,
  });

  if (!ensured.ok || ensured.status === "failed") {
    return { ok: false, message: ensured.message };
  }
  const sha = ensured.baseCommitSha?.trim();
  if (!sha) {
    return { ok: false, message: INTEGRATION_BRANCH_PREPARE_FAILURE_USER_MESSAGE };
  }
  return { ok: true, integrationBranch: ensured.integrationBranch, baseCommitSha: sha };
}
