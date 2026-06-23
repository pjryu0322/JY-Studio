import type { StructureCandidateExplainability } from "@/lib/project-structure/projectStructureExplainability";
import { confidenceLabelFromScore, confidencePercentFromScore } from "@/lib/project-structure/projectStructureExplainability";
import { buildRequirementsConversationHref, truncateConversationExcerpt } from "@/lib/project-structure/projectStructureExplainability";
import { PLANNING_SNAPSHOT_CREATED_BY, PLANNING_SNAPSHOT_EVENT_TYPE } from "@/lib/planning-snapshot/planningSnapshotModel";
import {
  fingerprintStructureText,
  buildStructureCandidateEdgeKey,
  type StructureCandidateEdgeDraft,
  type StructureCandidateNodeDraft,
} from "@/lib/project-structure/projectStructureExtractorPlan";
import { STRUCTURE_CANDIDATE_NODE_TYPES } from "@/lib/project-structure/projectStructureTypes";
import { PROJECT_GRAPH_EDGE_TYPES } from "@/lib/project-graph/projectGraphTypes";

const SNAPSHOT_REASON = "이 노드는 AI 기획자의 초기 기획 정리 결과에서 생성되었습니다.";

function snapshotExplainability(
  projectId: string,
  eventId: string,
  sourceMessageId: string,
): StructureCandidateExplainability {
  const score01 = 0.88;
  return {
    confidence: confidencePercentFromScore(score01),
    confidenceLabel: confidenceLabelFromScore(score01),
    reason: SNAPSHOT_REASON,
    confidenceReason: "AI 기획자 초기 Planning Snapshot에서 구조화된 필드를 근거로 생성했습니다.",
    sourceConversation: {
      excerpt: "AI 기획자 초기 기획 정리 메시지",
      messageId: sourceMessageId,
      href: buildRequirementsConversationHref(projectId, sourceMessageId),
    },
    sourceEvent: {
      eventType: PLANNING_SNAPSHOT_EVENT_TYPE,
      eventId,
    },
    createdBy: PLANNING_SNAPSHOT_CREATED_BY,
    createdFrom: {
      eventId,
      messageId: sourceMessageId,
    },
  };
}

function nodeKey(eventId: string, nodeType: string, fingerprint: string): string {
  return `structure-candidate:event:${eventId}:node:${nodeType}:${fingerprint}`;
}

export function planStructureCandidatesFromPlanningSnapshot(
  eventId: string,
  snapshot: PlanningSnapshotModel,
): { readonly nodes: StructureCandidateNodeDraft[]; readonly edges: StructureCandidateEdgeDraft[] } {
  const nodes: StructureCandidateNodeDraft[] = [];
  const edges: StructureCandidateEdgeDraft[] = [];
  const explainability = snapshotExplainability(snapshot.projectId, eventId, snapshot.sourceMessageId);
  const ideaFp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.IDEA, snapshot.productName, snapshot.summary);

  nodes.push({
    idempotencyKey: nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.IDEA, ideaFp),
    nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.IDEA,
    title: snapshot.productName,
    summary: snapshot.summary,
    sourceEventId: eventId,
    fingerprint: ideaFp,
    metadata: {
      planningSnapshot: true,
      sourceMessageId: snapshot.sourceMessageId,
      explainability,
    },
  });

  for (const problem of snapshot.problems) {
    const title = problem.slice(0, 120) || "Problem";
    const fp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.PROBLEM, title, problem);
    nodes.push({
      idempotencyKey: nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.PROBLEM, fp),
      nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.PROBLEM,
      title,
      summary: problem,
      sourceEventId: eventId,
      fingerprint: fp,
      metadata: {
        planningSnapshot: true,
        sourceMessageId: snapshot.sourceMessageId,
        explainability,
      },
    });
  }

  for (const actorTitle of snapshot.actors) {
    const title = actorTitle.slice(0, 120) || "Actor";
    const fp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR, title, actorTitle);
    nodes.push({
      idempotencyKey: nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR, fp),
      nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR,
      title,
      summary: actorTitle,
      sourceEventId: eventId,
      fingerprint: fp,
      metadata: {
        planningSnapshot: true,
        sourceMessageId: snapshot.sourceMessageId,
        explainability,
      },
    });
  }

  for (const featureTitle of snapshot.features) {
    const title = featureTitle.slice(0, 120) || "Feature";
    const fp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE, title, featureTitle);
    nodes.push({
      idempotencyKey: nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE, fp),
      nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE,
      title,
      summary: featureTitle,
      sourceEventId: eventId,
      fingerprint: fp,
      metadata: {
        planningSnapshot: true,
        sourceMessageId: snapshot.sourceMessageId,
        explainability,
      },
    });
    const reqTitle = `요구: ${title}`.slice(0, 120);
    const reqFp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, reqTitle, featureTitle);
    nodes.push({
      idempotencyKey: nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, reqFp),
      nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT,
      title: reqTitle,
      summary: featureTitle,
      sourceEventId: eventId,
      fingerprint: reqFp,
      metadata: {
        planningSnapshot: true,
        sourceMessageId: snapshot.sourceMessageId,
        explainability,
        relatedFeatureFingerprint: fp,
      },
    });
  }

  const ideaEntity = `entity:idea:${snapshot.projectId}:Idea`;
  for (const n of nodes) {
    if (n.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.IDEA) continue;
    edges.push({
      idempotencyKey: buildStructureCandidateEdgeKey(
        eventId,
        PROJECT_GRAPH_EDGE_TYPES.RELATED_TO,
        n.fingerprint,
      ),
      fromIdempotencyKey: nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.IDEA, ideaFp),
      toIdempotencyKey: n.idempotencyKey,
      edgeType: PROJECT_GRAPH_EDGE_TYPES.RELATED_TO,
      sourceEventId: eventId,
      metadata: { planningSnapshot: true },
    });
    void ideaEntity;
  }

  return { nodes, edges };
}

export function parsePlanningSnapshotFromEventPayload(
  projectId: string,
  payload: unknown,
  sourceMessageId: string | null | undefined,
): PlanningSnapshotModel | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const readList = (key: string): string[] => {
    const v = p[key];
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x).trim()).filter(Boolean);
  };
  const scopeRaw = p.scope;
  let included: string[] = [];
  let excluded: string[] = [];
  if (scopeRaw && typeof scopeRaw === "object" && !Array.isArray(scopeRaw)) {
    const s = scopeRaw as Record<string, unknown>;
    included = Array.isArray(s.included) ? s.included.map((x) => String(x).trim()).filter(Boolean) : [];
    excluded = Array.isArray(s.excluded) ? s.excluded.map((x) => String(x).trim()).filter(Boolean) : [];
  }
  const sid = String(p.sourceMessageId ?? sourceMessageId ?? "").trim();
  if (!sid) return null;
  return {
    projectId: String(p.projectId ?? projectId).trim(),
    productName: String(p.productName ?? "").trim() || "프로젝트",
    summary: String(p.summary ?? "").trim(),
    problems: readList("problems"),
    actors: readList("actors"),
    features: readList("features"),
    scope: { included, excluded },
    successCriteria: readList("successCriteria"),
    sourceMessageId: sid,
    createdBy: String(p.createdBy ?? PLANNING_SNAPSHOT_CREATED_BY).trim() || PLANNING_SNAPSHOT_CREATED_BY,
  };
}
