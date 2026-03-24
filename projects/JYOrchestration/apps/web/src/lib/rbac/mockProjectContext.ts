import { MOCK_CURRENT_USER_ID } from "./constants";
import type { ProjectRole } from "./projectPermissions";

export type ProjectMemberRow = {
  userId: string;
  role: ProjectRole;
};

/**
 * Temporary mock members for UX; replace with DB/API (e.g. projectMemberService) later.
 */
export function getProjectMembersMock(projectId: string): ProjectMemberRow[] {
  void projectId;
  return [
    { userId: "demo-user-1", role: "OWNER" },
    { userId: "demo-user-2", role: "REVIEWER" },
    { userId: "demo-user-3", role: "EDITOR" },
  ];
}

export function getCurrentMockUser(): { id: string } {
  return { id: MOCK_CURRENT_USER_ID };
}

/**
 * Resolves role from mock membership. If no row exists, treat as OWNER (creator / legacy project).
 */
export function getCurrentUserProjectRole(projectId: string, userId: string): ProjectRole {
  const members = getProjectMembersMock(projectId);
  const row = members.find((m) => m.userId === userId);
  return row?.role ?? "OWNER";
}
