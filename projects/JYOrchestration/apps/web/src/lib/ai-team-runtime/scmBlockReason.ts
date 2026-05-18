import { prisma } from "@/lib/prisma";

/** Persist SCM/merge block reason on run for `teamRuntime.blockReason` display. */
export async function persistScmBlockReasonOnRun(
  execRunId: string,
  reason: string
): Promise<void> {
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: { evaluationReason: reason.slice(0, 8000) },
  });
}
