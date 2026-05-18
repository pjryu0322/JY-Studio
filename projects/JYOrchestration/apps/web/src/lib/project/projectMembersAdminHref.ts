/** 플랫폼 설정(⚙) 등에서 열리는 프로젝트 멤버 관리 화면 */
export function projectMembersAdminHref(projectId: string): string {
  const pid = projectId.trim();
  if (!pid) return "/project-members";
  return `/project-members?projectId=${encodeURIComponent(pid)}`;
}
