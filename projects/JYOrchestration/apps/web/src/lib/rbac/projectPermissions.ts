import type { ProjectRole } from "@/lib/auth/roles";
export type { ProjectRole } from "@/lib/auth/roles";

/**
 * API: ProjectSpec 업로드·파싱 — EDITOR, OWNER.
 */
export function canPlan(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/**
 * EDITOR / OWNER — ProjectSpec 안내, 프롬프트 가이드, 업로드·등록 영역.
 */
export function canEditSpec(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/**
 * REVIEWER / EDITOR / OWNER — 검토 및 생성계 기능.
 */
export function canReview(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "REVIEWER" || role === "EDITOR";
}

/**
 * EDITOR / OWNER — Run, Git 요청·반영·재시도, Git 반영 준비 전환.
 */
export function canOperate(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR";
}

export function canManageMembers(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER";
}
