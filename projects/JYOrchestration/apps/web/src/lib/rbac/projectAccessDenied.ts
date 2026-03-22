export const RBAC_FORBIDDEN_CODE = "FORBIDDEN" as const;

export class ProjectAccessDeniedError extends Error {
  readonly code = RBAC_FORBIDDEN_CODE;

  constructor(message: string) {
    super(message);
    this.name = "ProjectAccessDeniedError";
  }
}
