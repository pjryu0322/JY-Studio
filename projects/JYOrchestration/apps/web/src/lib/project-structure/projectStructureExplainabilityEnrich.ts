import { enrichStructureCandidatesWithExplainabilityService } from "@/lib/project-structure/projectStructureExplainabilityService";

export async function enrichStructureCandidatesWithExplainability(
  projectId: string,
  candidates: readonly import("@prisma/client").ProjectStructureCandidate[],
) {
  return enrichStructureCandidatesWithExplainabilityService(projectId, candidates);
}
