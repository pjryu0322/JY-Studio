import type { StructureExplainability } from "@/lib/project-structure/structureExplainabilityModel";
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
import { assessKnowledgeNodeSensitivity } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

export type KnowledgeReferenceNodeInput = Readonly<{
  readonly nodeType: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly lifecycleStatus?: string | null;
  readonly projectionKey?: string | null;
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
  sensitivity: ReturnType<typeof assessKnowledgeNodeSensitivity>,
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
  const lifecycle = normalizeKnowledgeNodeLifecycle(input);
  const provenance = inferKnowledgeNodeProvenance(input, lifecycle);
  const excerpt = input.explainability?.sourceConversation?.excerpt ?? "";
  const sensitivity = assessKnowledgeNodeSensitivity({
    title: input.title,
    summary: input.summary,
    containsConversationExcerpt: excerpt.length > 80,
    containsPersonalMemo: /메모|personal|private/i.test(`${input.title} ${input.summary ?? ""}`),
  });
  const reusability = computeKnowledgeNodeReusability(lifecycle, sensitivity, input.nodeType);

  let verificationLabel = "검증 대기";
  if (lifecycle === "VERIFIED" || lifecycle === "REFERENCE_READY") {
    verificationLabel = "검증 완료";
  } else if (lifecycle === "USER_APPROVED") {
    verificationLabel = "승인 완료";
  }

  return {
    lifecycleLabel: knowledgeNodeLifecycleUserLabel(lifecycle),
    provenanceLabel: knowledgeProvenanceUserLabel(provenance.createdFrom),
    reusableLabel: reusability.reusable ? "참조 사용 가능" : "참조 사용 불가",
    verificationLabel,
  };
}

export function toReferenceEligibilityNodeInput(
  node: KnowledgeReferenceNodeInput,
): Readonly<{
  lifecycle: KnowledgeNodeLifecycle;
  nodeType: string;
  title: string;
  summary: string | null;
  reusable: boolean;
  safeForReference: boolean;
}> {
  const lifecycle = normalizeKnowledgeNodeLifecycle(node);
  const sensitivity = assessKnowledgeNodeSensitivity({
    title: node.title,
    summary: node.summary,
    containsConversationExcerpt: Boolean(node.explainability?.sourceConversation?.excerpt),
  });
  const reusability = computeKnowledgeNodeReusability(lifecycle, sensitivity, node.nodeType);
  return {
    lifecycle,
    nodeType: node.nodeType,
    title: node.title,
    summary: node.summary ?? null,
    reusable: reusability.reusable,
    safeForReference: sensitivity.safeForReference,
  };
}
