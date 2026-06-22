import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STRUCTURE_NODE_LIFECYCLE, type StructureNodeLifecycleStatus } from "@/lib/project-structure/projectStructureTypes";

export type StructureDbClient = Prisma.TransactionClient | typeof prisma;

export async function recordStructureLifecycleTransition(
  db: StructureDbClient,
  input: Readonly<{
    readonly projectId: string;
    readonly candidateId: string;
    readonly fromStatus: StructureNodeLifecycleStatus | null;
    readonly toStatus: StructureNodeLifecycleStatus;
    readonly actorId?: string | null;
    readonly reason?: string | null;
    readonly audit?: unknown;
  }>,
) {
  return db.projectNodeLifecycle.create({
    data: {
      projectId: input.projectId,
      candidateId: input.candidateId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
      audit: input.audit == null ? undefined : (input.audit as Prisma.InputJsonValue),
    },
  });
}

export async function setCandidateLifecycleStatus(
  db: StructureDbClient,
  input: Readonly<{
    readonly projectId: string;
    readonly candidateId: string;
    readonly toStatus: StructureNodeLifecycleStatus;
    readonly actorId?: string | null;
    readonly reason?: string | null;
    readonly audit?: unknown;
  }>,
) {
  const candidate = await db.projectStructureCandidate.findFirst({
    where: { id: input.candidateId, projectId: input.projectId },
  });
  if (!candidate) {
    throw new Error("CANDIDATE_NOT_FOUND");
  }
  const fromStatus = candidate.lifecycleStatus as StructureNodeLifecycleStatus;
  if (fromStatus === input.toStatus) return candidate;

  await recordStructureLifecycleTransition(db, {
    projectId: input.projectId,
    candidateId: input.candidateId,
    fromStatus,
    toStatus: input.toStatus,
    actorId: input.actorId,
    reason: input.reason,
    audit: input.audit,
  });

  return db.projectStructureCandidate.update({
    where: { id: candidate.id },
    data: { lifecycleStatus: input.toStatus },
  });
}

export function isTerminalLifecycle(status: string): boolean {
  return status === STRUCTURE_NODE_LIFECYCLE.DEPRECATED || status === STRUCTURE_NODE_LIFECYCLE.ARCHIVED;
}
