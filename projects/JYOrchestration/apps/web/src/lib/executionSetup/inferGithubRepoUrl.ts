/**
 * `owner/repo` 형태(슬래시 앞뒤 공백·중복 슬래시 허용)에서 GitHub HTTPS URL을 추정합니다.
 * GitHub가 아닌 호스트는 지원하지 않습니다.
 */
export function inferGithubHttpsUrlFromOwnerRepo(gitRepoName: string | null | undefined): string | null {
  const raw = String(gitRepoName ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!raw) return null;
  const parts = raw.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) return null;
  return `https://github.com/${owner}/${repo}`;
}
