import { prisma } from "@/lib/prisma";

/** Persist SCM/merge block reason on run for `teamRuntime.blockReason` display. */
export async function persistScmBlockReasonOnRun(
  execRunId: string,
  reason: string
): Promise<void> {
  const normalized = String(reason ?? "").trim();
  if (!normalized) return;

  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: { evaluationReason: normalized.slice(0, 8000) },
  });
}
