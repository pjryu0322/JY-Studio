import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import {
  buildActualIntegratedAppPreviewRuntime,
  resolveActualIntegratedAppPreviewTarget,
} from "@/lib/prototype/actualIntegratedAppPreviewResolver";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { fetchBranchHeadCommitSha } from "@/lib/prototype/githubIntegrationBranchService";
import {
  buildGithubPagesPreviewPath,
  computeGithubPagesPreviewUrl,
  DEFAULT_GITHUB_PAGES_BRANCH,
  type GithubPagesPreviewDeploymentV1,
} from "@/lib/prototype/githubPagesPreviewDeployment";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { resolveStaticPreviewArtifact } from "@/lib/prototype/staticPreviewArtifactResolver";
import { getRepoUtf8FileIfExists } from "@/lib/prototype/githubRepoUtf8Contents";
import {
  dispatchGithubPagesPreviewWorkflow,
  ensureJyoPreviewPagesWorkflowOnBranch,
  JYO_PREVIEW_PAGES_WORKFLOW_FILE,
  pollGithubPagesPreviewWorkflowResult,
} from "@/lib/prototype/githubPagesWorkflowService";
import { resolveStaticAppBuildContract } from "@/lib/prototype/staticAppBuildContractResolver";
import { ensureStaticAppBuildContractOnIntegrationBranch } from "@/lib/prototype/staticAppBuildContractScaffoldService";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const WORKFLOW_POLL_TIMEOUT_MS = 120_000;

type GitTreeEntry = Readonly<{ readonly path?: string; readonly sha?: string; readonly type?: string }>;

async function runJyoPreviewPagesWorkflowDeploy(input: {
  readonly projectId: string;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly repositoryFullName: string;
  readonly integrationBranch: string;
  readonly workflowRefBranch: string;
  readonly pagesPath: string;
  readonly deployment: GithubPagesPreviewDeploymentV1;
  readonly nowIso: string;
  readonly pushTimeline: (action: string, fields: Record<string, unknown>) => void;
}): Promise<{
  readonly ok: boolean;
  readonly deployment: GithubPagesPreviewDeploymentV1;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1;
  readonly pipelineStatus?: string;
}> {
  const pagesPathForWorkflow = input.pagesPath.replace(/\/$/, "");
  input.pushTimeline("github_pages_workflow_ensured", { branch: input.workflowRefBranch });
  const wfOnBase = await ensureJyoPreviewPagesWorkflowOnBranch({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    branch: input.workflowRefBranch,
  });
  const dispatchRefBranch = wfOnBase.ok ? input.workflowRefBranch : input.integrationBranch;
  if (!wfOnBase.ok) {
    await ensureJyoPreviewPagesWorkflowOnBranch({
      repoUrl: input.repoUrl,
      githubToken: input.githubToken,
      branch: input.integrationBranch,
    });
  }

  input.pushTimeline("github_pages_workflow_dispatch_started", {
    sourceBranch: input.integrationBranch,
    dispatchRef: dispatchRefBranch,
    pagesPath: pagesPathForWorkflow,
  });
  const dispatch = await dispatchGithubPagesPreviewWorkflow({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    workflowRefBranch: dispatchRefBranch,
    repositoryFullName: input.repositoryFullName,
    workflowFileName: JYO_PREVIEW_PAGES_WORKFLOW_FILE,
    sourceBranch: input.integrationBranch,
    projectId: input.projectId,
    pagesPath: pagesPathForWorkflow,
  });

  if (!dispatch.ok) {
    const deployment = {
      ...input.deployment,
      status: "failed" as const,
      errorCode: dispatch.errorCode ?? "workflow_dispatch_failed",
      userSafeMessage: dispatch.userSafeMessage,
      updatedAt: input.nowIso,
    };
    input.pushTimeline("github_pages_workflow_dispatch_failed", { reason: deployment.errorCode });
    return {
      ok: false,
      deployment,
      pipelineStatus: "app_preview_target_failed",
    };
  }

  input.pushTimeline("github_pages_workflow_dispatched", { runId: dispatch.runId ?? null });

  const parsedRepo = resolveGithubOwnerRepoStrict(input.repoUrl);
  const expectedUrl = computeGithubPagesPreviewUrl({
    owner: parsedRepo?.owner ?? input.repositoryFullName.split("/")[0] ?? "",
    repo: parsedRepo?.repo ?? input.repositoryFullName.split("/")[1] ?? "",
    projectId: input.projectId,
  });

  if (dispatch.runId) {
    const polled = await pollGithubPagesPreviewWorkflowResult({
      repoUrl: input.repoUrl,
      githubToken: input.githubToken,
      repositoryFullName: input.repositoryFullName,
      projectId: input.projectId,
      runId: dispatch.runId,
      timeoutMs: WORKFLOW_POLL_TIMEOUT_MS,
    });
    if (polled.ok && polled.pagesUrl) {
      const pagesUrl = polled.pagesUrl;
      const deployment = {
        ...input.deployment,
        status: "deployed" as const,
        pagesUrl,
        updatedAt: input.nowIso,
      };
      input.pushTimeline("github_pages_preview_deployed", { pagesUrl, via: "workflow" });
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
          externalPreviewUrl: pagesUrl,
          previewUrl: pagesUrl,
          appPreviewUrl: pagesUrl,
        },
      };
    }
  }

  const deployment = {
    ...input.deployment,
    status: "preparing" as const,
    pagesUrl: expectedUrl,
    errorCode: null,
    userSafeMessage:
      "GitHub Pages Preview 배포가 시작되었습니다. 잠시 후 Preview 상태를 다시 확인해 주세요.",
    updatedAt: input.nowIso,
  };
  return {
    ok: false,
    deployment,
    pipelineStatus: "github_pages_deploy_pending",
  };
}

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

export async function fetchRepositoryFilePathsForBranch(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly branch: string;
}): Promise<
  | Readonly<{ readonly ok: true; readonly filePaths: readonly string[] }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const head = await fetchBranchHeadCommitSha({
    repoUrl: input.repoUrl,
    branch: input.branch,
    githubToken: input.githubToken,
  });
  if (!head.ok) return { ok: false, message: head.message };
  const tree = await fetchRecursiveTree({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    commitSha: head.sha,
  });
  if (!tree.ok) return { ok: false, message: tree.message };
  const filePaths = tree.entries
    .filter((e) => e.type === "blob" && e.path)
    .map((e) => String(e.path));
  return { ok: true, filePaths };
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
    const pkgBlob =
      filePaths.some((p) => p === "package.json" || p.endsWith("/package.json"))
        ? await getRepoUtf8FileIfExists({
            token,
            owner: parsed.owner,
            repo: parsed.repo,
            path: "package.json",
            ref: input.integrationBranch,
          })
        : null;
    let packageJson: unknown = null;
    if (pkgBlob?.contentUtf8) {
      try {
        packageJson = JSON.parse(pkgBlob.contentUtf8);
      } catch {
        packageJson = null;
      }
    }
    const contract = resolveStaticAppBuildContract({
      repositoryFiles: filePaths,
      packageJson,
    });
    pushTimeline("static_build_contract_resolved", {
      status: contract.status,
      projectType: contract.projectType,
    });

    if (contract.status === "unsupported_runtime") {
      deployment = {
        ...deployment,
        status: "failed",
        errorCode: "unsupported_runtime",
        userSafeMessage: contract.userSafeMessage,
        updatedAt: input.nowIso,
      };
      pushTimeline("github_pages_preview_deploy_failed", { reason: "unsupported_runtime" });
      return {
        ok: false,
        deployment,
        timelineEntries: timeline,
        pipelineStatus: "app_preview_target_failed",
      };
    }

    pushTimeline("static_build_contract_scaffold_started", { status: contract.status });
    const scaffold = await ensureStaticAppBuildContractOnIntegrationBranch({
      projectId: input.projectId,
      repoUrl: input.repoUrl,
      githubToken: token,
      integrationBranch: input.integrationBranch,
      contract,
      nowIso: input.nowIso,
    });
    if (!scaffold.ok) {
      deployment = {
        ...deployment,
        status: "failed",
        errorCode: scaffold.errorCode ?? "scaffold_failed",
        userSafeMessage: scaffold.userSafeMessage,
        updatedAt: input.nowIso,
      };
      pushTimeline("static_build_contract_scaffold_failed", { reason: deployment.errorCode });
      return {
        ok: false,
        deployment,
        timelineEntries: timeline,
        pipelineStatus: "app_preview_target_failed",
      };
    }
    if (scaffold.changedFiles.length > 0) {
      pushTimeline("static_build_contract_scaffold_completed", { files: scaffold.changedFiles.join(",") });
    }

    const workflowRefBranch = input.fallbackBaseBranch?.trim() || "main";
    const workflowResult = await runJyoPreviewPagesWorkflowDeploy({
      projectId: input.projectId,
      repoUrl: input.repoUrl,
      githubToken: token,
      repositoryFullName,
      integrationBranch: input.integrationBranch,
      workflowRefBranch,
      pagesPath,
      deployment,
      nowIso: input.nowIso,
      pushTimeline,
    });
    deployment = workflowResult.deployment;
    if (workflowResult.ok && workflowResult.previewRuntime) {
      return {
        ok: true,
        deployment,
        previewRuntime: workflowResult.previewRuntime,
        timelineEntries: timeline,
      };
    }
    return {
      ok: false,
      deployment,
      timelineEntries: timeline,
      pipelineStatus: workflowResult.pipelineStatus ?? "app_preview_target_failed",
    };
  }

  pushTimeline("github_pages_preview_artifact_detected", { artifactPath: artifact.artifactPath });

  const workflowRefBranch = input.fallbackBaseBranch?.trim() || "main";
  const workflowResult = await runJyoPreviewPagesWorkflowDeploy({
    projectId: input.projectId,
    repoUrl: input.repoUrl,
    githubToken: token,
    repositoryFullName,
    integrationBranch: input.integrationBranch,
    workflowRefBranch,
    pagesPath,
    deployment,
    nowIso: input.nowIso,
    pushTimeline,
  });
  deployment = workflowResult.deployment;
  if (workflowResult.ok && workflowResult.previewRuntime) {
    return {
      ok: true,
      deployment,
      previewRuntime: workflowResult.previewRuntime,
      timelineEntries: timeline,
    };
  }
  return {
    ok: false,
    deployment,
    timelineEntries: timeline,
    pipelineStatus: workflowResult.pipelineStatus ?? "app_preview_target_failed",
  };
}
