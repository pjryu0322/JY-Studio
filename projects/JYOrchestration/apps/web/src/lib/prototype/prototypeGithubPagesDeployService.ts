import { githubRestApiBase } from "@/lib/integration/githubRestCommon";
import { probeHttpOk } from "@/lib/prototype/httpUrlProbe";

const WORKFLOW_PATH = ".github/workflows/deploy-pages.yml";
const VITE_REL = "web/vite.config.ts";

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson<T>(token: string, url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  const res = await fetch(url, { ...init, headers: { ...ghHeaders(token), ...(init?.headers as Record<string, string> | undefined) } });
  const text = await res.text().catch(() => "");
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export type ViteWebLayoutDetection = "vite_web" | "unknown";

export async function detectPrototypeStaticLayout(
  token: string,
  owner: string,
  repo: string,
  ref: string,
): Promise<ViteWebLayoutDetection> {
  const base = githubRestApiBase();
  const pkg = await githubJson<{ type?: string }>(
    token,
    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/web/package.json?ref=${encodeURIComponent(ref)}`,
  );
  const vite = await githubJson<{ type?: string }>(
    token,
    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent("web/vite.config.ts")}?ref=${encodeURIComponent(ref)}`,
  );
  if (pkg.ok && pkg.json && (pkg.json as { type?: string }).type !== "dir") {
    if (vite.ok && vite.json && (vite.json as { type?: string }).type !== "dir") return "vite_web";
  }
  return "unknown";
}

export async function getRepoDefaultBranch(token: string, owner: string, repo: string): Promise<string | null> {
  const base = githubRestApiBase();
  const r = await githubJson<{ default_branch?: string }>(token, `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const b = String(r.json?.default_branch ?? "").trim();
  return b || null;
}

async function getFileBlobIfExists(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ contentUtf8: string; sha: string } | null> {
  const base = githubRestApiBase();
  const encPath = path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const r = await githubJson<{ type?: string; encoding?: string; content?: string; sha?: string }>(
    token,
    `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encPath}?ref=${encodeURIComponent(ref)}`,
  );
  if (!r.ok || !r.json || (r.json as { type?: string }).type !== "file") return null;
  const encoding = String((r.json as { encoding?: string }).encoding ?? "");
  const content = String((r.json as { content?: string }).content ?? "").replace(/\n/g, "");
  const sha = String((r.json as { sha?: string }).sha ?? "").trim();
  if (!sha) return null;
  if (encoding !== "base64") return null;
  try {
    const utf8 = Buffer.from(content, "base64").toString("utf8");
    return { contentUtf8: utf8, sha };
  } catch {
    return null;
  }
}

function patchViteBase(content: string, basePath: string): string {
  const lit = JSON.stringify(basePath);
  if (/base\s*:\s*["'][^"']*["']/.test(content)) {
    return content.replace(/base\s*:\s*["'][^"']*["']/, `base: ${lit}`);
  }
  if (/defineConfig\s*\(\s*\{/.test(content)) {
    return content.replace(/defineConfig\s*\(\s*\{/, (m) => `${m}\n  base: ${lit},`);
  }
  if (/defineConfig\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{/.test(content)) {
    return content.replace(/defineConfig\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{/, (m) => `${m}\n    base: ${lit},`);
  }
  return content;
}

/** GitHub Actions `on.push.branches` 에 사용할 브랜치명으로 워크플로 YAML 생성. */
export function buildDeployPagesWorkflowYaml(deployBranch: string): string {
  const branchLit = JSON.stringify(String(deployBranch ?? "").trim());
  return `name: Deploy GitHub Pages

on:
  push:
    branches:
      - ${branchLit}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install
        working-directory: web
        run: |
          if [ -f package-lock.json ]; then npm ci; else npm install; fi
      - name: Build
        working-directory: web
        run: npm run build
      - name: Prepare GitHub Pages (SPA + Jekyll)
        working-directory: web
        run: |
          set -e
          test -f dist/index.html
          cp dist/index.html dist/404.html
          touch dist/.nojekyll
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    permissions:
      pages: write
      id-token: write
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}

function summarizePagesApiFailure(status: number, text: string): string {
  if (status === 401 || status === 403) {
    return "GitHub Pages 활성화 권한이 없습니다.";
  }
  const compact = text.replace(/\s+/g, " ").trim().slice(0, 240);
  return compact ? `GitHub Pages API 오류 (${status}): ${compact}` : `GitHub Pages API 오류 (${status})`;
}

type GithubPagesSiteResponse = { build_type?: string | null };

/**
 * 저장소 GitHub Pages 출처를 GitHub Actions(workflow)로 설정합니다.
 * 토큰에 admin:org 또는 repo 설정 권한이 없으면 실패할 수 있습니다.
 */
export async function ensureGithubPagesWorkflowBuildEnabled(input: {
  token: string;
  owner: string;
  repo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = githubRestApiBase();
  const url = `${base}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pages`;
  const get = await githubJson<GithubPagesSiteResponse>(input.token, url);
  if (get.status === 404) {
    const post = await githubJson<unknown>(input.token, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ build_type: "workflow" }),
    });
    if (!post.ok) {
      return { ok: false, error: summarizePagesApiFailure(post.status, post.text) };
    }
    return { ok: true };
  }
  if (!get.ok) {
    return { ok: false, error: summarizePagesApiFailure(get.status, get.text) };
  }
  const bt = String(get.json?.build_type ?? "").toLowerCase();
  if (bt === "workflow") {
    return { ok: true };
  }
  const put = await githubJson<unknown>(input.token, url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ build_type: "workflow" }),
  });
  if (!put.ok) {
    return { ok: false, error: summarizePagesApiFailure(put.status, put.text) };
  }
  return { ok: true };
}

async function putUtf8File(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  message: string,
  contentUtf8: string,
  sha: string | null,
): Promise<{ ok: true; commitSha: string } | { ok: false; error: string }> {
  const base = githubRestApiBase();
  const encPath = path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const body: Record<string, string> = {
    message,
    content: Buffer.from(contentUtf8, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const r = await githubJson<{ commit?: { sha?: string } }>(token, `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encPath}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, error: `GITHUB_PUT_${r.status}:${r.text.slice(0, 400)}` };
  const commitSha = String(r.json?.commit?.sha ?? "").trim();
  if (!commitSha) return { ok: false, error: "GITHUB_PUT_MISSING_COMMIT_SHA" };
  return { ok: true, commitSha };
}

export type PagesDeploySetupResult =
  | { ok: true; commitSha: string; layout: ViteWebLayoutDetection; deployBranch: string }
  | { ok: false; error: string; layout: ViteWebLayoutDetection; deployBranch: string };

/**
 * 지정 브랜치에 Pages 워크플로·Vite base를 주입(필요 시)합니다.
 * `deployBranch`는 호출부에서 executionSetup.baseBranch 또는 저장소 기본 브랜치로 결정합니다.
 */
export async function ensureGithubPagesDeploySetupOnDeployBranch(input: {
  token: string;
  owner: string;
  repo: string;
  /** GitHub Pages base path, e.g. "/myrepo/" */
  basePath: string;
  /** 워크플로 `on.push.branches` 및 커밋 대상 브랜치 */
  deployBranch: string;
}): Promise<PagesDeploySetupResult> {
  const deployBranch = String(input.deployBranch ?? "").trim();
  if (!deployBranch) {
    return { ok: false, error: "DEPLOY_BRANCH_EMPTY", layout: "unknown", deployBranch: "" };
  }

  const layout = await detectPrototypeStaticLayout(input.token, input.owner, input.repo, deployBranch);
  if (layout !== "vite_web") {
    return { ok: false, error: "VITE_WEB_LAYOUT_NOT_DETECTED", layout, deployBranch };
  }

  const wfExisting = await getFileBlobIfExists(input.token, input.owner, input.repo, WORKFLOW_PATH, deployBranch);
  const wfBody = buildDeployPagesWorkflowYaml(deployBranch);
  const wfPut = await putUtf8File(
    input.token,
    input.owner,
    input.repo,
    WORKFLOW_PATH,
    deployBranch,
    "chore(pages): add GitHub Pages deploy workflow",
    wfBody,
    wfExisting?.sha ?? null,
  );
  if (!wfPut.ok) return { ok: false, error: wfPut.error, layout, deployBranch };

  const vite = await getFileBlobIfExists(input.token, input.owner, input.repo, VITE_REL, deployBranch);
  if (vite) {
    const next = patchViteBase(vite.contentUtf8, input.basePath);
    if (next !== vite.contentUtf8) {
      const vPut = await putUtf8File(
        input.token,
        input.owner,
        input.repo,
        VITE_REL,
        deployBranch,
        "chore(pages): set Vite base for GitHub Pages",
        next,
        vite.sha,
      );
      if (!vPut.ok) return { ok: false, error: vPut.error, layout, deployBranch };
      return { ok: true, commitSha: vPut.commitSha, layout, deployBranch };
    }
  }

  return { ok: true, commitSha: wfPut.commitSha, layout, deployBranch };
}

type WorkflowRun = {
  id: number;
  status?: string | null;
  conclusion?: string | null;
  html_url?: string | null;
  head_sha?: string | null;
};

export async function findWorkflowRunForHeadSha(input: {
  token: string;
  owner: string;
  repo: string;
  headSha: string;
}): Promise<WorkflowRun | null> {
  const base = githubRestApiBase();
  const sha = String(input.headSha ?? "").trim();
  if (!sha) return null;
  const u = new URL(
    `${base}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/runs`,
  );
  u.searchParams.set("head_sha", sha);
  u.searchParams.set("per_page", "10");
  const r = await githubJson<{ workflow_runs?: WorkflowRun[] }>(input.token, u.toString());
  const runs = Array.isArray(r.json?.workflow_runs) ? r.json!.workflow_runs! : [];
  const hit = runs.find((w) => String(w.head_sha ?? "").trim() === sha);
  return hit ?? runs[0] ?? null;
}

export async function getWorkflowRun(input: {
  token: string;
  owner: string;
  repo: string;
  runId: number;
}): Promise<WorkflowRun | null> {
  const base = githubRestApiBase();
  const r = await githubJson<WorkflowRun>(
    input.token,
    `${base}/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/runs/${encodeURIComponent(String(input.runId))}`,
  );
  if (!r.ok || !r.json) return null;
  return r.json;
}

export async function waitForWorkflowRunTerminal(input: {
  token: string;
  owner: string;
  repo: string;
  runId: number;
  maxWaitMs: number;
}): Promise<{ ok: true; conclusion: string | null; htmlUrl: string | null } | { ok: false; error: string }> {
  const deadline = Date.now() + input.maxWaitMs;
  let last: WorkflowRun | null = null;
  while (Date.now() < deadline) {
    last = await getWorkflowRun(input);
    const st = String(last?.status ?? "").toLowerCase();
    if (st === "completed" || st === "cancelled") {
      return {
        ok: true,
        conclusion: last?.conclusion ?? null,
        htmlUrl: typeof last?.html_url === "string" ? last.html_url : null,
      };
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return { ok: false, error: "GITHUB_ACTIONS_RUN_TIMEOUT" };
}

export async function verifyGithubPagesUrlReachable(url: string): Promise<boolean> {
  const first = await probeHttpOk(url, { timeoutMs: 4500 });
  if (first.ok) return true;
  const withIndex = url.endsWith("/") ? `${url}index.html` : `${url}/index.html`;
  const second = await probeHttpOk(withIndex, { timeoutMs: 4500 });
  return second.ok;
}
