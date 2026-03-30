import type { CursorRunResult } from "@/lib/execution/cursorExecutionAdapter";

/**
 * Cursor Agent가 종료되어도 API에 commit/변경 파일이 없으면 "코드 반영 완료"로 보지 않는다.
 * (에이전트 수락만으로 Task 완료 처리하지 않기 위한 게이트)
 */
export function isCursorCodeReflectionConfirmed(
  cr: Pick<CursorRunResult, "commitHash" | "changedFiles" | "summary">
): boolean {
  if (process.env.EXECUTION_LOOP_STUB_CURSOR === "1") {
    return true;
  }
  const hash = typeof cr.commitHash === "string" && cr.commitHash.trim().length > 0;
  if (hash) return true;
  if (Array.isArray(cr.changedFiles) && cr.changedFiles.length > 0) return true;
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
