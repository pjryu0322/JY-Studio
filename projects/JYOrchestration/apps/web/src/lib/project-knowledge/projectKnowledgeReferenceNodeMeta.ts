import type { StructureExplainability } from "@/lib/project-structure/structureExplainabilityModel";
import {
  buildFallbackProjectGraphNodeReferenceMetadata,
  buildProjectGraphNodeReferenceViewFromMetadata,
  parseProjectGraphNodeReferenceMetadata,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMetadata";
import {
  knowledgeNodeLifecycleUserLabel,
  normalizeKnowledgeNodeLifecycle,
} from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import type {
  KnowledgeNodeLifecycle,
  KnowledgeNodeProvenance,
  KnowledgeNodeProvenanceSource,
  KnowledgeNodeReferenceView,
  KnowledgeNodeReusableAs,
  KnowledgeNodeReusability,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import { assessReferenceSafety } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

export type KnowledgeReferenceNodeInput = Readonly<{
  readonly nodeType: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly lifecycleStatus?: string | null;
  readonly projectionKey?: string | null;
  readonly metadata?: unknown;
  readonly sourceEventId?: string | null;
  readonly explainability?: StructureExplainability | null;
}>;

export function inferKnowledgeNodeProvenance(
  input: KnowledgeReferenceNodeInput,
  lifecycle: KnowledgeNodeLifecycle,
): KnowledgeNodeProvenance {
  const excerpt = input.explainability?.sourceConversation?.excerpt ?? "";
  const hasConversation = Boolean(
    input.explainability?.sourceConversation?.href || excerpt.length > 20,
  );

  let createdFrom: KnowledgeNodeProvenanceSource = "SYSTEM_DERIVED";
  if (lifecycle === "USER_APPROVED" || lifecycle === "VERIFIED" || lifecycle === "REFERENCE_READY") {
    createdFrom = "USER_APPROVAL";
  } else if (lifecycle === "AI_PROPOSED") {
    createdFrom = "AI_PROPOSAL";
  } else if (hasConversation) {
    createdFrom = "CONVERSATION";
  }

  return {
    createdFrom,
    ...(input.explainability?.createdFrom?.eventId
      ? { sourceEventIds: [input.explainability.createdFrom.eventId] }
      : {}),
  };
}

export function knowledgeProvenanceUserLabel(source: KnowledgeNodeProvenanceSource): string {
  switch (source) {
    case "CONVERSATION":
      return "대화에서 도출됨";
    case "AI_PROPOSAL":
      return "AI가 제안함";
    case "USER_APPROVAL":
      return "사용자가 승인함";
    case "SOURCE_MATERIAL":
      return "자료에서 도출됨";
    case "IMPORT":
      return "가져온 항목";
    default:
      return "시스템에서 생성됨";
  }
}

function reusableAsForNodeType(nodeType: string): KnowledgeNodeReusableAs[] {
  const t = nodeType.trim();
  if (/actor/i.test(t)) return ["ACTOR"];
  if (/flow/i.test(t)) return ["SERVICE_FLOW"];
  if (/feature/i.test(t)) return ["FEATURE"];
  if (/decision/i.test(t)) return ["DECISION"];
  if (/constraint/i.test(t)) return ["CONSTRAINT"];
  if (/project|idea|problem/i.test(t)) return ["PLANNING_CONTEXT", "GRAPH_SUMMARY"];
  return ["GRAPH_SUMMARY"];
}

export function computeKnowledgeNodeReusability(
  lifecycle: KnowledgeNodeLifecycle,
  sensitivity: ReturnType<typeof assessReferenceSafety>,
  nodeType: string,
): KnowledgeNodeReusability {
  const approvedLike =
    lifecycle === "USER_APPROVED" ||
    lifecycle === "VERIFIED" ||
    lifecycle === "REFERENCE_READY";

  if (!approvedLike || !sensitivity.safeForReference) {
    return {
      reusable: false,
      reusableAs: [],
      exclusionReason: !sensitivity.safeForReference
        ? "민감 정보 또는 원문이 포함될 수 있어 참조에서 제외됩니다."
        : "승인되지 않았거나 사용 종료된 항목입니다.",
    };
  }

  return {
    reusable: true,
    reusableAs: reusableAsForNodeType(nodeType),
  };
}

export function buildKnowledgeNodeReferenceView(input: KnowledgeReferenceNodeInput): KnowledgeNodeReferenceView {
  const stored = parseProjectGraphNodeReferenceMetadata(input.metadata);
  const excerpt = input.explainability?.sourceConversation?.excerpt ?? "";
  const meta =
    stored ??
    buildFallbackProjectGraphNodeReferenceMetadata({
      nodeType: input.nodeType,
      title: input.title,
      summary: input.summary,
      lifecycleStatus: input.lifecycleStatus,
      projectionKey: input.projectionKey,
      sourceEventId: input.sourceEventId ?? input.explainability?.createdFrom?.eventId ?? null,
      containsConversationExcerpt: excerpt.length > 80,
    });
  return buildProjectGraphNodeReferenceViewFromMetadata(meta);
}

export function toReferenceEligibilityNodeInput(
  node: KnowledgeReferenceNodeInput,
): Readonly<{
  lifecycle: KnowledgeNodeLifecycle;
  nodeType: string;
  title: string;
  summary: string | null;
  reusable: boolean;
  reusableAs: readonly KnowledgeNodeReusableAs[];
  safeForReference: boolean;
}> {
  const stored = parseProjectGraphNodeReferenceMetadata(node.metadata);
  if (stored) {
    return {
      lifecycle: stored.lifecycle,
      nodeType: node.nodeType,
      title: node.title,
      summary: node.summary ?? null,
      reusable: stored.reusable,
      reusableAs: [...stored.reusableAs],
      safeForReference: stored.sensitivity.safeForReference,
    };
  }

  const lifecycle = normalizeKnowledgeNodeLifecycle(node);
  const excerpt = node.explainability?.sourceConversation?.excerpt ?? "";
  const sensitivity = assessReferenceSafety({
    title: node.title,
    summary: node.summary,
    containsConversationExcerpt: excerpt.length > 80,
    containsPersonalMemo: /메모|personal|private/i.test(`${node.title} ${node.summary ?? ""}`),
  });
  const reusability = computeKnowledgeNodeReusability(lifecycle, sensitivity, node.nodeType);
  return {
    lifecycle,
    nodeType: node.nodeType,
    title: node.title,
    summary: node.summary ?? null,
    reusable: reusability.reusable,
    reusableAs: [...reusability.reusableAs],
    safeForReference: sensitivity.safeForReference,
  };
}

// Re-export for tests
export { knowledgeNodeLifecycleUserLabel };
