import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";

export const REPLAY_GRAPH_TRANSITION_MS = 150;

export type ReplayGraphFrame = Readonly<{
  readonly frameKey: string;
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
}>;

export function buildReplayGraphFrameKey(
  frameKey: string | undefined,
  nodes: readonly ProjectGraphNodeDto[],
  edges: readonly ProjectGraphEdgeDto[],
): string {
  const explicit = String(frameKey ?? "").trim();
  if (explicit) return explicit;
  return `${nodes.map((n) => n.id).join("|")}::${edges.map((e) => e.id).join("|")}`;
}

export function createReplayGraphFrame(input: Readonly<{
  readonly frameKey?: string;
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
}>): ReplayGraphFrame {
  return {
    frameKey: buildReplayGraphFrameKey(input.frameKey, input.nodes, input.edges),
    nodes: input.nodes,
    edges: input.edges,
  };
}
