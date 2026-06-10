import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
import { readGithubAcceptedPermissionsHeader } from "@/lib/integration/githubAcceptedPermissionsHeader";
import {
  classifyWorkflowDispatchFailure,
  type GitHubWorkflowDispatchProbeResultV1,
} from "@/lib/prototype/githubPreviewDeploymentFailureClassifier";
import { computeGithubPagesPreviewUrl } from "@/lib/prototype/githubPagesPreviewDeployment";
import { getRepoUtf8FileIfExists, putRepoUtf8File } from "@/lib/prototype/githubRepoUtf8Contents";

export const JYO_PREVIEW_PAGES_WORKFLOW_FILE = "jyo-preview-pages.yml" as const;
export const JYO_PREVIEW_PAGES_WORKFLOW_PATH = `.github/workflows/${JYO_PREVIEW_PAGES_WORKFLOW_FILE}`;

export function buildJyoPreviewPagesWorkflowYaml(): string {
  return `name: JYO Preview Pages

on:
  workflow_dispatch:
    inputs:
      project_id:
        description: "JYO project id"
        required: true
        type: string
      source_branch:
        description: "Integration branch to build"
        required: true
        type: string
      pages_path:
        description: "Preview path under GitHub Pages"
        required: true
        type: string

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "jyo-preview-pages-\${{ github.event.inputs.project_id }}"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout integration branch
        uses: actions/checkout@v4
        with:
          ref: \${{ github.event.inputs.source_branch }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then npm ci; else npm install; fi

      - name: Build static site
        run: npm run build

      - name: Resolve build output
        id: output
        shell: bash
        run: |
          if [ -d dist ]; then echo "dir=dist" >> "$GITHUB_OUTPUT"; exit 0; fi
          if [ -d out ]; then echo "dir=out" >> "$GITHUB_OUTPUT"; exit 0; fi
          if [ -d build ]; then echo "dir=build" >> "$GITHUB_OUTPUT"; exit 0; fi
          echo "No static build output found" >&2
          exit 1

      - name: Prepare preview path
        shell: bash
        run: |
          mkdir -p "_site/\${{ github.event.inputs.pages_path }}"
          cp -R "\${{ steps.output.outputs.dir }}/." "_site/\${{ github.event.inputs.pages_path }}/"

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

export function buildJyoPreviewPagesWorkflowDispatchPayload(input: {
  readonly projectId: string;
  readonly integrationBranch: string;
  readonly workflowRefBranch: string;
  readonly pagesPath?: string | null;
}): Readonly<{
  readonly ref: string;
  readonly inputs: Readonly<{
    readonly project_id: string;
    readonly source_branch: string;
    readonly pages_path: string;
  }>;
}> {
  const projectId = input.projectId.trim();
  const sourceBranch = input.integrationBranch.trim();
  const pagesPath =
    String(input.pagesPath ?? "").trim() || `previews/${projectId}`.replace(/\/$/, "");
  return {
    ref: input.workflowRefBranch.trim() || "main",
    inputs: {
      project_id: projectId,
      source_branch: sourceBranch,
      pages_path: pagesPath.replace(/\/$/, ""),
    },
  };
}

export type JyoPreviewPagesWorkflowReadinessV1 = Readonly<{
  readonly ok: boolean;
  readonly failureKind?: import("@/lib/prototype/githubPreviewDeploymentFailureClassifier").GitHubWorkflowDispatchFailureKindV1;
  readonly userSafeMessage?: string | null;
  readonly remediationCode?: import("@/lib/prototype/githubPreviewDeploymentFailureClassifier").GitHubWorkflowDispatchRemediationCodeV1;
  readonly workflowId?: number | null;
}>;

export async function inspectJyoPreviewPagesWorkflowOnDefaultBranch(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly defaultBranch: string;
  readonly projectId?: string | null;
}): Promise<JyoPreviewPagesWorkflowReadinessV1> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const token = input.githubToken.trim();
  const defaultBranch = input.defaultBranch.trim() || "main";
  if (!parsed || !token) {
    return { ok: false, failureKind: "unknown", userSafeMessage: null, remediationCode: "operator_review_required" };
  }

  const file = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: JYO_PREVIEW_PAGES_WORKFLOW_PATH,
    ref: defaultBranch,
  });
  if (!file?.contentUtf8?.trim()) {
    return {
      ok: false,
      failureKind: "workflow_not_found",
      userSafeMessage:
        "Preview 배포 workflow 파일이 아직 기본 브랜치에 반영되지 않았습니다. 다시 통합 및 Preview 준비를 실행해 주세요.",
      remediationCode: "ensure_workflow_file",
    };
  }
  const yaml = file.contentUtf8;
  if (!yaml.includes("workflow_dispatch:")) {
    return {
      ok: false,
      failureKind: "workflow_dispatch_not_supported",
      userSafeMessage:
        "Preview 배포 workflow에 수동 실행 설정(workflow_dispatch)이 필요합니다.",
      remediationCode: "ensure_workflow_dispatch",
    };
  }

  const api = githubRestApiBase();
  const wfRes = await fetch(
    `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows/${encodeURIComponent(JYO_PREVIEW_PAGES_WORKFLOW_FILE)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/github-pages-workflow",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (wfRes.status === 404) {
    return {
      ok: false,
      failureKind: "workflow_not_found",
      userSafeMessage:
        "Preview 배포 workflow를 찾지 못했습니다.\nworkflow 파일이 기본 브랜치에 반영된 뒤 다시 실행해 주세요.",
      remediationCode: "ensure_workflow_file",
    };
  }
  if (wfRes.ok) {
    try {
      const wf = (await wfRes.json()) as { id?: number; state?: string };
      const state = String(wf.state ?? "").toLowerCase();
      if (state === "disabled") {
        return {
          ok: false,
          failureKind: "workflow_disabled",
          userSafeMessage:
            "Preview 배포 workflow가 비활성화되어 있습니다. GitHub Actions 화면에서 workflow를 활성화해 주세요.",
          remediationCode: "enable_repository_actions",
          workflowId: wf.id ?? null,
        };
      }
      return { ok: true, workflowId: wf.id ?? null };
    } catch {
      return { ok: true, workflowId: null };
    }
  }

  return { ok: true, workflowId: null };
}

function headersRecord(res: Response): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  res.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export async function probeJyoPreviewPagesWorkflowDispatch(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly workflowRefBranch: string;
  readonly projectId: string;
  readonly integrationBranch: string;
  readonly skipDispatch?: boolean;
}): Promise<
  GitHubWorkflowDispatchProbeResultV1 & Readonly<{ readonly acceptedPermissionsHeader?: string | null }>
> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const token = input.githubToken.trim();
  const workflowPath = JYO_PREVIEW_PAGES_WORKFLOW_PATH;
  const dispatchRef = input.workflowRefBranch.trim() || "main";
  const payload = buildJyoPreviewPagesWorkflowDispatchPayload({
    projectId: input.projectId,
    integrationBranch: input.integrationBranch,
    workflowRefBranch: dispatchRef,
  });

  if (!parsed || !token) {
    return {
      ...classifyWorkflowDispatchFailure({ status: null, workflowPath, dispatchRef }),
      acceptedPermissionsHeader: null,
    };
  }

  console.info(
    JSON.stringify({
      action: "github_workflow_dispatch_probe_started",
      repositoryFullName: `${parsed.owner}/${parsed.repo}`,
      workflowPath,
      dispatchRef,
      sourceBranch: input.integrationBranch,
      pagesPath: payload.inputs.pages_path,
    }),
  );

  const readiness = await inspectJyoPreviewPagesWorkflowOnDefaultBranch({
    repoUrl: input.repoUrl,
    githubToken: token,
    defaultBranch: dispatchRef,
    projectId: input.projectId,
  });
  if (!readiness.ok && readiness.failureKind) {
    const classified = classifyWorkflowDispatchFailure({
      status: 404,
      workflowPath,
      dispatchRef,
      workflowId: readiness.workflowId ?? null,
    });
    console.info(
      JSON.stringify({
        action: "github_workflow_file_lookup_failed",
        repositoryFullName: `${parsed.owner}/${parsed.repo}`,
        failureKind: readiness.failureKind,
        remediationCode: readiness.remediationCode ?? classified.remediationCode,
      }),
    );
    return {
      ok: false,
      status: 404,
      failureKind: readiness.failureKind,
      userSafeMessage: readiness.userSafeMessage ?? classified.userSafeMessage,
      remediationCode: readiness.remediationCode ?? classified.remediationCode,
      operatorMessage: `workflow_readiness ${readiness.failureKind}`,
      workflowPath,
      workflowId: readiness.workflowId ?? null,
      dispatchRef,
      acceptedPermissionsHeader: null,
    };
  }

  if (input.skipDispatch) {
    return {
      ok: true,
      status: 204,
      failureKind: null,
      userSafeMessage: null,
      remediationCode: "none",
      operatorMessage: null,
      workflowPath,
      workflowId: readiness.workflowId ?? null,
      dispatchRef,
      acceptedPermissionsHeader: null,
    };
  }

  const api = githubRestApiBase();
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows/${encodeURIComponent(JYO_PREVIEW_PAGES_WORKFLOW_FILE)}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/github-pages-workflow",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = bodyText;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : bodyText;
  } catch {
    bodyJson = bodyText;
  }
  const accepted = readGithubAcceptedPermissionsHeader(res);
  const classified = classifyWorkflowDispatchFailure({
    status: res.status,
    responseBody: bodyJson,
    responseHeaders: headersRecord(res),
    workflowPath,
    workflowId: readiness.workflowId ?? null,
    dispatchRef,
  });

  console.info(
    JSON.stringify({
      action: classified.ok
        ? "github_workflow_dispatch_probe_completed"
        : "github_workflow_dispatch_probe_failed",
      repositoryFullName: `${parsed.owner}/${parsed.repo}`,
      workflowPath,
      dispatchRef,
      sourceBranch: input.integrationBranch,
      pagesPath: payload.inputs.pages_path,
      httpStatus: res.status,
      failureKind: classified.failureKind,
      remediationCode: classified.remediationCode,
      acceptedPermissionsHeader: accepted,
      responseBodySummary: classified.responseBodySummary,
    }),
  );
  if (!classified.ok) {
    console.info(
      JSON.stringify({
        action: "github_workflow_dispatch_failure_classified",
        repositoryFullName: `${parsed.owner}/${parsed.repo}`,
        failureKind: classified.failureKind,
        remediationCode: classified.remediationCode,
        httpStatus: res.status,
      }),
    );
  }

  return { ...classified, acceptedPermissionsHeader: accepted };
}

export async function ensureJyoPreviewPagesWorkflowOnBranch(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly branch: string;
}): Promise<{ readonly ok: boolean; readonly ensured: boolean; readonly errorCode?: string }> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const token = input.githubToken.trim();
  if (!parsed || !token) return { ok: false, ensured: false, errorCode: "github_auth_missing" };

  const existing = await getRepoUtf8FileIfExists({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: JYO_PREVIEW_PAGES_WORKFLOW_PATH,
    ref: input.branch,
  });
  const body = buildJyoPreviewPagesWorkflowYaml();
  if (existing && existing.contentUtf8.trim() === body.trim()) {
    return { ok: true, ensured: false };
  }
  const put = await putRepoUtf8File({
    token,
    owner: parsed.owner,
    repo: parsed.repo,
    path: JYO_PREVIEW_PAGES_WORKFLOW_PATH,
    branch: input.branch,
    message: "chore(preview): add JYO Preview Pages workflow",
    contentUtf8: body,
    sha: existing?.sha ?? null,
  });
  if (!put.ok) return { ok: false, ensured: false, errorCode: "workflow_ensure_failed" };
  return { ok: true, ensured: true };
}

export type GithubPagesWorkflowDispatchStatusV1 =
  | "queued"
  | "dispatched"
  | "workflow_missing"
  | "permission_denied"
  | "failed";

export async function dispatchGithubPagesPreviewWorkflow(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly workflowRefBranch: string;
  readonly repositoryFullName: string;
  readonly workflowFileName: typeof JYO_PREVIEW_PAGES_WORKFLOW_FILE;
  readonly sourceBranch: string;
  readonly projectId: string;
  readonly pagesPath: string;
}): Promise<{
  readonly ok: boolean;
  readonly runId: number | null;
  readonly status: GithubPagesWorkflowDispatchStatusV1;
  readonly userSafeMessage: string | null;
  readonly errorCode: string | null;
}> {
  void input.workflowFileName;
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const token = input.githubToken.trim();
  if (!parsed || !token) {
    return {
      ok: false,
      runId: null,
      status: "failed",
      userSafeMessage: "GitHub Pages Preview workflow를 실행하지 못했습니다.",
      errorCode: "github_auth_missing",
    };
  }

  const api = githubRestApiBase();
  const ref = input.workflowRefBranch.trim();
  const payload = buildJyoPreviewPagesWorkflowDispatchPayload({
    projectId: input.projectId,
    integrationBranch: input.sourceBranch,
    workflowRefBranch: ref,
    pagesPath: input.pagesPath,
  });
  const url = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows/${encodeURIComponent(JYO_PREVIEW_PAGES_WORKFLOW_FILE)}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration/github-pages-workflow",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 204 || res.status === 201) {
    const runsUrl = `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/workflows/${encodeURIComponent(JYO_PREVIEW_PAGES_WORKFLOW_FILE)}/runs?per_page=1`;
    const runsRes = await fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    let runId: number | null = null;
    if (runsRes.ok) {
      try {
        const json = (await runsRes.json()) as { workflow_runs?: Array<{ id?: number }> };
        runId = Number(json.workflow_runs?.[0]?.id ?? 0) || null;
      } catch {
        runId = null;
      }
    }
    return {
      ok: true,
      runId,
      status: "dispatched",
      userSafeMessage: null,
      errorCode: null,
    };
  }

  const bodyText = await res.text().catch(() => "");
  let bodyJson: unknown = bodyText;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : bodyText;
  } catch {
    bodyJson = bodyText;
  }
  const classified = classifyWorkflowDispatchFailure({
    status: res.status,
    responseBody: bodyJson,
    responseHeaders: headersRecord(res),
    workflowPath: JYO_PREVIEW_PAGES_WORKFLOW_PATH,
    dispatchRef: ref,
  });
  if (classified.failureKind === "workflow_not_found") {
    return {
      ok: false,
      runId: null,
      status: "workflow_missing",
      userSafeMessage: classified.userSafeMessage,
      errorCode: "workflow_missing",
    };
  }
  if (classified.failureKind === "permission_denied") {
    return {
      ok: false,
      runId: null,
      status: "permission_denied",
      userSafeMessage: classified.userSafeMessage,
      errorCode: "permission_denied",
    };
  }
  return {
    ok: false,
    runId: null,
    status: "failed",
    userSafeMessage: classified.userSafeMessage ?? "GitHub Pages Preview workflow 실행에 실패했습니다.",
    errorCode: classified.remediationCode,
  };
}

export async function pollGithubPagesPreviewWorkflowResult(input: {
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly repositoryFullName: string;
  readonly projectId: string;
  readonly runId: number;
  readonly timeoutMs: number;
}): Promise<{
  readonly ok: boolean;
  readonly conclusion: "success" | "failure" | "cancelled" | "timed_out" | "unknown";
  readonly pagesUrl: string | null;
  readonly userSafeMessage: string | null;
}> {
  const parsed = resolveGithubOwnerRepoStrict(input.repoUrl);
  const token = input.githubToken.trim();
  if (!parsed || !token) {
    return {
      ok: false,
      conclusion: "unknown",
      pagesUrl: null,
      userSafeMessage: "GitHub Pages Preview workflow 결과를 확인하지 못했습니다.",
    };
  }

  const api = githubRestApiBase();
  const deadline = Date.now() + Math.max(5_000, input.timeoutMs);
  let conclusion: "success" | "failure" | "cancelled" | "unknown" = "unknown";

  while (Date.now() < deadline) {
    const runRes = await fetch(
      `${api}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/actions/runs/${input.runId}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (runRes.ok) {
      try {
        const run = (await runRes.json()) as { status?: string; conclusion?: string };
        const status = String(run.status ?? "").toLowerCase();
        const conc = String(run.conclusion ?? "").toLowerCase();
        if (status === "completed") {
          if (conc === "success") conclusion = "success";
          else if (conc === "cancelled") {
            return {
              ok: false,
              conclusion: "cancelled",
              pagesUrl: null,
              userSafeMessage: "GitHub Pages Preview 배포가 취소되었습니다.",
            };
          } else {
            return {
              ok: false,
              conclusion: "failure",
              pagesUrl: null,
              userSafeMessage: "GitHub Pages Preview 배포에 실패했습니다.",
            };
          }
          break;
        }
      } catch {
        /* retry */
      }
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }

  if (conclusion !== "success") {
    return {
      ok: false,
      conclusion: "timed_out",
      pagesUrl: null,
      userSafeMessage:
        "GitHub Pages Preview 배포가 시작되었습니다. 잠시 후 Preview 상태를 다시 확인해 주세요.",
    };
  }

  const pagesUrl = computeGithubPagesPreviewUrl({
    owner: parsed.owner,
    repo: parsed.repo,
    projectId: input.projectId,
  });
  return { ok: true, conclusion: "success", pagesUrl, userSafeMessage: null };
}
