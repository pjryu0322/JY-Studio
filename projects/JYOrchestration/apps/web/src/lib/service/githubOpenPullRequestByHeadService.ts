import {
  githubRestApiBase,
  resolveGithubOwnerRepoLoose,
  resolveGithubRestTokenAndLog,
} from "@/lib/integration/githubRestCommon";

/**
 * 동일 저장소 ENV_TEST PR 조회.
 * GitHub `GET .../pulls?head=owner:ref` 는 POST 본문의 `head`(브랜치명만)와 표기가 달라질 수 있어,
 * `state=open` 목록을 받은 뒤 `head.ref` 가 일치하고 head 저장소가 대상 repo 인 PR만 고른다.
 * (POST `createPull` 과 동일하게 브랜치 식별자는 ref 이름만 사용.)
 */
export async function findOpenPullRequestByHeadBranch(input: {
  repoUrl: string;
  /** normalizeGithubPrHeadForSameRepoCreate 등으로 정규화된 ref 이름 */
  headBranch: string;
  githubAccessToken?: string | null;
  projectId?: string | null;
}): Promise<{ prUrl: string; prNumber: number } | null> {
  const { token } = resolveGithubRestTokenAndLog("github_find_open_pr_by_head", input.githubAccessToken ?? null, {
    throttleKey: "find_open_pr_head",
    projectId: input.projectId,
  });
  if (!token) return null;

  const resolved = resolveGithubOwnerRepoLoose(input.repoUrl);
  if (!resolved) return null;
  const { owner, repo } = resolved;
  const wantRef = String(input.headBranch ?? "").trim();
  if (!wantRef) return null;

  const targetFull = `${owner}/${repo}`.toLowerCase();
  const base = githubRestApiBase();
  const listUrl = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=100`;

  const res = await fetch(listUrl, {
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
    const rec = item as Record<string, unknown>;
    const head = rec.head as Record<string, unknown> | undefined;
    const ref = typeof head?.ref === "string" ? head.ref : null;
    if (!ref || ref !== wantRef) continue;

    const headRepo = head?.repo as Record<string, unknown> | undefined;
    const fullName = typeof headRepo?.full_name === "string" ? headRepo.full_name.toLowerCase() : null;
    if (fullName != null && fullName !== targetFull) continue;

    const htmlUrl = rec.html_url;
    const numberRaw = rec.number;
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
