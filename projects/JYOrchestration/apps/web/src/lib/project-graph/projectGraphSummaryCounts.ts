import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";

export type ProjectGraphSummaryCounts = Readonly<{
  readonly nodes: number;
  readonly edges: number;
  readonly requirements: number;
  readonly features: number;
  readonly actors: number;
}>;

export function computeProjectGraphSummaryCounts(
  nodes: readonly ProjectGraphNodeDto[],
  edges: readonly ProjectGraphEdgeDto[],
): ProjectGraphSummaryCounts {
  let requirements = 0;
  let features = 0;
  let actors = 0;
  for (const n of nodes) {
    const type = n.nodeType;
    if (type === "Requirement") requirements += 1;
    else if (type === "Feature") features += 1;
    else if (type === "Actor" || type === "User" || type === "Participant") actors += 1;
  }
  return {
    nodes: nodes.length,
    edges: edges.length,
    requirements,
    features,
    actors,
  };
}
