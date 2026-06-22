import { prisma } from "@/lib/prisma";
import { detectStructureConflicts } from "@/lib/project-structure/projectStructureConflicts";
import { extractStructureCandidatesFromEventStore } from "@/lib/project-structure/projectStructureExtractor";

export async function listStructureCandidates(
  projectId: string,
  input?: Readonly<{ readonly lifecycleStatus?: string; readonly syncFromEvents?: boolean }>,
) {
  const pid = String(projectId).trim();
  let syncStats = null;
  if (input?.syncFromEvents) {
    syncStats = await extractStructureCandidatesFromEventStore(pid);
  }

  const lifecycleStatus = input?.lifecycleStatus?.trim();
  const candidates = await prisma.projectStructureCandidate.findMany({
    where: {
      projectId: pid,
      ...(lifecycleStatus ? { lifecycleStatus } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  const edges = await prisma.projectStructureCandidateEdge.findMany({
    where: { projectId: pid },
    orderBy: { createdAt: "asc" },
  });

  return { candidates, edges, syncStats };
}

export async function listStructureConflicts(projectId: string) {
  const pid = String(projectId).trim();
  const candidates = await prisma.projectStructureCandidate.findMany({
    where: { projectId: pid },
  });
  const conflicts = detectStructureConflicts(candidates);
  return { conflicts, candidateCount: candidates.length };
}
