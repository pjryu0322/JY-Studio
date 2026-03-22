/** Mirrors {@link ProjectMemberRole} in Prisma; keep in sync for mock UI until auth is wired. */
export type ProjectRole = "OWNER" | "PLANNER" | "REVIEWER" | "OPERATOR";

/**
 * API: ProjectSpec 업로드·파싱 — PLANNER, REVIEWER, OWNER.
 */
export function canPlan(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "PLANNER" || role === "REVIEWER";
}

/**
 * PLANNER / OWNER — ProjectSpec 안내, 프롬프트 가이드, 업로드·등록 영역.
 */
export function canEditSpec(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "PLANNER";
}

/**
 * REVIEWER / OWNER — mock 파싱, Task 생성, Task 프롬프트 생성.
 */
export function canReview(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "REVIEWER";
}

/**
 * OPERATOR / REVIEWER / OWNER — Run, Git 요청·반영·재시도, Git 반영 준비 전환.
 */
export function canOperate(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "REVIEWER" || role === "OPERATOR";
}

export function canManageMembers(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER";
}
