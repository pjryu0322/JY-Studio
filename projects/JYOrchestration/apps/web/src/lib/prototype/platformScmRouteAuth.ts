import {
  RolePermissions,
  type ProjectPermissionKey,
  type ProjectRole,
} from "@/lib/auth/roles";
import {
  RUN_FINAL_SCM_CHIP,
  RUN_PLATFORM_SCM_MERGE_CHIP,
} from "@/lib/requirements/implementationUxLabels";

/**
 * Platform SCM mutates remote Git state (push/PR/merge).
 * RBAC has no canManageProject / canExecuteProject — use canApplyGit.
 *
 * Role mapping (product terms → ProjectRole):
 * - owner   → OWNER   (canApplyGit: true)
 * - executor/admin → EDITOR (canApplyGit: true)
 * - reviewer → REVIEWER (canApplyGit: false)
 * - viewer  → VIEWER  (canApplyGit: false)
 */
export const PLATFORM_SCM_EXECUTE_PERMISSION = "canApplyGit" satisfies ProjectPermissionKey;

export const PLATFORM_SCM_MERGE_PERMISSION = "canApplyGit" satisfies ProjectPermissionKey;

export const PLATFORM_SCM_ALLOWED_ROLES = ["OWNER", "EDITOR"] as const satisfies readonly ProjectRole[];

export const PLATFORM_SCM_DENIED_ROLES = ["REVIEWER", "VIEWER"] as const satisfies readonly ProjectRole[];

export const PLATFORM_SCM_ROLE_MATRIX: Readonly<Record<ProjectRole, boolean>> = {
  OWNER: RolePermissions.OWNER.canApplyGit,
  EDITOR: RolePermissions.EDITOR.canApplyGit,
  REVIEWER: RolePermissions.REVIEWER.canApplyGit,
  VIEWER: RolePermissions.VIEWER.canApplyGit,
};

export const PLATFORM_SCM_PERMISSION_DENIED_MESSAGE =
  "SCM push/PR/merge는 OWNER 또는 EDITOR(실행자) 권한이 필요합니다. REVIEWER/VIEWER는 실행할 수 없습니다.";

export function canRoleExecutePlatformScm(role: ProjectRole | null | undefined): boolean {
  if (!role) return false;
  return PLATFORM_SCM_ROLE_MATRIX[role] === true;
}

export function canPermissionsExecutePlatformScm(
  permissions: Readonly<Partial<Record<ProjectPermissionKey, boolean>>> | null | undefined,
): boolean {
  return permissions?.canApplyGit === true;
}

const PLATFORM_SCM_EXECUTE_ACTION_IDS = new Set(["RUN_PLATFORM_SCM_MERGE", "RUN_FINAL_SCM"]);

const PLATFORM_SCM_EXECUTE_LABELS = new Set([
  "SCM 반영 요청",
  RUN_PLATFORM_SCM_MERGE_CHIP,
  RUN_FINAL_SCM_CHIP,
]);

export function filterPlatformScmNextActions<T extends Readonly<{ actionId: string; label: string }>>(
  actions: readonly T[],
  canApplyGit: boolean | undefined,
): readonly T[] {
  if (canApplyGit !== false) return actions;
  return actions.filter(
    (action) =>
      !PLATFORM_SCM_EXECUTE_ACTION_IDS.has(action.actionId) &&
      !PLATFORM_SCM_EXECUTE_LABELS.has(action.label),
  );
}

export function evaluatePlatformScmPermissionGate(
  canApplyGit: boolean | undefined,
): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  if (canApplyGit === false) {
    return { ok: false, message: PLATFORM_SCM_PERMISSION_DENIED_MESSAGE };
  }
  return { ok: true };
}
