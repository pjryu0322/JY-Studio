import { GitHubDiscoveryError } from "./github-auto-collect-types";
import type { GitHubRepositoryMetadata, GitHubTreeFileItem } from "./github-auto-collect-types";

const GITHUB_API = "https://api.github.com";

export type GitHubApiFetch = typeof fetch;

export type GitHubRepoApiResponse = {
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  license: { spdx_id: string | null; name: string | null } | null;
  size: number;
  language: string | null;
  description: string | null;
};

export type GitHubTreeApiResponse = {
  sha: string;
  tree: Array<{
    path: string;
    mode: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
    url?: string;
  }>;
  truncated: boolean;
};

function buildHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JYKStore-GitHub-Discovery",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseApiFailure(
  response: Response,
): Promise<never> {
  if (response.status === 404) {
    throw new GitHubDiscoveryError(
      "REPOSITORY_NOT_FOUND",
      "Repository를 찾을 수 없습니다.",
      404,
    );
  }
  if (response.status === 403 || response.status === 401) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new GitHubDiscoveryError(
        "GITHUB_RATE_LIMITED",
        "GitHub API rate limit에 도달했습니다.",
        429,
      );
    }
    throw new GitHubDiscoveryError(
      "PRIVATE_REPOSITORY_NOT_SUPPORTED",
      "비공개 Repository는 지원하지 않습니다.",
      403,
    );
  }
  if (response.status === 429) {
    throw new GitHubDiscoveryError(
      "GITHUB_RATE_LIMITED",
      "GitHub API rate limit에 도달했습니다.",
      429,
    );
  }
  throw new GitHubDiscoveryError(
    "GITHUB_API_ERROR",
    "GitHub API 요청에 실패했습니다.",
    502,
  );
}

export async function fetchRepositoryMetadata(
  owner: string,
  repo: string,
  options: { fetchImpl?: GitHubApiFetch; token?: string } = {},
): Promise<{ metadata: GitHubRepositoryMetadata; raw: GitHubRepoApiResponse }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const response = await fetchImpl(url, { headers: buildHeaders(options.token) });
  if (!response.ok) {
    await parseApiFailure(response);
  }
  const raw = (await response.json()) as GitHubRepoApiResponse;
  if (raw.private) {
    throw new GitHubDiscoveryError(
      "PRIVATE_REPOSITORY_NOT_SUPPORTED",
      "비공개 Repository는 지원하지 않습니다.",
      403,
    );
  }
  const license =
    raw.license?.spdx_id && raw.license.spdx_id !== "NOASSERTION"
      ? raw.license.spdx_id
      : raw.license?.name ?? null;
  const metadata: GitHubRepositoryMetadata = {
    owner,
    repo: raw.name,
    fullName: raw.full_name,
    repositoryUrl: raw.html_url,
    defaultBranch: raw.default_branch,
    visibility: "public",
    archived: raw.archived,
    license,
    description: raw.description,
    language: raw.language,
  };
  return { metadata, raw };
}

export async function fetchRecursiveTree(
  owner: string,
  repo: string,
  branch: string,
  options: { fetchImpl?: GitHubApiFetch; token?: string } = {},
): Promise<{ items: GitHubTreeFileItem[]; truncated: boolean }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const response = await fetchImpl(url, { headers: buildHeaders(options.token) });
  if (!response.ok) {
    await parseApiFailure(response);
  }
  const raw = (await response.json()) as GitHubTreeApiResponse;
  const items: GitHubTreeFileItem[] = raw.tree.map((entry) => ({
    path: entry.path,
    type: entry.type,
    size: entry.type === "blob" ? (entry.size ?? null) : null,
    sha: entry.sha,
  }));
  return { items, truncated: raw.truncated === true };
}
