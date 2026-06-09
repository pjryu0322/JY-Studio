import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import {
  buildActualIntegratedAppPreviewRuntime,
  resolveActualIntegratedAppPreviewTarget,
} from "@/lib/prototype/actualIntegratedAppPreviewResolver";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  encodeGithubRefBranchPath,
  fetchBranchHeadCommitSha,
} from "@/lib/prototype/githubIntegrationBranchService";
import {
  buildGithubPagesPreviewPath,
  computeGithubPagesPreviewUrl,
  DEFAULT_GITHUB_PAGES_BRANCH,
  type GithubPagesPreviewDeploymentV1,
} from "@/lib/prototype/githubPagesPreviewDeployment";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import {
  mapArtifactTreePathsToGithubPagesPreview,
  resolveStaticPreviewArtifact,
} from "@/lib/prototype/staticPreviewArtifactResolver";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const MAX_DEPLOY_FILES = 200;

type GitTreeEntry = Readonly<{ readonly path?: string; readonly sha?: string; readonly type?: string }>;

async function githubFetchJson<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<
  | Readonly<{ readonly ok: true; readonly data: T }>
  | Readonly<{ readonly ok: false; readonly status: number; readonly body: string }>
> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/github-pages-preview",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  const txt = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: txt.slice(0, 500) };
  try {
    return { ok: true, data: JSON.parse(txt) as T };
  } catch {
    return { ok: false, status: res.status, body: txt.slice(0, 500) };
  }
}

async function fetchRecursiveTree(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly commitSha: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly entries: readonly GitTreeEntry[] }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) return { ok: false, message: "GitHub 저장소 URL이 올바르지 않습니다." };
  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(input.commitSha)}?recursive=1`;
  const res = await githubFetchJson<{ tree?: GitTreeEntry[] }>(url, input.githubToken);
  if (!res.ok) return { ok: false, message: "저장소 tree 조회에 실패했습니다." };
  return { ok: true, entries: res.data.tree ?? [] };
}

async function ensureGhPagesBranchHead(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly pagesBranch: string;
  readonly fallbackBaseBranch: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly sha: string }>
  | Readonly<{ readonly ok: false; readonly message: string; readonly pagesNotConfigured?: boolean }>
> {
  const existing = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: input.pagesBranch,
    githubToken: input.githubToken,
  });
  if (existing.ok) return { ok: true, sha: existing.sha };

  const base = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: input.fallbackBaseBranch,
    githubToken: input.githubToken,
  });
  if (!base.ok) {
    return {
      ok: false,
      message: "GitHub Pages branch(gh-pages)를 준비하지 못했습니다.",
      pagesNotConfigured: true,
    };
  }

  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  if (!parsed) return { ok: false, message: "GitHub 저장소 URL이 올바르지 않습니다." };
  const api = githubRestApiBase();
  const createUrl = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/refs`;
  const createRes = await githubFetchJson<{ ref?: string }>(createUrl, input.githubToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${input.pagesBranch}`, sha: base.sha }),
  });
  if (!createRes.ok) {
    return {
      ok: false,
      message: "GitHub Pages branch(gh-pages) 생성에 실패했습니다.",
      pagesNotConfigured: createRes.status === 403 || createRes.status === 404,
    };
  }
  return { ok: true, sha: base.sha };
}

function buildDeploymentBase(input: {
  readonly repositoryFullName: string;
  readonly sourceBranch: string;
  readonly pagesBranch: string;
  readonly pagesPath: string;
  readonly nowIso: string;
}): GithubPagesPreviewDeploymentV1 {
  return {
    status: "preparing",
    repositoryFullName: input.repositoryFullName,
    sourceBranch: input.sourceBranch,
    pagesBranch: input.pagesBranch,
    pagesPath: input.pagesPath,
    pagesUrl: null,
    deployedCommitSha: null,
    errorCode: null,
    userSafeMessage: null,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };
}

export async function deployIntegratedPreviewToGitHubPages(input: {
  readonly projectId: string;
  readonly repositoryFullName: string;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly integrationBranch: string;
  readonly pagesBranch?: string;
  readonly fallbackBaseBranch?: string;
  readonly nowIso: string;
}): Promise<{
  readonly ok: boolean;
  readonly deployment: GithubPagesPreviewDeploymentV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly pipelineStatus?: string;
}> {
  const timeline: RequirementsPromptTimelineEntry[] = [];
  const pushTimeline = (action: string, fields: Record<string, unknown>) => {
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action,
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, ...fields },
        nowIso: input.nowIso,
      }),
    );
  };

  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const pagesBranch = input.pagesBranch?.trim() || DEFAULT_GITHUB_PAGES_BRANCH;
  const pagesPath = buildGithubPagesPreviewPath(input.projectId);
  const repositoryFullName =
    input.repositoryFullName.trim() ||
    (parsed ? `${parsed.owner}/${parsed.repo}` : input.repoUrl);

  let deployment = buildDeploymentBase({
    repositoryFullName,
    sourceBranch: input.integrationBranch,
    pagesBranch,
    pagesPath,
    nowIso: input.nowIso,
  });

  pushTimeline("github_pages_preview_deploy_started", {
    integrationBranch: input.integrationBranch,
    pagesBranch,
  });

  const token = input.githubToken.trim();
  if (!token || !parsed) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "github_auth_missing",
      userSafeMessage: "GitHub Pages Preview 배포에 필요한 저장소 정보 또는 토큰이 없습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: "github_auth_missing" });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  const integrationHead = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: input.integrationBranch,
    githubToken: token,
  });
  if (!integrationHead.ok) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "integration_branch_missing",
      userSafeMessage: "통합 branch를 확인하지 못해 GitHub Pages Preview를 배포할 수 없습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: "integration_branch_missing" });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  const treeResult = await fetchRecursiveTree({
    repoUrl: input.repoUrl,
    githubToken: token,
    commitSha: integrationHead.sha,
  });
  if (!treeResult.ok) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "tree_fetch_failed",
      userSafeMessage: "GitHub Pages Preview 배포에 실패했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: "tree_fetch_failed" });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  const filePaths = treeResult.entries
    .filter((e) => e.type === "blob" && e.path)
    .map((e) => String(e.path));
  const artifact = resolveStaticPreviewArtifact({ repositoryFiles: filePaths });
  if (!artifact.ok || !artifact.artifactPath) {
    deployment = {
      ...deployment,
      status: "static_artifact_missing",
      errorCode: "static_artifact_missing",
      userSafeMessage: artifact.userSafeMessage,
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: "static_artifact_missing" });
    return {
      ok: false,
      deployment,
      timelineEntries: timeline,
      pipelineStatus: "static_preview_artifact_missing",
    };
  }

  pushTimeline("github_pages_preview_artifact_detected", { artifactPath: artifact.artifactPath });

  const mapped = mapArtifactTreePathsToGithubPagesPreview({
    projectId: input.projectId,
    artifactPath: artifact.artifactPath,
    treeEntries: treeResult.entries
      .filter((e) => e.path && e.sha && e.type)
      .map((e) => ({ path: String(e.path), sha: String(e.sha), type: String(e.type) })),
  });
  if (mapped.length === 0 || mapped.length > MAX_DEPLOY_FILES) {
    const errorCode = mapped.length === 0 ? "static_artifact_empty" : "static_artifact_too_large";
    deployment = {
      ...deployment,
      status: "static_artifact_missing",
      errorCode,
      userSafeMessage:
        mapped.length === 0
          ? "정적 Preview 산출물을 찾지 못했습니다. dist/out/build/index.html이 필요합니다."
          : "정적 Preview 산출물이 너무 많아 GitHub Pages 배포를 완료하지 못했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: errorCode });
    return {
      ok: false,
      deployment,
      timelineEntries: timeline,
      pipelineStatus: "static_preview_artifact_missing",
    };
  }

  const ghPagesHead = await ensureGhPagesBranchHead({
    repoUrl: input.repoUrl,
    githubToken: token,
    pagesBranch,
    fallbackBaseBranch: input.fallbackBaseBranch?.trim() || "main",
  });
  if (!ghPagesHead.ok) {
    deployment = {
      ...deployment,
      status: ghPagesHead.pagesNotConfigured ? "pages_not_configured" : "failed",
      errorCode: ghPagesHead.pagesNotConfigured ? "pages_not_configured" : "gh_pages_branch_failed",
      userSafeMessage: ghPagesHead.pagesNotConfigured
        ? "GitHub Pages 설정이 필요합니다. 저장소 Pages 설정에서 gh-pages branch를 활성화해 주세요."
        : "GitHub Pages branch 준비에 실패했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline(
      ghPagesHead.pagesNotConfigured
        ? "github_pages_preview_pages_not_configured"
        : "github_pages_preview_deploy_failed",
      { reason: deployment.errorCode },
    );
    return {
      ok: false,
      deployment,
      timelineEntries: timeline,
      pipelineStatus: ghPagesHead.pagesNotConfigured
        ? "github_pages_not_configured"
        : "app_preview_target_failed",
    };
  }

  pushTimeline("github_pages_preview_branch_checked", { pagesBranch, headSha: ghPagesHead.sha });

  const api = githubRestApiBase();
  const commitRes = await githubFetchJson<{ tree?: { sha?: string } }>(
    `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/commits/${encodeURIComponent(ghPagesHead.sha)}`,
    token,
  );
  if (!commitRes.ok) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "gh_pages_commit_read_failed",
      userSafeMessage: "GitHub Pages Preview 배포에 실패했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: deployment.errorCode });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  const baseTreeSha = String(commitRes.data.tree?.sha ?? "").trim();
  const pagesPrefix = pagesPath;
  const baseTreeListRes = baseTreeSha
    ? await githubFetchJson<{ tree?: GitTreeEntry[] }>(
        `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(baseTreeSha)}?recursive=1`,
        token,
      )
    : null;
  const keepEntries =
    baseTreeListRes?.ok && baseTreeListRes.data.tree
      ? baseTreeListRes.data.tree
          .filter(
            (e) =>
              e.type === "blob" &&
              e.path &&
              e.sha &&
              !String(e.path).startsWith(pagesPrefix),
          )
          .map((e) => ({
            path: String(e.path),
            mode: "100644" as const,
            type: "blob" as const,
            sha: String(e.sha),
          }))
      : [];

  const newEntries = mapped.map((row) => ({
    path: row.path,
    mode: "100644" as const,
    type: "blob" as const,
    sha: row.sha,
  }));

  const treeCreateRes = await githubFetchJson<{ sha?: string }>(
    `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_tree: baseTreeSha || undefined,
        tree: [...keepEntries, ...newEntries],
      }),
    },
  );
  if (!treeCreateRes.ok) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "gh_pages_tree_failed",
      userSafeMessage: "GitHub Pages Preview 배포에 실패했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: deployment.errorCode });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  const newTreeSha = String(treeCreateRes.data.sha ?? "").trim();
  const commitCreateRes = await githubFetchJson<{ sha?: string }>(
    `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/commits`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Deploy integrated preview for ${input.projectId}`,
        tree: newTreeSha,
        parents: [ghPagesHead.sha],
      }),
    },
  );
  if (!commitCreateRes.ok) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "gh_pages_commit_failed",
      userSafeMessage: "GitHub Pages Preview 배포에 실패했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: deployment.errorCode });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  const deployedSha = String(commitCreateRes.data.sha ?? "").trim();
  const refPath = encodeGithubRefBranchPath(pagesBranch);
  const refUpdateRes = await githubFetchJson<unknown>(
    `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/refs/heads/${refPath}`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: deployedSha, force: true }),
    },
  );
  if (!refUpdateRes.ok) {
    deployment = {
      ...deployment,
      status: "failed",
      errorCode: "gh_pages_ref_update_failed",
      userSafeMessage: "GitHub Pages Preview 배포에 실패했습니다.",
      updatedAt: input.nowIso,
    };
    pushTimeline("github_pages_preview_deploy_failed", { reason: deployment.errorCode });
    return { ok: false, deployment, timelineEntries: timeline, pipelineStatus: "app_preview_target_failed" };
  }

  pushTimeline("github_pages_preview_files_uploaded", { fileCount: newEntries.length });

  const pagesUrl = computeGithubPagesPreviewUrl({
    owner: parsed.owner,
    repo: parsed.repo,
    projectId: input.projectId,
  });

  deployment = {
    ...deployment,
    status: "deployed",
    pagesUrl,
    deployedCommitSha: deployedSha,
    updatedAt: input.nowIso,
  };
  pushTimeline("github_pages_preview_deployed", { pagesUrl });

  const target = resolveActualIntegratedAppPreviewTarget({
    projectId: input.projectId,
    integrationBranch: input.integrationBranch,
    integrationPlan: null,
    externalPreviewUrl: pagesUrl,
  });
  const previewRuntime = buildActualIntegratedAppPreviewRuntime({
    projectId: input.projectId,
    target,
    nowIso: input.nowIso,
  });

  return {
    ok: true,
    deployment,
    previewRuntime: {
      ...previewRuntime,
      githubPagesUrl: pagesUrl,
      deployedCommitSha: deployedSha,
      externalPreviewUrl: pagesUrl,
      previewUrl: pagesUrl,
      appPreviewUrl: pagesUrl,
    },
    timelineEntries: timeline,
  };
}
