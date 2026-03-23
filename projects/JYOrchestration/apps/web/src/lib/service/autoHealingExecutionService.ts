import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";
import { TaskHistoryActorType, TaskHistoryEventType } from "@/lib/history/taskHistoryConstants";
import { enqueueExecution } from "@/lib/service/executionQueue";
import { validateGitApplyPostEligibility } from "@/lib/service/executionService";
import { createGitChangeRequestFromExecutionResult } from "@/lib/service/gitChangeRequestFromTaskRun";
import { taskRunExecutionResultToStoredJson, type TaskRunExecutionResult } from "@/lib/integration/taskRunResultTypes";
import {
  AUTO_HEALING_AUTO_RUN_ENABLED,
  AUTO_HEALING_MAX_AUTO_RUN_TASKS_PER_FAILURE,
  AUTO_HEALING_MAX_AUTO_RUN_ATTEMPTS_PER_TASK,
} from "@/lib/execution/autoHealingExecutionPolicy";
import type { SelfHealingAction } from "@/lib/execution/selfHealingStrategy";

const AUTO_ACTOR_USER_ID = "demo-user-3";

function parseAutoHealingChangeReason(changeReason: string | null): {
  failureType?: string;
  strategy?: SelfHealingAction;
} {
  if (!changeReason?.startsWith("AUTO_HEALING:")) return {};
  const parts = changeReason.split(":").map((p) => p.trim());
  // AUTO_HEALING:<failureType>:<strategy>:<jobId>
  if (parts.length >= 4) {
    return { failureType: parts[1], strategy: parts[2] as SelfHealingAction };
  }
  // legacy AUTO_HEALING:<failureType>:<jobId>
  if (parts.length === 3) {
    return { failureType: parts[1] };
  }
  return {};
}

function formatSpecContext(parsedJson: unknown): string {
  if (parsedJson == null || typeof parsedJson !== "object") {
    return "(ProjectSpec 요약 없음 — Task 설명만 따르세요.)";
  }
  const p = parsedJson as Record<string, unknown>;
  const overview = typeof p.projectOverview === "string" ? p.projectOverview.trim() : "";
  const features = Array.isArray(p.mainFeatures)
    ? p.mainFeatures.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
  const constraints = Array.isArray(p.constraints)
    ? p.constraints.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];

  const lines: string[] = [];
  if (overview) {
    lines.push(`- 제품·아이디어 요약: ${overview.slice(0, 800)}`);
  }
  if (features.length > 0) {
    lines.push(`- 기능·문장 목록:\n${features.map((f) => `  - ${f}`).join("\n")}`);
  }
  if (constraints.length > 0) {
    lines.push(`- 제약·주의:\n${constraints.map((c) => `  - ${c}`).join("\n")}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(ProjectSpec 필드가 비어 있습니다.)";
}

function buildTaskExecutionPrompt(task: {
  id: string;
  name: string;
  description: string | null;
  projectId: string;
  projectSpecUploadId: string;
}, specContext: string) {
  // NOTE: 기존 /api/task/prompt과 동일한 텍스트를 사용해 행동을 통일한다.
  return `# Task 실행 프롬프트 (Cursor에서 그대로 실행 가능하도록 작성됨)

## 작업명
${task.name}

## 이번 Task에서 할 일
${task.description || "Task 설명이 비어 있으면, 아래 ProjectSpec 요약과 작업명만으로 목표를 구체화하세요."}

## ProjectSpec 맥락 (사용자가 올린 아이디어에서 추출)
${specContext}

## 구현 위치 (이 저장소 기준)
- 데모·샘플 UI는 Next.js App Router 아래에 둡니다: \`apps/web/src/app/note-demo/\`
- 재사용 컴포넌트: \`apps/web/src/components/note-demo/\` (없으면 생성)
- JYOrchestration 본체(프로젝트 목록·권한·Git 파이프라인)는 깨지지 않게 두고, 위 경로에 **메모 앱 UI·로직**을 만듭니다.

## 수정 범위 제한
- 모노레포에서 **projects/JYOrchestration** 아래만 변경 (다른 프로젝트 디렉터리 수정 금지)
- 루트 package.json·타 프로젝트 건드리지 않기
- “오케스트레이션 자동 실행기” 같은 메타 기능은 새로 넣지 않기

## 완료 기준 (반드시 확인)
- \`pnpm\` / \`npm\` 기준으로 **타입 오류·린트 오류 없음**
- 로그인·저장이 요구된 Task면: **입력 검증**(빈 비밀번호, 저장 실패 시 사용자 메시지)까지 포함
- 새 페이지는 \`apps/web/src/app/note-demo/page.tsx\`에서 라우팅 가능하게 연결

## 메타 (시스템 ID — 삭제 금지)
- projectId: ${task.projectId}
- projectSpecUploadId: ${task.projectSpecUploadId}
- taskId: ${task.id}
`;
}

async function generateTaskPromptForAutoHealing(taskId: string): Promise<{ promptId: string; projectId: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, name: true, description: true, projectId: true, projectSpecUploadId: true },
  });
  if (!task) {
    throw new Error(`task not found: ${taskId}`);
  }

  const specUpload = await prisma.projectSpecUpload.findUnique({
    where: { id: task.projectSpecUploadId },
    select: { parsedJson: true },
  });

  const specContext = formatSpecContext(specUpload?.parsedJson ?? null);
  const promptText = buildTaskExecutionPrompt(task, specContext);

  const { created } = await prisma.$transaction(async (tx) => {
    const latest = await tx.taskPrompt.findFirst({
      where: { taskId: task.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const isRevision = nextVersion > 1;

    await tx.taskPrompt.updateMany({
      where: { taskId: task.id, status: "READY" },
      data: { status: "UPDATED" },
    });

    const created = await tx.taskPrompt.create({
      data: {
        taskId: task.id,
        projectId: task.projectId,
        promptText,
        version: nextVersion,
        status: "READY",
      },
      select: { id: true },
    });

    return { created, nextVersion, isRevision };
  });

  return { promptId: created.id, projectId: task.projectId };
}

async function executeAutoHealingTaskRunMock(params: {
  taskId: string;
  taskPromptId: string;
  meta: {
    sourceExecutionJobId: string;
    sourceFailureType?: string;
    sourceStrategy?: SelfHealingAction;
  };
}): Promise<{ taskRunId: string }> {
  const prompt = await prisma.taskPrompt.findUnique({
    where: { id: params.taskPromptId },
    select: {
      id: true,
      taskId: true,
      task: {
        select: {
          id: true,
          status: true,
          project: { select: { autoCreateGitRequest: true } },
        },
      },
    },
  });

  if (!prompt || prompt.taskId !== params.taskId) {
    throw new Error(`taskPrompt mismatch: ${params.taskPromptId}`);
  }

  const taskGate = await prisma.task.findUnique({
    where: { id: params.taskId },
    select: { status: true },
  });
  if (!taskGate) throw new Error(`task not found: ${params.taskId}`);
  if (taskGate.status === "BLOCKED") {
    throw new Error("TASK_BLOCKED");
  }

  const executionResult: TaskRunExecutionResult = {
    success: true,
    mode: "mock",
    updatedFiles: [
      {
        path: `projects/${params.taskId}/mock-output.ts`,
        changeType: "MODIFY",
      },
    ],
    commitMessage: `feat: apply task ${params.taskId}`,
    logs: ["mock execution completed (auto-healing)"],
    error: null,
  };

  const storedExecutionJson = taskRunExecutionResultToStoredJson(executionResult) as Prisma.InputJsonValue;
  const storedExecutionJsonWithMeta = {
    ...(storedExecutionJson as Record<string, unknown>),
    autoExecution: true,
    initiatedBy: "AUTO_HEALING",
    sourceExecutionJobId: params.meta.sourceExecutionJobId,
    sourceFailureType: params.meta.sourceFailureType ?? null,
    sourceStrategy: params.meta.sourceStrategy ?? null,
  } as Prisma.InputJsonValue;

  let completedId = "";
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT id FROM tasks WHERE id = $1::uuid FOR UPDATE", params.taskId);

    const pending = await tx.taskRun.findFirst({
      where: { taskId: params.taskId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      throw new Error("RUN_ALREADY_PENDING");
    }

    const run = await tx.taskRun.create({
      data: {
        taskId: params.taskId,
        taskPromptId: params.taskPromptId,
        status: "PENDING",
      },
      select: { id: true },
    });

    const done = await tx.taskRun.update({
      where: { id: run.id },
      data: {
        status: "DONE",
        resultText: "Mock 실행 완료 (auto-healing)",
        resultJson: storedExecutionJsonWithMeta,
      },
      select: { id: true },
    });

    completedId = done.id;

    await tx.task.update({
      where: { id: params.taskId },
      data: { status: "DONE" },
    });
  });

  return { taskRunId: completedId };
}

export async function triggerAutoHealingExecution(params: {
  projectId: string;
  sourceExecutionJobId: string;
  createdTaskIds: string[];
}): Promise<{
  triggered: boolean;
  executedTaskIds: string[];
  skippedTaskIds: Array<{ taskId: string; reason: string }>;
}> {
  if (!AUTO_HEALING_AUTO_RUN_ENABLED) {
    return { triggered: false, executedTaskIds: [], skippedTaskIds: [] };
  }

  const createdTaskIdSet = new Set(params.createdTaskIds);

  const tasks = await prisma.task.findMany({
    where: { id: { in: params.createdTaskIds }, projectId: params.projectId },
    select: {
      id: true,
      status: true,
      taskKind: true,
      changeReason: true,
      projectSpecUploadId: true,
      parentTaskId: true,
      project: { select: { autoCreateGitRequest: true, gitApprovalMode: true } },
      name: true,
    },
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const eligibleInOrder = params.createdTaskIds.filter((tid) => {
    const t = byId.get(tid);
    if (!t) return false;
    if (t.taskKind !== "AUTO_HEALING") return false;
    if (t.status !== "TODO") return false;
    if (!t.changeReason?.startsWith("AUTO_HEALING:")) return false;
    return true;
  });

  const skippedTaskIds: Array<{ taskId: string; reason: string }> = [];
  const executedTaskIds: string[] = [];

  const toConsider = eligibleInOrder.slice(0, AUTO_HEALING_MAX_AUTO_RUN_TASKS_PER_FAILURE);
  const beyondLimit = eligibleInOrder.slice(AUTO_HEALING_MAX_AUTO_RUN_TASKS_PER_FAILURE);
  for (const taskId of beyondLimit) {
    skippedTaskIds.push({ taskId, reason: "MAX_AUTO_RUN_TASKS_PER_FAILURE" });
  }

  const notEligible = params.createdTaskIds
    .filter((tid) => createdTaskIdSet.has(tid))
    .filter((tid) => !eligibleInOrder.includes(tid));
  for (const taskId of notEligible) {
    skippedTaskIds.push({ taskId, reason: "NOT_ELIGIBLE_AUTO_HEALING_TASK" });
  }

  for (const taskId of toConsider) {
    const task = byId.get(taskId);
    if (!task) continue;

    const { failureType, strategy } = parseAutoHealingChangeReason(task.changeReason);

    const alreadyTriggered = await prisma.taskHistory.findFirst({
      where: {
        taskId,
        eventType: TaskHistoryEventType.AUTO_HEALING_AUTO_RUN_TRIGGERED,
      },
      select: { id: true },
    });
    if (alreadyTriggered) {
      skippedTaskIds.push({ taskId, reason: "ALREADY_AUTO_RUNNED" });
      continue;
    }

    const attemptCount = await prisma.taskHistory.count({
      where: { taskId, eventType: TaskHistoryEventType.AUTO_HEALING_AUTO_RUN_TRIGGERED },
    });
    if (attemptCount >= AUTO_HEALING_MAX_AUTO_RUN_ATTEMPTS_PER_TASK) {
      skippedTaskIds.push({ taskId, reason: "MAX_AUTO_RUN_ATTEMPTS_REACHED" });
      continue;
    }

    // 1) Triggered history
    await appendTaskHistory({
      projectId: params.projectId,
      taskId,
      actorType: TaskHistoryActorType.SYSTEM,
      actorId: null,
      eventType: TaskHistoryEventType.AUTO_HEALING_AUTO_RUN_TRIGGERED,
      summary: "AUTO_HEALING 자동 실행 연결 시작",
      detailJson: {
        sourceExecutionJobId: params.sourceExecutionJobId,
        autoExecution: true,
        initiatedBy: "AUTO_HEALING",
        failureType: failureType ?? null,
        strategy: strategy ?? null,
      } as Prisma.InputJsonValue,
    });

    try {
      // 2) Prompt
      const { promptId } = await generateTaskPromptForAutoHealing(taskId);
      await appendTaskHistory({
        projectId: params.projectId,
        taskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: null,
        eventType: TaskHistoryEventType.AUTO_HEALING_PROMPT_GENERATED,
        summary: "AUTO_HEALING 프롬프트 생성",
        detailJson: {
          taskPromptId: promptId,
          autoExecution: true,
          sourceExecutionJobId: params.sourceExecutionJobId,
          failureType: failureType ?? null,
          strategy: strategy ?? null,
        } as Prisma.InputJsonValue,
      });

      // 3) Run
      await appendTaskHistory({
        projectId: params.projectId,
        taskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: null,
        eventType: TaskHistoryEventType.AUTO_HEALING_RUN_STARTED,
        summary: "AUTO_HEALING Run 시작",
        detailJson: {
          taskPromptId: promptId,
          autoExecution: true,
          sourceExecutionJobId: params.sourceExecutionJobId,
          failureType: failureType ?? null,
          strategy: strategy ?? null,
        } as Prisma.InputJsonValue,
      });

      const { taskRunId } = await executeAutoHealingTaskRunMock({
        taskId,
        taskPromptId: promptId,
        meta: {
          sourceExecutionJobId: params.sourceExecutionJobId,
          sourceFailureType: failureType,
          sourceStrategy: strategy,
        },
      });

      await appendTaskHistory({
        projectId: params.projectId,
        taskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: null,
        eventType: TaskHistoryEventType.AUTO_HEALING_RUN_FINISHED,
        summary: "AUTO_HEALING Run 완료",
        detailJson: {
          taskRunId,
          autoExecution: true,
          sourceExecutionJobId: params.sourceExecutionJobId,
          failureType: failureType ?? null,
          strategy: strategy ?? null,
        } as Prisma.InputJsonValue,
      });

      // 4) GitChangeRequest + Git-apply enqueue
      if (task.project.autoCreateGitRequest !== true) {
        skippedTaskIds.push({ taskId, reason: "AUTO_CREATE_GIT_REQUEST_DISABLED" });
        continue;
      }

      // Create git change request based on the same mock executionResult
      // (This mirrors /api/task/run mock behavior.)
      const executionResult: TaskRunExecutionResult = {
        success: true,
        mode: "mock",
        updatedFiles: [{ path: `projects/${taskId}/mock-output.ts`, changeType: "MODIFY" }],
        commitMessage: `feat: apply task ${taskId}`,
        logs: ["mock execution completed (auto-healing)"],
        error: null,
      };

      const gitCreated = await createGitChangeRequestFromExecutionResult({
        projectId: params.projectId,
        taskId,
        taskRunId,
        actorUserId: AUTO_ACTOR_USER_ID,
        executionResult,
      });

      let gcrId: string | null = null;
      if (gitCreated.ok && gitCreated.data?.id) {
        gcrId = gitCreated.data.id;
      } else {
        // If already exists, best-effort: find the latest by taskRunId.
        const existingGcr = await prisma.gitChangeRequest.findFirst({
          where: { taskRunId, projectId: params.projectId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        gcrId = existingGcr?.id ?? null;
      }

      if (!gcrId) {
        skippedTaskIds.push({ taskId, reason: "GIT_CHANGE_REQUEST_NOT_CREATED" });
        continue;
      }

      const gcr = await prisma.gitChangeRequest.findUnique({
        where: { id: gcrId },
        select: {
          id: true,
          projectId: true,
          status: true,
          project: { select: { gitApprovalMode: true } },
        },
      });

      if (!gcr) {
        skippedTaskIds.push({ taskId, reason: "GIT_CHANGE_REQUEST_NOT_FOUND" });
        continue;
      }

      const policyErr = validateGitApplyPostEligibility({
        isRetry: false,
        gitApprovalMode: gcr.project.gitApprovalMode,
        status: gcr.status,
      });

      if (policyErr) {
        await appendTaskHistory({
          projectId: params.projectId,
          taskId,
          actorType: TaskHistoryActorType.SYSTEM,
          actorId: null,
          eventType: TaskHistoryEventType.AUTO_HEALING_RUN_SKIPPED,
          summary: "AUTO_HEALING Git-apply enqueue 스킵",
          detailJson: {
            taskRunId,
            gitChangeRequestId: gcr.id,
            reason: `${policyErr.code}:${policyErr.message}`,
            autoExecution: true,
          } as Prisma.InputJsonValue,
        });
        skippedTaskIds.push({ taskId, reason: policyErr.message });
        continue;
      }

      const enq = await enqueueExecution({
        projectId: gcr.projectId,
        type: "git-apply",
        payload: {
          gitChangeRequestId: gcr.id,
          mode: "mock",
          retry: false,
          actorUserId: AUTO_ACTOR_USER_ID,
        } as Prisma.InputJsonValue,
      });

      if (!enq.queued) {
        skippedTaskIds.push({ taskId, reason: `ENQUEUE_FAILED:${enq.reason}` });
        continue;
      }

      executedTaskIds.push(taskId);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      await appendTaskHistory({
        projectId: params.projectId,
        taskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: null,
        eventType: TaskHistoryEventType.AUTO_HEALING_RUN_SKIPPED,
        summary: "AUTO_HEALING Run 스킵",
        detailJson: {
          reason,
          autoExecution: true,
          sourceExecutionJobId: params.sourceExecutionJobId,
        } as Prisma.InputJsonValue,
      });
      skippedTaskIds.push({ taskId, reason });
    }
  }

  return {
    triggered: toConsider.length > 0,
    executedTaskIds,
    skippedTaskIds,
  };
}

