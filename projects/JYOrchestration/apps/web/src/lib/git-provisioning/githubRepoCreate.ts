/**
 * Create a new GitHub repository (personal account MVP).
 */

import { githubApiFetch } from "@/lib/git-provisioning/githubApiClient";
import type { GithubRepositorySummary } from "@/lib/git-provisioning/githubRepoTypes";

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

export async function createGithubRepository(input: {
  readonly owner?: string | null;
  readonly repo: string;
  readonly githubAccessToken: string;
  readonly private?: boolean;
  readonly description?: string | null;
  readonly autoInit?: boolean;
}): Promise<{
  readonly ok: boolean;
  readonly repo?: GithubRepositorySummary;
  readonly reason?: string;
  readonly message?: string;
}> {
  const repo = String(input.repo ?? "").trim();
  const token = String(input.githubAccessToken ?? "").trim();
  if (!repo || !token) {
    return { ok: false, reason: "invalid_input", message: "repo name and token are required" };
  }

  const body = {
    name: repo,
    private: input.private !== false,
    description: input.description ? String(input.description).slice(0, 350) : undefined,
    auto_init: input.autoInit !== false,
  };

  try {
    const res = await githubApiFetch("/user/repos", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 422) {
      const text = (await res.text()).slice(0, 400);
      return { ok: false, reason: "name_unavailable", message: text };
    }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return { ok: false, reason: "github_error", message: `GitHub API ${res.status}: ${text}` };
    }
    const json = (await res.json()) as Record<string, unknown>;
    return { ok: true, repo: parseRepoSummary(json) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "fetch_failed", message: msg };
  }
}
