import { githubRestApiBase, resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";
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
        required: true
        type: string
      source_branch:
        required: true
        type: string
      pages_path:
        required: true
        type: string

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  build-preview:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source branch
        uses: actions/checkout@v4
        with:
          ref: \${{ inputs.source_branch }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          if [ -f package-lock.json ]; then npm ci; else npm install; fi

      - name: Build
        run: npm run build

      - name: Detect artifact
        run: |
          if [ -d dist ]; then echo "ARTIFACT_DIR=dist" >> $GITHUB_ENV; \\
          elif [ -d out ]; then echo "ARTIFACT_DIR=out" >> $GITHUB_ENV; \\
          elif [ -d build ]; then echo "ARTIFACT_DIR=build" >> $GITHUB_ENV; \\
          else echo "No static artifact found" && exit 1; fi

      - name: Deploy to gh-pages preview path
        run: |
          mkdir -p /tmp/preview-deploy
          cp -R "$ARTIFACT_DIR"/. /tmp/preview-deploy/
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git fetch origin gh-pages || true
          if git rev-parse --verify origin/gh-pages; then
            git checkout gh-pages
          else
            git checkout --orphan gh-pages
            git rm -rf . || true
          fi
          rm -rf "\${{ inputs.pages_path }}"
          mkdir -p "\${{ inputs.pages_path }}"
          cp -R /tmp/preview-deploy/. "\${{ inputs.pages_path }}/"
          touch .nojekyll
          git add .
          git commit -m "deploy preview for \${{ inputs.project_id }}" || echo "No changes"
          git push origin gh-pages
`;
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
    body: JSON.stringify({
      ref,
      inputs: {
        project_id: input.projectId,
        source_branch: input.sourceBranch,
        pages_path: input.pagesPath.replace(/\/$/, ""),
      },
    }),
  });

  if (res.status === 204) {
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

  const text = await res.text().catch(() => "");
  if (res.status === 404) {
    return {
      ok: false,
      runId: null,
      status: "workflow_missing",
      userSafeMessage: "GitHub Pages Preview workflow가 저장소에 없습니다.",
      errorCode: "workflow_missing",
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      runId: null,
      status: "permission_denied",
      userSafeMessage: "GitHub Actions workflow 실행 권한이 필요합니다.",
      errorCode: "permission_denied",
    };
  }
  void text;
  return {
    ok: false,
    runId: null,
    status: "failed",
    userSafeMessage: "GitHub Pages Preview workflow 실행에 실패했습니다.",
    errorCode: "workflow_dispatch_failed",
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
