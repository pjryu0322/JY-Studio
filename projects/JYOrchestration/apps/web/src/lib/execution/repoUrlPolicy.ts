/**
 * 프로젝트에 고정된 ExecutionSetup.gitRepoUrl 만 실행 대상으로 허용 (교차 저장소 방지).
 * 플랫폼은 Git을 실행하지 않고 URL만 Cursor에 전달한다.
 */

export function normalizeRepoUrlForPolicy(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function assertGitRepoUrlConfiguredForRun(gitRepoUrl: string): void {
  const u = String(gitRepoUrl ?? "").trim();
  if (!u) {
    throw new Error("GIT_REPO_URL_REQUIRED");
  }
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("GIT_REPO_URL_INVALID");
    }
  } catch (e) {
    if (e instanceof Error && e.message === "GIT_REPO_URL_INVALID") throw e;
    throw new Error("GIT_REPO_URL_INVALID");
  }
}
