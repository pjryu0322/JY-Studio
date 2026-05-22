/**
 * GitHub repository existence lookup.
 */

import { githubApiFetch } from "@/lib/git-provisioning/githubApiClient";
import type { GithubRepoLookupResult, GithubRepositorySummary } from "@/lib/git-provisioning/githubRepoTypes";

function parseRepoSummary(body: Record<string, unknown>): GithubRepositorySummary {
  return {
    fullName: String(body.full_name ?? ""),
    htmlUrl: String(body.html_url ?? ""),
    defaultBranch: String(body.default_branch ?? "main"),
    private: body.private === true,
    fork: body.fork === true,
    archived: body.archived === true,
    pushedAt: typeof body.pushed_at === "string" ? body.pushed_at : null,
    updatedAt: typeof body.updated_at === "string" ? body.updated_at : null,
    size: typeof body.size === "number" ? body.size : null,
  };
}

export async function lookupGithubRepository(input: {
  readonly owner: string;
  readonly repo: string;
  readonly githubAccessToken: string;
}): Promise<GithubRepoLookupResult> {
  const owner = String(input.owner ?? "").trim();
  const repo = String(input.repo ?? "").trim();
  const token = String(input.githubAccessToken ?? "").trim();
  if (!owner || !repo || !token) {
    return { exists: false, reason: "error", message: "owner, repo, and token are required" };
  }

  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  try {
    const res = await githubApiFetch(path, token, { method: "GET" });
    if (res.status === 404) {
      return { exists: false, reason: "not_found" };
    }
    if (res.status === 401) {
      return { exists: false, reason: "unauthorized", message: "GitHub token unauthorized" };
    }
    if (res.status === 403) {
      return { exists: false, reason: "forbidden", message: "GitHub token forbidden for this repository" };
    }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return { exists: false, reason: "error", message: `GitHub API ${res.status}: ${text}` };
    }
    const body = (await res.json()) as Record<string, unknown>;
    return { exists: true, repo: parseRepoSummary(body) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { exists: false, reason: "error", message: msg };
  }
}
