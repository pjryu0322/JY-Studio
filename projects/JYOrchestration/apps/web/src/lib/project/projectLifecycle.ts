/** DB `Project.status` 생명주기 값 (물리 삭제 없음) */
export const PROJECT_LIFECYCLE_ACTIVE = "ACTIVE";
export const PROJECT_LIFECYCLE_DELETED = "DELETED";

export function isProjectDeleted(status: string | null | undefined): boolean {
  return status === PROJECT_LIFECYCLE_DELETED;
}
