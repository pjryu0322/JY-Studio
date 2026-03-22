/**
 * Project-scoped RBAC checks (service layer). Used from API routes and reusable for future callers.
 */
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { canOperate, canPlan, canReview } from "@/lib/rbac/projectPermissions";
import { resolveProjectRole } from "@/lib/rbac/resolveProjectRole";

export async function requireProjectSpecUpload(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canPlan(role)) {
    throw new ProjectAccessDeniedError(
      "ProjectSpec 업로드는 PLANNER·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

export async function requireProjectSpecParse(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canPlan(role)) {
    throw new ProjectAccessDeniedError(
      "ProjectSpec 파싱은 PLANNER·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

export async function requireTaskGenerate(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canReview(role)) {
    throw new ProjectAccessDeniedError("Task 생성은 REVIEWER 이상 권한이 필요합니다.");
  }
  return role;
}

export async function requireTaskPromptCreate(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canReview(role)) {
    throw new ProjectAccessDeniedError("Task 프롬프트 생성은 REVIEWER 이상 권한이 필요합니다.");
  }
  return role;
}

export async function requireExecutionPipelineRead(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canOperate(role)) {
    throw new ProjectAccessDeniedError(
      "실행·Git 관련 조회는 OPERATOR·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

export async function requireTaskRun(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canOperate(role)) {
    throw new ProjectAccessDeniedError("Task 실행은 OPERATOR·REVIEWER·OWNER 권한이 필요합니다.");
  }
  return role;
}

export async function requireReadyForGitTransition(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canOperate(role)) {
    throw new ProjectAccessDeniedError(
      "Git 반영 준비 전환은 OPERATOR·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

export async function requireGitChangeRequestCreate(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canOperate(role)) {
    throw new ProjectAccessDeniedError(
      "Git 반영 요청 등록은 OPERATOR·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

export async function requireGitApply(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canOperate(role)) {
    throw new ProjectAccessDeniedError("Git 반영 실행은 OPERATOR·REVIEWER·OWNER 권한이 필요합니다.");
  }
  return role;
}
