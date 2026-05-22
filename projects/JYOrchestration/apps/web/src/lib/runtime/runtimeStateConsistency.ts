/**
 * Runtime state consistency checks (E2E / ops validation).
 */

import { AI_TEAM_EXECUTION_STATUS } from "@/lib/ai-team-runtime/status";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";
import { readTeamExecutionStatus } from "@/lib/ai-team-runtime/persist";
import { parsePipelineExecutionJobPayload } from "@/lib/runtime/pipelineExecutionJobTypes";
import { parseCursorExecutionJobPayload } from "@/lib/runtime/cursorExecutionJobTypes";
import { prisma } from "@/lib/prisma";

export type RuntimeConsistencyIssue = {
  readonly code: string;
  readonly message: string;
  readonly severity: "warning" | "error";
};

export async function validateRuntimeStateConsistency(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
}): Promise<{ readonly ok: boolean; readonly issues: RuntimeConsistencyIssue[] }> {
  const issues: RuntimeConsistencyIssue[] = [];

  const [run, task] = await Promise.all([
    prisma.taskExecutionRun.findUnique({
      where: { id: input.execRunId },
      select: {
        id: true,
        taskId: true,
        projectId: true,
        status: true,
        evaluationDecision: true,
        prStatus: true,
      },
    }),
    prisma.task.findUnique({
      where: { id: input.taskId },
      select: {
        id: true,
        status: true,
        executionWorkflowStatus: true,
      },
    }),
  ]);

  if (!run) {
    issues.push({ code: "EXEC_RUN_MISSING", message: "TaskExecutionRun not found", severity: "error" });
    return { ok: false, issues };
  }
  if (run.taskId !== input.taskId) {
    issues.push({
      code: "EXEC_RUN_TASK_MISMATCH",
      message: `execRun.taskId ${run.taskId} !== ${input.taskId}`,
      severity: "error",
    });
  }
  if (run.projectId !== input.projectId) {
    issues.push({
      code: "EXEC_RUN_PROJECT_MISMATCH",
      message: `execRun.projectId ${run.projectId} !== ${input.projectId}`,
      severity: "error",
    });
  }

  if (!task) {
    issues.push({ code: "TASK_MISSING", message: "Task not found", severity: "error" });
  }

  const jobs = await prisma.executionJob.findMany({
    where: {
      projectId: input.projectId,
      type: { in: ["cursor", "pipeline"] },
      status: { in: ["PENDING", "RUNNING", "DONE", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { id: true, type: true, status: true, payload: true, createdAt: true },
  });

  let latestCursor: (typeof jobs)[number] | undefined;
  let latestPipeline: (typeof jobs)[number] | undefined;
  for (const job of jobs) {
    const payload =
      job.type === "cursor"
        ? parseCursorExecutionJobPayload(job.payload)
        : parsePipelineExecutionJobPayload(job.payload);
    if (!payload) continue;

    if (payload.execRunId === input.execRunId && payload.taskId !== input.taskId) {
      issues.push({
        code: job.type === "cursor" ? "CURSOR_JOB_PAYLOAD_MISMATCH" : "PIPELINE_JOB_PAYLOAD_MISMATCH",
        message: `${job.type} job payload.taskId does not match input taskId`,
        severity: "error",
      });
    }

    if (payload.taskId === input.taskId && payload.execRunId !== input.execRunId) {
      issues.push({
        code: job.type === "cursor" ? "CURSOR_JOB_PAYLOAD_MISMATCH" : "PIPELINE_JOB_PAYLOAD_MISMATCH",
        message: `${job.type} job payload.execRunId does not match input execRunId`,
        severity: "error",
      });
    }

    if (payload.execRunId !== input.execRunId || payload.taskId !== input.taskId) {
      continue;
    }
    if (job.type === "cursor" && !latestCursor) latestCursor = job;
    if (job.type === "pipeline" && !latestPipeline) latestPipeline = job;
  }

  if (latestCursor) {
    const p = parseCursorExecutionJobPayload(latestCursor.payload);
    if (p && (p.execRunId !== input.execRunId || p.taskId !== input.taskId)) {
      issues.push({
        code: "CURSOR_JOB_PAYLOAD_MISMATCH",
        message: "Latest cursor job payload does not match execRun/task",
        severity: "error",
      });
    }
  }

  if (latestPipeline) {
    const p = parsePipelineExecutionJobPayload(latestPipeline.payload);
    if (p && (p.execRunId !== input.execRunId || p.taskId !== input.taskId)) {
      issues.push({
        code: "PIPELINE_JOB_PAYLOAD_MISMATCH",
        message: "Latest pipeline job payload does not match execRun/task",
        severity: "error",
      });
    }
  }

  if (task && run.prStatus === "merged" && task.status !== "DONE") {
    issues.push({
      code: "MERGED_TASK_NOT_DONE",
      message: `PR merged but task.status=${task.status}`,
      severity: "warning",
    });
  }

  if (
    task?.executionWorkflowStatus === EXECUTION_WORKFLOW.REVIEW_REJECTED &&
    latestPipeline &&
    (latestPipeline.status === "DONE" || run.prStatus === "merged")
  ) {
    issues.push({
      code: "REJECTED_WITH_COMPLETED_PIPELINE",
      message: "Review rejected but pipeline job appears completed/merged",
      severity: "error",
    });
  }

  const teamStatus = await readTeamExecutionStatus(input.execRunId);
  if (
    teamStatus === AI_TEAM_EXECUTION_STATUS.APPROVAL_WAITING &&
    latestPipeline?.status === "DONE"
  ) {
    issues.push({
      code: "APPROVAL_WAITING_PIPELINE_DONE",
      message: "approval_waiting while pipeline job is already DONE",
      severity: "warning",
    });
  }

  const hasError = issues.some((i) => i.severity === "error");
  return { ok: !hasError, issues };
}
