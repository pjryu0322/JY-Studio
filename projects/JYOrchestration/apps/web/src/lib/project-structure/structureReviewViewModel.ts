import type { GraphReflectionStatus, StructureConflictRow, StructureCandidateRow } from "@/lib/project-structure/structureReviewUiTypes";

export function resolveGraphReflectionStatus(
  candidate: Pick<StructureCandidateRow, "lifecycleStatus" | "approvedGraphNodeId">,
): GraphReflectionStatus {
  const lifecycle = String(candidate.lifecycleStatus ?? "").trim();
  const hasGraph = Boolean(String(candidate.approvedGraphNodeId ?? "").trim());
  if (lifecycle === "APPROVED" || lifecycle === "MODIFIED") {
    return hasGraph ? "graph_applied" : "approved_pending_graph";
  }
  return "not_reflected";
}

export function graphReflectionStatusLabel(status: GraphReflectionStatus): string {
  switch (status) {
    case "graph_applied":
      return "Graph 반영 완료";
    case "approved_pending_graph":
      return "승인됨";
    default:
      return "미반영";
  }
}

export function filterStructureCandidates(
  candidates: readonly StructureCandidateRow[],
  input: Readonly<{ readonly lifecycle?: string; readonly nodeType?: string; readonly search?: string }>,
): StructureCandidateRow[] {
  const lifecycle = input.lifecycle?.trim();
  const nodeType = input.nodeType?.trim();
  const q = input.search?.trim().toLowerCase() ?? "";
  return candidates.filter((c) => {
    if (lifecycle && c.lifecycleStatus !== lifecycle) return false;
    if (nodeType && c.nodeType !== nodeType) return false;
    if (q) {
      const hay = `${c.title} ${c.summary} ${c.nodeType}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function groupStructureConflicts(conflicts: readonly StructureConflictRow[]): Map<string, StructureConflictRow[]> {
  const map = new Map<string, StructureConflictRow[]>();
  for (const c of conflicts) {
    const list = map.get(c.kind) ?? [];
    list.push(c);
    map.set(c.kind, list);
  }
  return map;
}

export function conflictsForCandidate(
  candidateId: string,
  conflicts: readonly StructureConflictRow[],
): StructureConflictRow[] {
  return conflicts.filter((c) => c.candidateIds.includes(candidateId));
}

export function candidateCanMerge(candidateId: string, conflicts: readonly StructureConflictRow[]): boolean {
  return conflictsForCandidate(candidateId, conflicts).length > 0;
}

export function pickDefaultMergeTargetId(
  candidateId: string,
  conflicts: readonly StructureConflictRow[],
): string | null {
  for (const c of conflicts) {
    if (!c.candidateIds.includes(candidateId)) continue;
    const other = c.candidateIds.find((id) => id !== candidateId);
    if (other) return other;
  }
  return null;
}

export function uniqueNodeTypes(candidates: readonly StructureCandidateRow[]): string[] {
  return [...new Set(candidates.map((c) => c.nodeType).filter(Boolean))].sort();
}
