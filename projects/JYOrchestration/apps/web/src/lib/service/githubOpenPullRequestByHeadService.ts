import {
  getGithubRestToken,
  githubRestApiBase,
  resolveGithubOwnerRepoLoose,
} from "@/lib/integration/githubRestCommon";

/**
 * GitHub REST: 열린 PR 중 head 가 owner:branch 인 항목 검색.
 */
export async function findOpenPullRequestByHeadBranch(input: {
  repoUrl: string;
  headBranch: string;
  githubAccessToken?: string | null;
}): Promise<{ prUrl: string; prNumber: number } | null> {
  const token = getGithubRestToken(input.githubAccessToken ?? null);
  if (!token) return null;

  const resolved = resolveGithubOwnerRepoLoose(input.repoUrl);
  if (!resolved) return null;
  const { owner, repo } = resolved;

  const base = githubRestApiBase();
  const head = `${owner}:${input.headBranch}`;
  const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&head=${encodeURIComponent(
    head
  )}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      "User-Agent": "JYOrchestration-pr-opened-detector/1",
    },
  });
  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  if (!Array.isArray(json)) return null;

  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const htmlUrl = (item as Record<string, unknown>).html_url;
    const numberRaw = (item as Record<string, unknown>).number;
    const prUrl = typeof htmlUrl === "string" ? htmlUrl : null;
    const prNumber =
      typeof numberRaw === "number"
        ? numberRaw
        : typeof numberRaw === "string" && /^\d+$/.test(numberRaw)
          ? Number(numberRaw)
          : null;
    if (prUrl && prNumber != null) {
      return { prUrl, prNumber };
    }
  }
  return null;
}
