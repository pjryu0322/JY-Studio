/**
 * Minimal GitHub REST client helpers for repository provisioning.
 */

export function githubApiBaseUrl(): string {
  const b = process.env.GITHUB_API_URL?.trim();
  return b ? b.replace(/\/$/, "") : "https://api.github.com";
}

export function githubApiHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JYOrchestration/git-provisioning/1",
  };
}

export async function githubApiFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const base = githubApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...githubApiHeaders(token),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
