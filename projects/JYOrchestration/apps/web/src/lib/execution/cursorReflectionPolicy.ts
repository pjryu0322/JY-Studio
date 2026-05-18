import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";

const GITHUB_PULL_PATH = /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/i;

function hasGithubPullEvidence(cr: Pick<CursorRunResult, "summary" | "prUrl">): boolean {
  const pr = typeof cr.prUrl === "string" ? cr.prUrl.trim() : "";
  if (pr && GITHUB_PULL_PATH.test(pr)) return true;
  const sum = cr.summary ?? "";
  if (GITHUB_PULL_PATH.test(sum)) return true;
  if (/\bhttps?:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\/pull\/\d+/i.test(sum)) return true;
  return false;
}

/**
 * Cursor Agent가 종료되어도 API에 commit/변경 파일이 없으면 "코드 반영 완료"로 보지 않는다.
 * (에이전트 수락만으로 Task 완료 처리하지 않기 위한 게이트)
 *
 * 예외: Cloud Agent가 commit/files 필드를 비우지만 **GitHub PR URL**은 주는 경우가 많아,
 * `prUrl` 또는 요약 내 PR 링크가 있으면 반영된 것으로 본다.
 */
export function isCursorCodeReflectionConfirmed(
  cr: Pick<CursorRunResult, "commitHash" | "changedFiles" | "summary" | "prUrl">
): boolean {
  if (process.env.EXECUTION_LOOP_STUB_CURSOR === "1") {
    return true;
  }
  const hash = typeof cr.commitHash === "string" && cr.commitHash.trim().length > 0;
  if (hash) return true;
  if (Array.isArray(cr.changedFiles) && cr.changedFiles.length > 0) return true;
  if (hasGithubPullEvidence(cr)) return true;
  const s = (cr.summary ?? "").toLowerCase();
  if (
    /\bcommit\s+[0-9a-f]{7,40}\b/i.test(cr.summary ?? "") ||
    /\bsha\s*[0-9a-f]{7,40}\b/i.test(s) ||
    /커밋\s*[0-9a-f]{7,40}/i.test(cr.summary ?? "")
  ) {
    return true;
  }
  return false;
}
