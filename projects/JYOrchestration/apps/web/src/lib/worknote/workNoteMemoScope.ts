/** API·클라이언트 공통: 사용자 단위(USER) vs 프로젝트 단위(PROJECT) 작업메모 */
export type WorkNotesMemoScope = "USER" | "PROJECT";

/** 쿼리/본문 `scope` 값 — `personal`은 기존 호환용 별칭 */
export function isUserMemoScopeParam(raw: string | null | undefined): boolean {
  const u = String(raw ?? "").trim().toLowerCase();
  return u === "user" || u === "personal";
}
