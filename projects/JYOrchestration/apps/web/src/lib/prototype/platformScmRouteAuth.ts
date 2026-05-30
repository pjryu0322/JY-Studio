import type { ProjectPermissionKey } from "@/lib/auth/roles";

/**
 * Platform SCM mutates remote Git state (push/PR/merge).
 * canManageProject / canExecuteProject are not defined in RBAC — use canApplyGit.
 */
export const PLATFORM_SCM_EXECUTE_PERMISSION = "canApplyGit" satisfies ProjectPermissionKey;

export const PLATFORM_SCM_MERGE_PERMISSION = "canApplyGit" satisfies ProjectPermissionKey;
