export type ProjectRole = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER";

export type ProjectPermissionKey =
  | "canEdit"
  | "canRun"
  | "canApprove"
  | "canReorder"
  | "canView";

export const RolePermissions: Record<ProjectRole, Record<ProjectPermissionKey, boolean>> = {
  OWNER: {
    canEdit: true,
    canRun: true,
    canApprove: true,
    canReorder: true,
    canView: true,
  },
  EDITOR: {
    canEdit: true,
    canRun: true,
    canApprove: false,
    canReorder: true,
    canView: true,
  },
  REVIEWER: {
    canEdit: false,
    canRun: false,
    canApprove: true,
    canReorder: false,
    canView: true,
  },
  VIEWER: {
    canEdit: false,
    canRun: false,
    canApprove: false,
    canReorder: false,
    canView: true,
  },
};
