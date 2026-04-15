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
      "실행 계획 업로드는 PLANNER·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

export async function requireProjectSpecParse(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canPlan(role)) {
    throw new ProjectAccessDeniedError(
      "실행 계획 파싱은 PLANNER·REVIEWER·OWNER 권한이 필요합니다."
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

/** Git 승인 게이트: 승인 요청 제출·재요청 (OPERATOR 이상, Git 요청 등록과 동일). */
export async function requireGitApprovalGateSubmit(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canOperate(role)) {
    throw new ProjectAccessDeniedError(
      "Git 승인 요청 제출은 OPERATOR·REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

/** Git 승인 게이트: 승인·반려 (REVIEWER 이상 — 검토 권한과 정렬). */
export async function requireGitApprovalGateReview(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canReview(role)) {
    throw new ProjectAccessDeniedError(
      "Git 반영 승인·반려는 REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

/**
 * 프로젝트 Git 정책 PATCH (gitApprovalMode·gitPushMode 분리 필드, 서로 독립).
 * 검토(REVIEWER) 이상.
 */
export async function requireProjectGitApprovalModeUpdate(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (!canReview(role)) {
    throw new ProjectAccessDeniedError(
      "Git 승인·push 정책 변경은 REVIEWER·OWNER 권한이 필요합니다."
    );
  }
  return role;
}

/** `requireProjectGitApprovalModeUpdate` 별칭 (의미: 승인·push 정책 통합 가드). */
export const requireProjectGitPolicyUpdate = requireProjectGitApprovalModeUpdate;

/** Project owner, DB member, or (dev) mock member may read Task audit history. */
export async function requireProjectMember(projectId: string, userId: string) {
  const role = await resolveProjectRole(projectId, userId);
  if (role !== null) {
    return;
  }
  throw new ProjectAccessDeniedError("프로젝트 참여자만 Task 이력을 조회할 수 있습니다.");
}
