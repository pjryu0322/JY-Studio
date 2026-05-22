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

export async function getAuthenticatedGithubUser(input: {
  readonly githubAccessToken: string;
}): Promise<{ readonly ok: boolean; readonly login?: string; readonly message?: string }> {
  const token = String(input.githubAccessToken ?? "").trim();
  if (!token) {
    return { ok: false, message: "GitHub access token is required" };
  }
  try {
    const res = await githubApiFetch("/user", token, { method: "GET" });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      return { ok: false, message: `GitHub API ${res.status}: ${text}` };
    }
    const body = (await res.json()) as { login?: string };
    const login = String(body.login ?? "").trim();
    if (!login) {
      return { ok: false, message: "GitHub user login missing in /user response" };
    }
    return { ok: true, login };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
