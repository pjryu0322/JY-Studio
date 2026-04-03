/**
 * GitHub REST 응답의 X-Accepted-GitHub-Permissions 헤더 — 권한 프로브·post-save 프로브에서 동일 규칙으로 읽는다.
 */

export const GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME = "X-Accepted-GitHub-Permissions";

export function readGithubAcceptedPermissionsHeader(res: Response): string | null {
  const v =
    res.headers.get("x-accepted-github-permissions") ||
    res.headers.get(GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME) ||
    null;
  const t = v?.trim();
  return t ? t : null;
}

/** 로그 한 줄에 붙이는 조각: `X-Accepted-GitHub-Permissions=value` 또는 `(header_absent)` */
export function githubAcceptedPermissionsLogValue(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t ? `${GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME}=${t}` : `${GITHUB_ACCEPTED_PERMISSIONS_HEADER_NAME}=(header_absent)`;
}
