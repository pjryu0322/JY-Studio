/**
 * GitHub compare / PR 수동 개입 안내 (토큰·저장소는 env만 사용).
 * 저장소 식별: GITHUB_REPOSITORY, GITHUB_REPO(owner/repo), GITHUB_OWNER+GITHUB_REPO(짧은 이름),
 * GITHUB_REPO_URL(https://github.com/owner/repo).
 */

function parseOwnerRepo(raw: string | null | undefined): { owner: string; repo: string } | null {
  const s = String(raw ?? "").trim();
  if (!s || !s.includes("/")) {
    return null;
  }
  const [owner, repo] = s.split("/").map((x) => x.trim());
  if (!owner || !repo) {
    return null;
  }
  return { owner, repo };
}

function parseGithubRepoFromRepoUrl(raw: string | null | undefined): { owner: string; repo: string } | null {
  const s = String(raw ?? "").trim();
  if (!s) {
    return null;
  }
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "github.com") {
      return null;
    }
    const seg = u.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (seg.length < 2) {
      return null;
    }
    let repo = seg[1];
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!seg[0] || !repo) {
      return null;
    }
    return { owner: seg[0], repo };
  } catch {
    return null;
  }
}

/**
 * GITHUB_REPOSITORY → GITHUB_REPO(owner/repo 또는 짧은 repo) → GITHUB_OWNER+GITHUB_REPO → GITHUB_REPO_URL
 */
export function resolveGithubRepositoryFromEnv(): { owner: string; repo: string } | null {
  const fromStandard = parseOwnerRepo(process.env.GITHUB_REPOSITORY);
  if (fromStandard) {
    return fromStandard;
  }
  const repoVar = String(process.env.GITHUB_REPO ?? "").trim();
  if (repoVar.includes("/")) {
    const combined = parseOwnerRepo(repoVar);
    if (combined) {
      return combined;
    }
  }
  const ownerOnly = String(process.env.GITHUB_OWNER ?? "").trim();
  if (ownerOnly && repoVar && !repoVar.includes("/")) {
    return { owner: ownerOnly, repo: repoVar };
  }
  if (repoVar) {
    const asPair = parseOwnerRepo(repoVar);
    if (asPair) {
      return asPair;
    }
  }
  return parseGithubRepoFromRepoUrl(process.env.GITHUB_REPO_URL);
}

export function buildGithubCompareUrl(input: {
  owner: string;
  repo: string;
  base: string;
  head: string;
}): string {
  const b = encodeURIComponent(input.base);
  const h = encodeURIComponent(input.head);
  return `https://github.com/${input.owner}/${input.repo}/compare/${b}...${h}`;
}

/**
 * applyLog 하단에 붙일 수동 개입용 텍스트 블록 (PR은 API 토큰 없이 링크만 안내).
 */
export function formatGithubFollowUpBlock(input: {
  branchName: string;
  projectRepoUrl?: string | null;
  defaultBranch?: string | null;
}): string[] {
  const lines: string[] = ["[GITHUB_FOLLOW_UP]", "---"];
  const base = String(input.defaultBranch ?? "main").trim() || "main";
  const head = input.branchName.trim();

  const envRepo = resolveGithubRepositoryFromEnv();
  if (envRepo) {
    lines.push(
      `저장소(env): ${envRepo.owner}/${envRepo.repo}`,
      `Compare: ${buildGithubCompareUrl({ ...envRepo, base, head })}`,
      "PR 생성: GitHub에서 위 compare 페이지의 «Create pull request» 또는 gh CLI 사용.",
    );
  } else {
    lines.push(
      "GITHUB_REPOSITORY 또는 GITHUB_REPO(owner/repo)를 설정하면 compare 링크를 자동 생성할 수 있습니다.",
    );
  }

  if (input.projectRepoUrl?.trim()) {
    lines.push(`프로젝트 repoUrl(참고): ${input.projectRepoUrl.trim()}`);
  }

  lines.push(
    "---",
    "실패·충돌 시: 로컬에서 브랜치 정리 후 재시도하거나, 위 링크로 수동 머지합니다.",
    "[END_GITHUB_FOLLOW_UP]",
  );
  return lines;
}
