/**
 * 프로젝트 소유자(ownerUserId) 기준 실행·태스크 접근 통제.
 * Task는 항상 Project에 속하며, 접근은 project.ownerUserId === userId 로 검증한다.
 */
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { logExecutionAccess } from "@/lib/logging/executionAccessLog";
import { prisma } from "@/lib/prisma";

export async function requireProjectOwnedByUser(
  projectId: string,
  userId: string,
  context: string
): Promise<{ id: string; ownerUserId: string }> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerUserId: true },
  });
  if (!p) {
    logExecutionAccess({
      result: "denied",
      reason: "PROJECT_NOT_FOUND",
      userId,
      projectId,
      action: context,
      context,
    });
    throw new ProjectAccessDeniedError("프로젝트를 찾을 수 없습니다.");
  }
  if (p.ownerUserId !== userId) {
    logExecutionAccess({
      result: "denied",
      reason: "NOT_PROJECT_OWNER",
      userId,
      projectId,
      action: context,
      context,
    });
    throw new ProjectAccessDeniedError("프로젝트 소유자만 이 작업을 수행할 수 있습니다.");
  }
  logExecutionAccess({ result: "allowed", userId, projectId, action: context, context });
  return p;
}

export async function requireTaskOwnedByProjectOwner(
  taskId: string,
  userId: string,
  context: string
): Promise<{
  id: string;
  projectId: string;
  ownerUserId: string;
}> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      ownerUserId: true,
      project: { select: { ownerUserId: true } },
    },
  });
  if (!task) {
    logExecutionAccess({
      result: "denied",
      reason: "TASK_NOT_FOUND",
      userId,
      taskId,
      action: context,
      context,
    });
    throw new ProjectAccessDeniedError("Task를 찾을 수 없습니다.");
  }
  const projectOwnerId = task.project.ownerUserId;
  if (projectOwnerId !== userId) {
    logExecutionAccess({
      result: "denied",
      reason: "NOT_PROJECT_OWNER",
      userId,
      projectId: task.projectId,
      taskId,
      action: context,
      context,
    });
    throw new ProjectAccessDeniedError("프로젝트 소유자만 이 Task에 접근할 수 있습니다.");
  }
  if (task.ownerUserId !== projectOwnerId) {
    logExecutionAccess({
      result: "denied",
      reason: "TASK_OWNER_ROW_MISMATCH",
      userId,
      projectId: task.projectId,
      taskId,
      action: context,
      context,
    });
    throw new ProjectAccessDeniedError("Task 소유 정보가 프로젝트와 일치하지 않습니다.");
  }
  logExecutionAccess({
    result: "allowed",
    userId,
    projectId: task.projectId,
    taskId,
    action: context,
    context,
  });
  return {
    id: task.id,
    projectId: task.projectId,
    ownerUserId: task.ownerUserId,
  };
}

/** taskPromptId → Task 로 이어져 소유자·프로젝트 일치 검증 */
export async function requireTaskPromptOwnedByProjectOwner(
  taskPromptId: string,
  userId: string,
  context: string
): Promise<{ taskId: string; projectId: string }> {
  const prompt = await prisma.taskPrompt.findUnique({
    where: { id: taskPromptId },
    select: { taskId: true, projectId: true },
  });
  if (!prompt) {
    logExecutionAccess({
      result: "denied",
      reason: "TASK_PROMPT_NOT_FOUND",
      userId,
      action: context,
      context,
    });
    throw new ProjectAccessDeniedError("Task 프롬프트를 찾을 수 없습니다.");
  }
  await requireTaskOwnedByProjectOwner(prompt.taskId, userId, `${context}:taskPrompt`);
  return { taskId: prompt.taskId, projectId: prompt.projectId };
}
