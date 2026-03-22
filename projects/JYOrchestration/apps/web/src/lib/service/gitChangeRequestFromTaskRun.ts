/**
 * TaskRun → GitChangeRequest 생성 (수동 API / Run 완료 자동 연결 공통).
 */
import type { Prisma } from "@prisma/client";
import {
  TaskHistoryActorType,
  TaskHistoryEventType,
} from "@/lib/history/taskHistoryConstants";
import { isManualGitApprovalMode } from "@/lib/git-apply/retry";
import {
  isTaskRunResultJson,
  type TaskRunExecutionResult,
  type TaskRunResultJson,
} from "@/lib/integration/taskRunResultTypes";
import { prisma } from "@/lib/prisma";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { requireGitChangeRequestCreate } from "@/lib/service/projectAccessGuard";
import { appendTaskHistory } from "@/lib/service/taskHistoryService";

export type GitChangeRequestFileRow = {
  path: string;
  type: "MODIFY" | "CREATE";
};

export const GIT_CHANGE_REQUEST_FROM_RUN_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  INVALID_STATUS: "INVALID_STATUS",
  ALREADY_EXISTS: "GIT_REQUEST_ALREADY_EXISTS",
  FORBIDDEN: "GIT_REQUEST_FORBIDDEN",
  MISMATCH: "GIT_REQUEST_CONTEXT_MISMATCH",
} as const;

export type CreateGitChangeRequestForTaskRunSource = "api" | "auto-after-run";

export type CreateGitChangeRequestForTaskRunInput = {
  taskRunId: string;
  actorUserId: string;
  source: CreateGitChangeRequestForTaskRunSource;
};

export type CreateGitChangeRequestForTaskRunResult =
  | {
      ok: true;
      data: {
        id: string;
        projectId: string;
        taskId: string;
        taskRunId: string;
        status: string;
        files: Prisma.JsonValue;
        diffText: string | null;
        commitMessage: string | null;
        applyStatus: string | null;
        applyLog: string | null;
      };
    }
  | { ok: false; code: string; message: string; httpStatus: number };

export type CreateGitChangeRequestFromExecutionResultInput = {
  projectId: string;
  taskId: string;
  taskRunId: string;
  actorUserId: string;
  executionResult: TaskRunExecutionResult;
};

/**
 * Run(mock) 완료 직후 GitChangeRequest 자동 생성 — 전역 env 보조 스위치.
 * - 기본: 허용. 끄기: JY_AUTO_GIT_REQUEST_AFTER_RUN=0 | false | no | off
 */
export function isAutoGitRequestAfterRunEnabled(): boolean {
  const raw = process.env.JY_AUTO_GIT_REQUEST_AFTER_RUN;
  if (raw === undefined || raw === null) {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === "" || v === "1" || v === "true" || v === "yes" || v === "on") {
    return true;
  }
  if (v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return true;
}

function defaultMockFileChanges(): GitChangeRequestFileRow[] {
  return [
    { path: "apps/web/src/app/page.tsx", type: "MODIFY" },
    { path: "apps/web/src/app/projects/[projectId]/page.tsx", type: "MODIFY" },
  ];
}

function buildMockDiff(
  taskId: string,
  resultText: string | null,
  summaryExtra?: string | null
): string {
  const base = (resultText || "Mock 실행 결과를 기반으로 코드 변경안을 구성합니다.").slice(
    0,
    120
  );
  const extra = summaryExtra?.trim().slice(0, 80);
  const summary = extra ? `${base} | ${extra}` : base;
  return [
    "--- a/page.tsx",
    "+++ b/page.tsx",
    "@@ -1,3 +1,6 @@",
    `+// taskId: ${taskId}`,
    `+// source summary: ${summary}`,
    '+console.log("task applied");',
    "",
  ].join("\n");
}

function filesFromResultJson(parsed: TaskRunResultJson | null): GitChangeRequestFileRow[] | null {
  if (!parsed?.updatedFiles?.length) return null;
  const out: GitChangeRequestFileRow[] = [];
  for (const f of parsed.updatedFiles) {
    const path = String(f.path ?? "").trim();
    if (!path) continue;
    const ct = f.changeType;
    const type: "CREATE" | "MODIFY" =
      ct === "CREATE" ? "CREATE" : "MODIFY";
    out.push({ path, type });
  }
  return out.length ? out : null;
}

export function buildGitChangeRequestPayloadFromTaskRun(input: {
  taskId: string;
  resultText: string | null;
  resultJson: Prisma.JsonValue | null;
}): {
  files: GitChangeRequestFileRow[];
  diffText: string;
  commitMessage: string;
} {
  const parsed = isTaskRunResultJson(input.resultJson) ? input.resultJson : null;
  const files = filesFromResultJson(parsed) ?? defaultMockFileChanges();
  const commitMessage =
    parsed?.commitMessage?.trim() || `feat: apply task ${input.taskId}`;
  const logHint = parsed?.logs?.length ? parsed.logs[0] ?? null : null;
  const diffText = buildMockDiff(input.taskId, input.resultText, logHint);
  return { files, diffText, commitMessage };
}

/** TaskRunExecutionResult 기반 GitChangeRequest files/diff/commit (자동 생성·재사용). */
export function buildGitChangeRequestPayloadFromExecutionResult(
  executionResult: TaskRunExecutionResult,
  taskId: string,
  resultText: string | null
): {
  files: GitChangeRequestFileRow[];
  diffText: string;
  commitMessage: string;
} {
  const rows: GitChangeRequestFileRow[] = [];
  for (const f of executionResult.updatedFiles) {
    const path = String(f.path ?? "").trim();
    if (!path) continue;
    if (f.changeType === "CREATE") {
      rows.push({ path, type: "CREATE" });
    } else {
      rows.push({ path, type: "MODIFY" });
    }
  }
  const files = rows.length > 0 ? rows : defaultMockFileChanges();
  const commitMessage =
    executionResult.commitMessage?.trim() || `feat: apply task ${taskId}`;
  const logHint = executionResult.logs?.[0] ?? null;
  const diffText = buildMockDiff(taskId, resultText, logHint);
  return { files, diffText, commitMessage };
}

type LockedRunRow = {
  id: string;
  status: string;
  taskId: string;
  resultText: string | null;
  resultJson: Prisma.JsonValue | null;
};

async function appendGitRequestHistories(input: {
  saved: {
    id: string;
    projectId: string;
    taskId: string;
    commitMessage: string | null;
    files: Prisma.JsonValue;
    diffText: string | null;
  };
  actorUserId: string;
  source: CreateGitChangeRequestForTaskRunSource;
  manualApproval: boolean;
  historyExtra?: Record<string, unknown>;
}) {
  const { saved, actorUserId, source, manualApproval, historyExtra } = input;
  try {
    await appendTaskHistory({
      projectId: saved.projectId,
      taskId: saved.taskId,
      actorType: TaskHistoryActorType.USER,
      actorId: actorUserId,
      eventType: TaskHistoryEventType.GIT_REQUEST_CREATED,
      summary:
        source === "auto-after-run"
          ? "Git 반영 요청 자동 등록(Run 완료)"
          : "Git 반영 요청 등록",
      detailJson: {
        gitChangeRequestId: saved.id,
        commitMessage: saved.commitMessage,
        files: saved.files,
        diffExists: Boolean(saved.diffText && saved.diffText.length > 0),
        source,
        autoCreated: source === "auto-after-run",
        ...(historyExtra ?? {}),
      },
    });
  } catch (historyError) {
    console.error("GIT_REQUEST_CREATED history append failed:", historyError);
  }

  if (manualApproval) {
    try {
      await appendTaskHistory({
        projectId: saved.projectId,
        taskId: saved.taskId,
        actorType: TaskHistoryActorType.SYSTEM,
        actorId: null,
        eventType: TaskHistoryEventType.GIT_APPROVAL_REQUIRED,
        summary: "Git 반영 승인이 필요한 요청으로 등록됨",
        detailJson: {
          gitChangeRequestId: saved.id,
          gitApprovalMode: "MANUAL_APPROVAL",
          source,
          autoCreated: source === "auto-after-run",
          ...(historyExtra ?? {}),
        },
      });
    } catch (historyError) {
      console.error("GIT_APPROVAL_REQUIRED history append failed:", historyError);
    }
  }
}

async function runGitChangeRequestTransaction(input: {
  taskRunId: string;
  projectId: string;
  actorUserId: string;
  source: CreateGitChangeRequestForTaskRunSource;
  initialStatus: string;
  resolvePayload: (locked: LockedRunRow) => {
    files: GitChangeRequestFileRow[];
    diffText: string;
    commitMessage: string;
  };
  historyExtra?: Record<string, unknown>;
  manualApproval: boolean;
}): Promise<CreateGitChangeRequestForTaskRunResult> {
  const {
    taskRunId,
    projectId,
    actorUserId,
    source,
    initialStatus,
    resolvePayload,
    historyExtra,
    manualApproval,
  } = input;

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const locked = await tx.taskRun.findUnique({
        where: { id: taskRunId },
        select: {
          id: true,
          status: true,
          taskId: true,
          resultText: true,
          resultJson: true,
        },
      });
      if (!locked) {
        throw new Error("NOT_FOUND");
      }

      const dup = await tx.gitChangeRequest.findFirst({
        where: { taskRunId: locked.id },
        select: { id: true },
      });
      if (dup) {
        throw new Error("ALREADY_EXISTS");
      }

      if (source === "api") {
        if (locked.status !== "READY_FOR_GIT") {
          throw new Error("INVALID_STATUS_API");
        }
      } else {
        if (locked.status !== "DONE") {
          throw new Error("INVALID_STATUS_AUTO");
        }
        await tx.taskRun.update({
          where: { id: locked.id },
          data: { status: "READY_FOR_GIT" },
        });
      }

      const { files, diffText, commitMessage } = resolvePayload(locked);

      const created = await tx.gitChangeRequest.create({
        data: {
          projectId,
          taskId: locked.taskId,
          taskRunId: locked.id,
          status: initialStatus,
          files,
          diffText,
          commitMessage,
          applyStatus: "PENDING",
          rejectionReason: null,
        },
        select: {
          id: true,
          projectId: true,
          taskId: true,
          taskRunId: true,
          status: true,
          files: true,
          diffText: true,
          commitMessage: true,
          applyStatus: true,
          applyLog: true,
        },
      });

      if (source === "auto-after-run") {
        const prev = locked.resultJson;
        const base =
          prev && typeof prev === "object" && !Array.isArray(prev)
            ? { ...(prev as Record<string, unknown>) }
            : {};
        await tx.taskRun.update({
          where: { id: locked.id },
          data: {
            resultJson: {
              ...base,
              autoGitChangeRequestId: created.id,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return created;
    });

    await appendGitRequestHistories({
      saved,
      actorUserId,
      source,
      manualApproval,
      historyExtra,
    });

    return { ok: true, data: saved };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_FOUND") {
      return {
        ok: false,
        code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.NOT_FOUND,
        message: "대상 TaskRun을 찾을 수 없습니다.",
        httpStatus: 404,
      };
    }
    if (msg === "ALREADY_EXISTS") {
      return {
        ok: false,
        code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.ALREADY_EXISTS,
        message:
          "이 TaskRun에 대한 Git 반영 요청이 이미 등록되어 있습니다. 중복 등록할 수 없습니다.",
        httpStatus: 409,
      };
    }
    if (msg === "INVALID_STATUS_API") {
      return {
        ok: false,
        code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.INVALID_STATUS,
        message: "READY_FOR_GIT 상태의 TaskRun만 요청 등록할 수 있습니다.",
        httpStatus: 400,
      };
    }
    if (msg === "INVALID_STATUS_AUTO") {
      return {
        ok: false,
        code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.INVALID_STATUS,
        message: "자동 Git 요청은 DONE 상태의 TaskRun에서만 가능합니다.",
        httpStatus: 400,
      };
    }
    console.error("runGitChangeRequestTransaction error:", e);
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: "Git 반영 요청 등록 중 오류가 발생했습니다.",
      httpStatus: 500,
    };
  }
}

/**
 * TaskRun 기준 GitChangeRequest 1건 생성.
 * - source `api`: READY_FOR_GIT 만 허용 (기존 git-request POST 와 동일).
 * - source `auto-after-run`: DONE 인 Run 을 READY_FOR_GIT 로 올린 뒤 생성.
 */
export async function createGitChangeRequestForTaskRun(
  input: CreateGitChangeRequestForTaskRunInput
): Promise<CreateGitChangeRequestForTaskRunResult> {
  const taskRunId = String(input.taskRunId ?? "").trim();
  if (!taskRunId) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.INVALID_REQUEST,
      message: "taskRunId가 필요합니다.",
      httpStatus: 400,
    };
  }

  const run = await prisma.taskRun.findUnique({
    where: { id: taskRunId },
    select: {
      id: true,
      status: true,
      taskId: true,
      resultText: true,
      resultJson: true,
      task: { select: { projectId: true } },
    },
  });

  if (!run) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.NOT_FOUND,
      message: "대상 TaskRun을 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  try {
    await requireGitChangeRequestCreate(run.task.projectId, input.actorUserId);
  } catch (e) {
    if (e instanceof ProjectAccessDeniedError) {
      return {
        ok: false,
        code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.FORBIDDEN,
        message: e.message,
        httpStatus: 403,
      };
    }
    throw e;
  }

  const existingRequest = await prisma.gitChangeRequest.findFirst({
    where: { taskRunId: run.id },
    select: { id: true },
  });
  if (existingRequest) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.ALREADY_EXISTS,
      message:
        "이 TaskRun에 대한 Git 반영 요청이 이미 등록되어 있습니다. 중복 등록할 수 없습니다.",
      httpStatus: 409,
    };
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: run.task.projectId },
    select: { gitApprovalMode: true },
  });
  const manualApproval = isManualGitApprovalMode(projectRow?.gitApprovalMode);
  const initialStatus = manualApproval ? "APPROVAL_REQUIRED" : "REQUESTED";

  return runGitChangeRequestTransaction({
    taskRunId,
    projectId: run.task.projectId,
    actorUserId: input.actorUserId,
    source: input.source,
    initialStatus,
    manualApproval,
    resolvePayload: (locked) =>
      buildGitChangeRequestPayloadFromTaskRun({
        taskId: locked.taskId,
        resultText: locked.resultText,
        resultJson: locked.resultJson,
      }),
  });
}

/**
 * Run 완료 직후 in-memory 실행 결과로 GitChangeRequest 생성 (task/run 과 동일 페이로드 보장).
 */
export async function createGitChangeRequestFromExecutionResult(
  input: CreateGitChangeRequestFromExecutionResultInput
): Promise<CreateGitChangeRequestForTaskRunResult> {
  const taskRunId = String(input.taskRunId ?? "").trim();
  if (!taskRunId || !input.projectId?.trim() || !input.taskId?.trim()) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.INVALID_REQUEST,
      message: "projectId, taskId, taskRunId가 필요합니다.",
      httpStatus: 400,
    };
  }

  const run = await prisma.taskRun.findUnique({
    where: { id: taskRunId },
    select: {
      id: true,
      status: true,
      taskId: true,
      resultText: true,
      resultJson: true,
      task: { select: { projectId: true } },
    },
  });

  if (!run) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.NOT_FOUND,
      message: "대상 TaskRun을 찾을 수 없습니다.",
      httpStatus: 404,
    };
  }

  if (run.taskId !== input.taskId || run.task.projectId !== input.projectId) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.MISMATCH,
      message: "TaskRun과 project/task 컨텍스트가 일치하지 않습니다.",
      httpStatus: 400,
    };
  }

  try {
    await requireGitChangeRequestCreate(run.task.projectId, input.actorUserId);
  } catch (e) {
    if (e instanceof ProjectAccessDeniedError) {
      return {
        ok: false,
        code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.FORBIDDEN,
        message: e.message,
        httpStatus: 403,
      };
    }
    throw e;
  }

  const existingRequest = await prisma.gitChangeRequest.findFirst({
    where: { taskRunId: run.id },
    select: { id: true },
  });
  if (existingRequest) {
    return {
      ok: false,
      code: GIT_CHANGE_REQUEST_FROM_RUN_CODES.ALREADY_EXISTS,
      message:
        "이 TaskRun에 대한 Git 반영 요청이 이미 등록되어 있습니다. 중복 등록할 수 없습니다.",
      httpStatus: 409,
    };
  }

  const projectRow = await prisma.project.findUnique({
    where: { id: run.task.projectId },
    select: { gitApprovalMode: true },
  });
  const manualApproval = isManualGitApprovalMode(projectRow?.gitApprovalMode);
  const initialStatus = manualApproval ? "APPROVAL_REQUIRED" : "REQUESTED";

  const er = input.executionResult;
  const historyExtra = {
    updatedFiles: er.updatedFiles,
    commitMessage: er.commitMessage ?? null,
  };

  return runGitChangeRequestTransaction({
    taskRunId,
    projectId: run.task.projectId,
    actorUserId: input.actorUserId,
    source: "auto-after-run",
    initialStatus,
    manualApproval,
    historyExtra,
    resolvePayload: (locked) =>
      buildGitChangeRequestPayloadFromExecutionResult(
        input.executionResult,
        locked.taskId,
        locked.resultText
      ),
  });
}
