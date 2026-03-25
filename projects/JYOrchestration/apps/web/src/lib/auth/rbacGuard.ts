import { RolePermissions, type ProjectPermissionKey, type ProjectRole } from "@/lib/auth/roles";
import { logExecutionAccess } from "@/lib/logging/executionAccessLog";
import { prisma } from "@/lib/prisma";
import { PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

export async function getUserProjectRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerUserId: true },
  });
  if (!project) {
    return null;
  }

  if (project.ownerUserId === userId) {
    return "OWNER";
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  return (member?.role as ProjectRole | null) ?? null;
}

export async function requireProjectPermission(
  projectId: string,
  userId: string,
  permissionChecked: ProjectPermissionKey,
  action: string
): Promise<ProjectRole> {
  const projectRow = await prisma.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  if (!projectRow) {
    logExecutionAccess({
      result: "denied",
      reason: "PROJECT_NOT_FOUND",
      userId,
      projectId,
      action,
      permissionChecked,
      role: null,
    });
    throw new ProjectAccessDeniedError("프로젝트를 찾을 수 없습니다.");
  }

  const role = await getUserProjectRole(projectId, userId);
  if (!role) {
    logExecutionAccess({
      result: "denied",
      reason: "PROJECT_MEMBER_NOT_FOUND",
      userId,
      projectId,
      action,
      permissionChecked,
      role: null,
    });
    throw new ProjectAccessDeniedError("프로젝트 접근 권한이 없습니다.");
  }

  if (projectRow.status === PROJECT_LIFECYCLE_DELETED) {
    if (role !== "OWNER") {
      logExecutionAccess({
        result: "denied",
        reason: "PROJECT_SOFT_DELETED",
        userId,
        projectId,
        action,
        permissionChecked,
        role,
      });
      throw new ProjectAccessDeniedError("삭제된 프로젝트에 접근할 수 없습니다.");
    }
    if (permissionChecked !== "canViewProject") {
      logExecutionAccess({
        result: "denied",
        reason: "PROJECT_SOFT_DELETED_MUTATION",
        userId,
        projectId,
        action,
        permissionChecked,
        role,
      });
      throw new ProjectAccessDeniedError("삭제된 프로젝트에서는 이 작업을 할 수 없습니다.");
    }
    logExecutionAccess({
      result: "allowed",
      userId,
      projectId,
      action,
      permissionChecked,
      role,
    });
    return role;
  }

  const allowed = role === "OWNER" ? true : RolePermissions[role][permissionChecked] === true;
  logExecutionAccess({
    result: allowed ? "allowed" : "denied",
    reason: allowed ? undefined : "INSUFFICIENT_ROLE_PERMISSION",
    userId,
    projectId,
    action,
    permissionChecked,
    role,
  });
  if (!allowed) {
    throw new ProjectAccessDeniedError("요청한 작업을 수행할 권한이 없습니다.");
  }
  return role;
}
