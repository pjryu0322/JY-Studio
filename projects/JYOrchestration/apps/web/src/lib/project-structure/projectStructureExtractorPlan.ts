import { createHash } from "node:crypto";
import {
  planProjectGraphProjectionFromEvent,
  type ProjectGraphEventInput,
} from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { structureCandidateHandlers } from "@/lib/project-structure/projectStructureExtractorRegistry";
import { STRUCTURE_CANDIDATE_NODE_TYPES } from "@/lib/project-structure/projectStructureTypes";

export type StructureCandidateNodeDraft = Readonly<{
  readonly idempotencyKey: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceEventId: string;
  readonly fingerprint: string;
  readonly metadata: Record<string, unknown>;
}>;

export type StructureCandidateEdgeDraft = Readonly<{
  readonly idempotencyKey: string;
  readonly fromIdempotencyKey: string;
  readonly toIdempotencyKey: string;
  readonly edgeType: string;
  readonly sourceEventId: string;
  readonly metadata: Record<string, unknown>;
}>;

export type StructureExtractionPlan = Readonly<{
  readonly nodes: readonly StructureCandidateNodeDraft[];
  readonly edges: readonly StructureCandidateEdgeDraft[];
}>;

export function buildStructureCandidateNodeKey(eventId: string, nodeType: string): string {
  return `structure-candidate:event:${eventId}:node:${nodeType}`;
}

export function buildStructureCandidateEdgeKey(eventId: string, edgeType: string, toFingerprint: string): string {
  return `structure-candidate:event:${eventId}:edge:${edgeType}:${toFingerprint}`;
}

export function fingerprintStructureText(nodeType: string, title: string, summary: string): string {
  const raw = `${nodeType}|${normalizeForFingerprint(title)}|${normalizeForFingerprint(summary)}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export function normalizeForFingerprint(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mapGraphNodeTypeToStructure(nodeType: string): string {
  if (nodeType === "Project") return STRUCTURE_CANDIDATE_NODE_TYPES.IDEA;
  return nodeType;
}

function inferProblemFromRequirement(summary: string): Omit<StructureCandidateNodeDraft, "sourceEventId" | "idempotencyKey"> | null {
  const s = summary.toLowerCase();
  if (!/(problem|pain|issue|문제|불편|과제)/i.test(s)) return null;
  const title = summary.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || "Problem";
  const fp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.PROBLEM, title, summary);
  return {
    nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.PROBLEM,
    title,
    summary,
    fingerprint: fp,
    metadata: { inferred: true },
  };
}

/**
 * Event Store 기반 구조 후보 추출 (Graph Projection 미수정).
 */
export function planStructureCandidatesFromEvent(event: ProjectGraphEventInput): StructureExtractionPlan {
  const registryHandler = structureCandidateHandlers[event.eventType];
  if (registryHandler) {
    const handled = registryHandler(event);
    if (handled) return handled;
  }

  const graphPlan = planProjectGraphProjectionFromEvent(event);
  const nodes: StructureCandidateNodeDraft[] = [];
  const edges: StructureCandidateEdgeDraft[] = [];

  for (const n of graphPlan.nodes) {
    const structureType = mapGraphNodeTypeToStructure(n.nodeType);
    const fp = fingerprintStructureText(structureType, n.title, n.summary);
    nodes.push({
      idempotencyKey: buildStructureCandidateNodeKey(event.id, structureType),
      nodeType: structureType,
      title: n.title,
      summary: n.summary,
      sourceEventId: event.id,
      fingerprint: fp,
      metadata: { ...n.metadata, entityKey: n.entityKey, graphNodeType: n.nodeType },
    });
    if (structureType === STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT) {
      const problem = inferProblemFromRequirement(n.summary);
      if (problem) {
        nodes.push({
          ...problem,
          sourceEventId: event.id,
          idempotencyKey: buildStructureCandidateNodeKey(event.id, STRUCTURE_CANDIDATE_NODE_TYPES.PROBLEM),
          metadata: { ...problem.metadata, relatedRequirementFingerprint: fp },
        });
      }
    }
  }

  for (const e of graphPlan.edges) {
    edges.push({
      idempotencyKey: buildStructureCandidateEdgeKey(event.id, e.edgeType, e.toEntityKey),
      fromIdempotencyKey: `entity:${e.fromEntityKey}`,
      toIdempotencyKey: `entity:${e.toEntityKey}`,
      edgeType: e.edgeType,
      sourceEventId: event.id,
      metadata: e.metadata,
    });
  }

  if (event.eventType === PROJECT_GRAPH_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED) {
    const content = String(event.messageContent ?? "").trim();
    if (/(actor|사용자|역할|admin|관리자)/i.test(content)) {
      const title = "Actor (inferred)";
      const fp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR, title, content);
      nodes.push({
        idempotencyKey: buildStructureCandidateNodeKey(event.id, STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR),
        nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR,
        title,
        summary: content.slice(0, 500),
        sourceEventId: event.id,
        fingerprint: fp,
        metadata: { inferred: true },
      });
    }
  }

  return { nodes, edges };
}

export function planStructureCandidatesFromEvents(events: readonly ProjectGraphEventInput[]): StructureExtractionPlan {
  const nodeMap = new Map<string, StructureCandidateNodeDraft>();
  const edgeMap = new Map<string, StructureCandidateEdgeDraft>();

  for (const event of events) {
    const plan = planStructureCandidatesFromEvent(event);
    for (const n of plan.nodes) nodeMap.set(n.idempotencyKey, n);
    for (const e of plan.edges) edgeMap.set(e.idempotencyKey, e);
  }

  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}
