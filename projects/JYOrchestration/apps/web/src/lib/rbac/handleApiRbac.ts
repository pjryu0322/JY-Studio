import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { forbiddenJsonResponse } from "@/lib/rbac/forbiddenJson";

export function rbacErrorResponse(error: unknown) {
  if (error instanceof ProjectAccessDeniedError) {
    return forbiddenJsonResponse(error.message);
  }
  return null;
}
