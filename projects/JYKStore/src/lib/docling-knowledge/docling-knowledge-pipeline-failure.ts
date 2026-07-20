/**
 * Step recording and failure helpers for Docling knowledge pipeline execution.
 */
import type { PipelineStatus, PipelineStepStatus } from "@prisma/client";
import {
  serializeKnowledgeRunBinding,
  parseKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { BINDING_FAILURE_USER_MESSAGE } from "@/lib/docling-knowledge/docling-knowledge-pipeline-status-policy";
import {
  completePipelineStep,
  finishPipelineRun,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";
import { assertKnowledgeRunLock } from "@/workers/knowledge-pipeline-job-claim";

export async function assertRunStillActive(
  runId: string,
): Promise<KnowledgeRunBinding | null> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    select: { status: true, summary: true },
  });
  if (!run || run.status !== "RUNNING") return null;
  const binding = parseKnowledgeRunBinding(run.summary);
  if (!binding) return null;
  if (binding.cancelRequestedAt) return null;
  return binding;
}

export async function markPipelineStep(input: {
  packId: string;
  runId: string;
  step: PipelineStatus;
  status: PipelineStepStatus;
  message?: string;
  details?: Record<string, unknown>;
  lockOwner?: string;
}): Promise<{ cancelled: boolean }> {
  const { packId, runId, step, status, message, details, lockOwner } = input;
  if (lockOwner) {
    const owned = await assertKnowledgeRunLock({ runId, lockOwner });
    if (!owned) return { cancelled: true };
  } else {
    const active = await assertRunStillActive(runId);
    if (!active && status === "RUNNING") return { cancelled: true };
    if (!active && (status === "PASS" || status === "WARNING" || status === "FAIL")) {
      const run = await prisma.pipelineRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });
      if (run?.status !== "RUNNING") return { cancelled: true };
    }
  }

  await completePipelineStep({ runId, step, status, message, details });
  if (status === "RUNNING") {
    await updatePackPipelineStatus({ packId, pipelineStatus: step });
  }
  return { cancelled: false };
}

export async function failPipelineRun(input: {
  packId: string;
  runId: string;
  /** Provider-facing / stored user message */
  userMessage: string;
  binding?: KnowledgeRunBinding | null;
  code?: string;
  /** Optional distinct internal failureMessage when different from userMessage */
  internalMessage?: string;
}): Promise<void> {
  const summaryText = input.userMessage;
  const next = input.binding
    ? serializeKnowledgeRunBinding({
        ...input.binding,
        failureCode: input.code ?? input.binding.failureCode,
        failureMessage: input.internalMessage ?? summaryText,
        userMessage: summaryText,
        lockOwner: null,
        lockExpiresAt: null,
      })
    : summaryText;
  await finishPipelineRun({ runId: input.runId, status: "FAIL", summary: next });
  await updatePackPipelineStatus({
    packId: input.packId,
    pipelineStatus: "FAILED",
    message: summaryText,
  });
}

/** Binding/stale failures always use the shared provider refresh message. */
export async function failBindingMismatch(input: {
  packId: string;
  runId: string;
  lockOwner: string;
  binding: KnowledgeRunBinding;
  code: string;
}): Promise<void> {
  await markPipelineStep({
    packId: input.packId,
    runId: input.runId,
    step: "STRUCTURE_VALIDATING",
    status: "FAIL",
    message: BINDING_FAILURE_USER_MESSAGE,
    details: { code: input.code },
    lockOwner: input.lockOwner,
  });
  await failPipelineRun({
    packId: input.packId,
    runId: input.runId,
    userMessage: BINDING_FAILURE_USER_MESSAGE,
    binding: input.binding,
    code: input.code,
  });
}
