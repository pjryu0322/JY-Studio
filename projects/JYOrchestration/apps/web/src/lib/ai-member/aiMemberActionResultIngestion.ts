import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type IngestInput = {
  actionId: string;
  projectId: string;
  actionType: string;
  taskId: string | null;
  gitChangeRequestId: string | null;
  taskRunId: string | null;
  resultPayload: Record<string, unknown>;
  summaryText?: string;
};

function pickSummary(input: IngestInput): string {
  if (input.summaryText?.trim()) {
    return input.summaryText.trim().slice(0, 500);
  }
  const rp = input.resultPayload;
  if (rp && typeof rp === "object" && typeof (rp as { summaryText?: string }).summaryText === "string") {
    return String((rp as { summaryText: string }).summaryText).slice(0, 500);
  }
  return "";
}

/**
 * 파괴적 자동 변경 없이 결과를 도메인에 안전하게 반영한다.
 */
export async function ingestAiMemberActionResult(input: IngestInput): Promise<void> {
  const summary = pickSummary(input);

  if (input.actionType === "REVIEW_REQUEST" && input.gitChangeRequestId) {
    const prefix = "AI_REVIEW:";
    const next = summary ? `${prefix}${summary}` : `${prefix}완료(요약 없음)`;
    await prisma.gitChangeRequest.updateMany({
      where: { id: input.gitChangeRequestId, projectId: input.projectId },
      data: {
        reviewStatus: next.slice(0, 2000),
      },
    });
  }

  if (input.actionType === "TASK_DRAFT_REQUEST" && input.taskId) {
    const nextDesc = await mergeDraftHint(input.taskId, input.resultPayload, summary);
    await prisma.task.updateMany({
      where: { id: input.taskId, projectId: input.projectId },
      data: { description: nextDesc },
    });
  }

  if (input.actionType === "QA_CHECK_REQUEST" && input.taskRunId) {
    const run = await prisma.taskRun.findFirst({
      where: { id: input.taskRunId, task: { projectId: input.projectId } },
      select: { id: true, resultJson: true },
    });
    if (run) {
      const prev =
        run.resultJson && typeof run.resultJson === "object" && !Array.isArray(run.resultJson)
          ? (run.resultJson as Record<string, unknown>)
          : {};
      const detail = {
        ...prev,
        aiMemberQa: {
          actionId: input.actionId,
          ingestedAt: new Date().toISOString(),
          resultPayload: input.resultPayload as Prisma.InputJsonValue,
        },
      } as Prisma.InputJsonValue;
      await prisma.taskRun.update({
        where: { id: run.id },
        data: { resultJson: detail },
      });
    }
  }

  if (input.actionType === "SUMMARY_REQUEST") {
    void summary;
  }
}

async function mergeDraftHint(taskId: string, resultPayload: Record<string, unknown>, summary: string): Promise<string> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { description: true },
  });
  const base = task?.description?.trim() ?? "";
  const draft =
    typeof resultPayload.draftDescription === "string"
      ? resultPayload.draftDescription
      : typeof resultPayload.suggestedPrompt === "string"
        ? resultPayload.suggestedPrompt
        : summary;
  const block = `\n\n--- AI 초안(미승인) ---\n${draft || summary || "(내용 없음)"}\n`;
  if (base.includes("--- AI 초안(미승인) ---")) {
    return base.replace(/\n\n--- AI 초안\(미승인\) ---[\s\S]*$/, block);
  }
  return `${base}${block}`.trim();
}
