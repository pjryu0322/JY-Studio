import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { setCandidateLifecycleStatus } from "@/lib/project-structure/projectStructureLifecycle";
import { STRUCTURE_NODE_LIFECYCLE } from "@/lib/project-structure/projectStructureTypes";

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function mergeStructureCandidates(input: Readonly<{
  readonly projectId: string;
  readonly sourceCandidateId: string;
  readonly targetCandidateId: string;
  readonly mergedByUserId?: string | null;
}>) {
  const pid = input.projectId;
  if (input.sourceCandidateId === input.targetCandidateId) {
    throw new Error("MERGE_SAME_CANDIDATE");
  }

  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.projectStructureCandidate.findFirst({ where: { id: input.sourceCandidateId, projectId: pid } }),
      tx.projectStructureCandidate.findFirst({ where: { id: input.targetCandidateId, projectId: pid } }),
    ]);
    if (!source || !target) throw new Error("CANDIDATE_NOT_FOUND");

    const mergedSummary = [target.summary, source.summary].filter(Boolean).join("\n---\n").slice(0, 4000);
    const updatedTarget = await tx.projectStructureCandidate.update({
      where: { id: target.id },
      data: {
        summary: mergedSummary,
        lifecycleStatus: STRUCTURE_NODE_LIFECYCLE.MODIFIED,
        metadata: {
          ...(typeof target.metadata === "object" && target.metadata && !Array.isArray(target.metadata)
            ? (target.metadata as Record<string, unknown>)
            : {}),
          mergedFromCandidateId: source.id,
        } as Prisma.InputJsonValue,
      },
    });

    await setCandidateLifecycleStatus(tx, {
      projectId: pid,
      candidateId: source.id,
      toStatus: STRUCTURE_NODE_LIFECYCLE.DEPRECATED,
      actorId: input.mergedByUserId,
      reason: "merged_into_target",
      audit: { targetCandidateId: target.id },
    });

    await setCandidateLifecycleStatus(tx, {
      projectId: pid,
      candidateId: target.id,
      toStatus: STRUCTURE_NODE_LIFECYCLE.MODIFIED,
      actorId: input.mergedByUserId,
      reason: "merge_target_updated",
      audit: { sourceCandidateId: source.id },
    });

    await tx.projectMergeHistory.create({
      data: {
        projectId: pid,
        sourceCandidateId: source.id,
        targetCandidateId: target.id,
        mergedByUserId: input.mergedByUserId ?? null,
        mergeSummary: mergedSummary.slice(0, 2000),
        audit: {
          sourceTitle: source.title,
          targetTitle: target.title,
          preservedSourceCandidateId: source.id,
        } as Prisma.InputJsonValue,
      },
    });

    return { source, target: updatedTarget };
  });
}

export async function applyApprovedCandidateToGraph(
  tx: Prisma.TransactionClient,
  input: Readonly<{ readonly projectId: string; readonly candidateId: string }>,
) {
  const candidate = await tx.projectStructureCandidate.findFirst({
    where: { id: input.candidateId, projectId: input.projectId },
  });
  if (!candidate) throw new Error("CANDIDATE_NOT_FOUND");
  if (candidate.approvedGraphNodeId) {
    const existing = await tx.projectGraphNode.findUnique({ where: { id: candidate.approvedGraphNodeId } });
    if (existing) return existing;
  }

  const projectionKey = `approved-candidate:${candidate.id}:node`;
  const entityKey = `approved:${input.projectId}:${candidate.nodeType}:${candidate.id}`;

  const existingByKey = await tx.projectGraphNode.findFirst({
    where: { projectId: input.projectId, projectionKey },
  });
  if (existingByKey) {
    await tx.projectStructureCandidate.update({
      where: { id: candidate.id },
      data: { approvedGraphNodeId: existingByKey.id },
    });
    return existingByKey;
  }

  try {
    const node = await tx.projectGraphNode.create({
      data: {
        projectId: input.projectId,
        projectionKey,
        entityKey,
        nodeType: candidate.nodeType,
        title: candidate.title,
        summary: candidate.summary,
        metadata: {
          structureCandidateId: candidate.id,
          approved: true,
        } as Prisma.InputJsonValue,
        sourceEventId: candidate.sourceEventId,
      },
    });
    await tx.projectStructureCandidate.update({
      where: { id: candidate.id },
      data: { approvedGraphNodeId: node.id },
    });
    return node;
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const node = await tx.projectGraphNode.findFirst({
        where: { projectId: input.projectId, projectionKey },
      });
      if (node) {
        await tx.projectStructureCandidate.update({
          where: { id: candidate.id },
          data: { approvedGraphNodeId: node.id },
        });
        return node;
      }
    }
    throw error;
  }
}

export async function approveStructureCandidates(input: Readonly<{
  readonly projectId: string;
  readonly candidateIds: readonly string[];
  readonly actorId?: string | null;
}>) {
  const pid = input.projectId;
  const ids = [...new Set(input.candidateIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return { approved: [] as string[] };

  return prisma.$transaction(async (tx) => {
    const approved: string[] = [];
    for (const candidateId of ids) {
      const candidate = await tx.projectStructureCandidate.findFirst({
        where: { id: candidateId, projectId: pid },
      });
      if (!candidate) continue;
      if (
        candidate.lifecycleStatus === STRUCTURE_NODE_LIFECYCLE.APPROVED ||
        candidate.lifecycleStatus === STRUCTURE_NODE_LIFECYCLE.MODIFIED
      ) {
        approved.push(candidateId);
        continue;
      }
      if (candidate.lifecycleStatus !== STRUCTURE_NODE_LIFECYCLE.CANDIDATE) continue;

      await applyApprovedCandidateToGraph(tx, { projectId: pid, candidateId });
      await setCandidateLifecycleStatus(tx, {
        projectId: pid,
        candidateId,
        toStatus: STRUCTURE_NODE_LIFECYCLE.APPROVED,
        actorId: input.actorId,
        reason: "user_approved",
      });
      approved.push(candidateId);
    }
    return { approved };
  });
}

export async function rejectStructureCandidates(input: Readonly<{
  readonly projectId: string;
  readonly candidateIds: readonly string[];
  readonly actorId?: string | null;
  readonly reason?: string | null;
}>) {
  const pid = input.projectId;
  const ids = [...new Set(input.candidateIds.map((id) => String(id).trim()).filter(Boolean))];

  return prisma.$transaction(async (tx) => {
    const rejected: string[] = [];
    for (const candidateId of ids) {
      const candidate = await tx.projectStructureCandidate.findFirst({
        where: { id: candidateId, projectId: pid },
      });
      if (!candidate) continue;
      if (candidate.lifecycleStatus !== STRUCTURE_NODE_LIFECYCLE.CANDIDATE) continue;
      await setCandidateLifecycleStatus(tx, {
        projectId: pid,
        candidateId,
        toStatus: STRUCTURE_NODE_LIFECYCLE.DEPRECATED,
        actorId: input.actorId,
        reason: input.reason ?? "user_rejected",
      });
      rejected.push(candidateId);
    }
    return { rejected };
  });
}

export async function editStructureCandidate(input: Readonly<{
  readonly projectId: string;
  readonly candidateId: string;
  readonly title?: string;
  readonly summary?: string;
  readonly actorId?: string | null;
}>) {
  const candidate = await prisma.projectStructureCandidate.findFirst({
    where: { id: input.candidateId, projectId: input.projectId },
  });
  if (!candidate) throw new Error("CANDIDATE_NOT_FOUND");

  const title = input.title !== undefined ? String(input.title).trim() : candidate.title;
  const summary = input.summary !== undefined ? String(input.summary) : candidate.summary;
  if (!title) throw new Error("TITLE_REQUIRED");

  const updated = await prisma.projectStructureCandidate.update({
    where: { id: candidate.id },
    data: { title, summary },
  });

  if (candidate.lifecycleStatus === STRUCTURE_NODE_LIFECYCLE.APPROVED) {
    await setCandidateLifecycleStatus(prisma, {
      projectId: input.projectId,
      candidateId: candidate.id,
      toStatus: STRUCTURE_NODE_LIFECYCLE.MODIFIED,
      actorId: input.actorId,
      reason: "user_edit_after_approval",
    });
  }

  return updated;
}
