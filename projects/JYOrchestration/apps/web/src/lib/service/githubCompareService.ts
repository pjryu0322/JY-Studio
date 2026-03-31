import { resolveGithubRepositoryFromEnv } from "@/lib/integration/githubIntegrationHints";

function getGithubToken(): string | null {
  const t = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || "";
  return t || null;
}

function githubApiBase(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  return "https://api.github.com";
}

function parseGithubRepoFullNameFromUrl(repoUrl: string): { owner: string; repo: string } | null {
  const url = String(repoUrl ?? "").trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (seg.length < 2) return null;
    const owner = seg[0];
    let repo = seg[1];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

type CompareJson = {
  status?: string;
  ahead_by?: number;
  behind_by?: number;
  total_commits?: number;
  merge_base_commit?: { sha?: string };
  commits?: Array<{ sha?: string; commit?: { message?: string } }>;
  files?: Array<{ filename?: string; status?: string; additions?: number; deletions?: number; changes?: number; patch?: string }>;
};

export async function fetchGithubCompareSnapshot(params: {
  repoUrl: string;
  base: string;
  head: string;
  maxPatchCharsPerFile?: number;
  maxFiles?: number;
}): Promise<
  | {
      ok: true;
      data: {
        owner: string;
        repo: string;
        base: string;
        head: string;
        headSha: string | null;
        changedFiles: string[];
        diffSummary: string;
      };
    }
  | { ok: false; code: string; message: string; httpStatus?: number; detail?: Record<string, unknown> }
> {
  const token = getGithubToken();
  if (!token) {
    return { ok: false, code: "NO_GITHUB_TOKEN", message: "GITHUB_TOKEN(GH_TOKEN)이 필요합니다.", httpStatus: 503 };
  }
  const envRepo = resolveGithubRepositoryFromEnv();
  const parsed = envRepo ?? parseGithubRepoFullNameFromUrl(params.repoUrl);
  if (!parsed) {
    return { ok: false, code: "REPO_NOT_GITHUB", message: "GitHub 저장소 URL이 아닙니다.", httpStatus: 400 };
  }
  const { owner, repo } = parsed;
  const api = githubApiBase();
  const url = `${api}/repos/${owner}/${repo}/compare/${encodeURIComponent(params.base)}...${encodeURIComponent(params.head)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "JYOrchestration/github-compare",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const txt = await res.text();
    if (!res.ok) {
      return { ok: false, code: "GITHUB_COMPARE_ERROR", message: `compare 실패 (HTTP ${res.status})`, httpStatus: res.status, detail: { body: txt.slice(0, 2000) } };
    }
    const json = JSON.parse(txt) as CompareJson;
    const files = Array.isArray(json.files) ? json.files : [];
    const maxFiles = Math.min(200, Math.max(1, params.maxFiles ?? 80));
    const sliced = files.slice(0, maxFiles);
    const changedFiles = sliced.map((f) => String(f.filename ?? "").trim()).filter(Boolean);
    const headSha = json.commits?.length ? String(json.commits[json.commits.length - 1]?.sha ?? "").trim() || null : null;

    const maxPatch = Math.min(10_000, Math.max(200, params.maxPatchCharsPerFile ?? 2500));
    const fileLines = sliced.map((f) => {
      const fn = String(f.filename ?? "").trim() || "(unknown)";
      const st = String(f.status ?? "").trim() || "modified";
      const delta = `+${f.additions ?? 0}/-${f.deletions ?? 0} (Δ${f.changes ?? 0})`;
      const patch = String(f.patch ?? "").trim();
      const patchPreview = patch ? patch.slice(0, maxPatch) + (patch.length > maxPatch ? "\n…(truncated)" : "") : "(patch 없음)";
      return `--- ${fn} [${st}] ${delta}\n${patchPreview}`;
    });

    const meta = [
      `status=${String(json.status ?? "")}`,
      `ahead_by=${json.ahead_by ?? null}`,
      `behind_by=${json.behind_by ?? null}`,
      `total_commits=${json.total_commits ?? null}`,
      `merge_base=${json.merge_base_commit?.sha ?? null}`,
    ].join(" ");

    return {
      ok: true,
      data: {
        owner,
        repo,
        base: params.base,
        head: params.head,
        headSha,
        changedFiles,
        diffSummary: `[GitHub compare ${owner}/${repo}] ${meta}\n\n${fileLines.join("\n\n")}`,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "GITHUB_COMPARE_EXCEPTION", message: msg, httpStatus: 502 };
  }
}

