import {
  knowledgeNodeLifecycleUserLabel,
  normalizeKnowledgeNodeLifecycle,
} from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import type {
  KnowledgeNodeLifecycle,
  KnowledgeNodeProvenanceSource,
  KnowledgeNodeReusableAs,
  KnowledgeNodeSensitivity,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import { assessReferenceSafety } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

export type ProjectGraphNodeReferenceMetadata = Readonly<{
  readonly lifecycle: KnowledgeNodeLifecycle;
  readonly provenance: Readonly<{
    readonly createdFrom: KnowledgeNodeProvenanceSource;
    readonly sourceEventIds?: readonly string[];
    readonly sourceCandidateIds?: readonly string[];
  }>;
  readonly reusable: boolean;
  readonly reusableAs: readonly KnowledgeNodeReusableAs[];
  readonly sensitivity: KnowledgeNodeSensitivity;
}>;

function readMetaRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function parseLifecycle(raw: unknown): KnowledgeNodeLifecycle | null {
  const value = String(raw ?? "").trim().toUpperCase();
  if (
    value === "DRAFT" ||
    value === "AI_PROPOSED" ||
    value === "USER_APPROVED" ||
    value === "VERIFIED" ||
    value === "REFERENCE_READY" ||
    value === "RETIRED"
  ) {
    return value;
  }
  return null;
}

function parseProvenanceSource(raw: unknown): KnowledgeNodeProvenanceSource {
  const value = String(raw ?? "").trim().toUpperCase();
  if (
    value === "CONVERSATION" ||
    value === "AI_PROPOSAL" ||
    value === "USER_APPROVAL" ||
    value === "SOURCE_MATERIAL" ||
    value === "IMPORT" ||
    value === "SYSTEM_DERIVED"
  ) {
    return value;
  }
  return "SYSTEM_DERIVED";
}

function parseReusableAs(raw: unknown): KnowledgeNodeReusableAs[] {
  if (!Array.isArray(raw)) return [];
  const out: KnowledgeNodeReusableAs[] = [];
  for (const item of raw) {
    const v = String(item ?? "").trim().toUpperCase();
    if (
      v === "PLANNING_CONTEXT" ||
      v === "ACTOR" ||
      v === "SERVICE_FLOW" ||
      v === "FEATURE" ||
      v === "CONSTRAINT" ||
      v === "DECISION" ||
      v === "GRAPH_SUMMARY"
    ) {
      out.push(v);
    }
  }
  return out;
}

export function parseProjectGraphNodeReferenceMetadata(
  metadata: unknown,
): ProjectGraphNodeReferenceMetadata | null {
  const root = readMetaRecord(metadata);
  if (!root) return null;
  const ref = readMetaRecord(root.reference);
  if (!ref) return null;

  const lifecycle = parseLifecycle(ref.lifecycle);
  if (!lifecycle) return null;

  const provenanceRaw = readMetaRecord(ref.provenance);
  const sensitivityRaw = readMetaRecord(ref.sensitivity);
  const sensitivity: KnowledgeNodeSensitivity = sensitivityRaw
    ? {
        containsPersonalData: Boolean(sensitivityRaw.containsPersonalData),
        containsConfidentialData: Boolean(sensitivityRaw.containsConfidentialData),
        containsRawConversation: Boolean(sensitivityRaw.containsRawConversation),
        containsInternalIds: Boolean(sensitivityRaw.containsInternalIds),
        safeForReference: Boolean(sensitivityRaw.safeForReference),
      }
    : assessReferenceSafety({ title: "", summary: null });

  return {
    lifecycle,
    provenance: {
      createdFrom: parseProvenanceSource(provenanceRaw?.createdFrom),
      ...(Array.isArray(provenanceRaw?.sourceEventIds)
        ? { sourceEventIds: provenanceRaw.sourceEventIds.map(String) }
        : {}),
      ...(Array.isArray(provenanceRaw?.sourceCandidateIds)
        ? { sourceCandidateIds: provenanceRaw.sourceCandidateIds.map(String) }
        : {}),
    },
    reusable: Boolean(ref.reusable),
    reusableAs: parseReusableAs(ref.reusableAs),
    sensitivity,
  };
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

export type BuildFallbackReferenceMetadataInput = Readonly<{
  readonly nodeType: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly lifecycleStatus?: string | null;
  readonly projectionKey?: string | null;
  readonly sourceEventId?: string | null;
  readonly structureCandidateId?: string | null;
  readonly containsConversationExcerpt?: boolean;
}>;

export function buildFallbackProjectGraphNodeReferenceMetadata(
  input: BuildFallbackReferenceMetadataInput,
): ProjectGraphNodeReferenceMetadata {
  const lifecycle = normalizeKnowledgeNodeLifecycle(input);
  const sensitivity = assessReferenceSafety({
    title: input.title,
    summary: input.summary,
    containsConversationExcerpt: Boolean(input.containsConversationExcerpt),
    containsPersonalMemo: /메모|personal|private/i.test(`${input.title} ${input.summary ?? ""}`),
  });

  const approvedLike =
    lifecycle === "USER_APPROVED" || lifecycle === "VERIFIED" || lifecycle === "REFERENCE_READY";
  const reusable = approvedLike && sensitivity.safeForReference;
  const reusableAs = reusable ? reusableAsForNodeType(input.nodeType) : [];

  let createdFrom: KnowledgeNodeProvenanceSource = "SYSTEM_DERIVED";
  if (approvedLike) createdFrom = "USER_APPROVAL";
  else if (lifecycle === "AI_PROPOSED") createdFrom = "AI_PROPOSAL";

  return {
    lifecycle,
    provenance: {
      createdFrom,
      ...(input.sourceEventId?.trim() ? { sourceEventIds: [input.sourceEventId.trim()] } : {}),
      ...(input.structureCandidateId?.trim()
        ? { sourceCandidateIds: [input.structureCandidateId.trim()] }
        : {}),
    },
    reusable,
    reusableAs,
    sensitivity,
  };
}

export function serializeProjectGraphNodeReferenceMetadata(
  meta: ProjectGraphNodeReferenceMetadata,
): Record<string, unknown> {
  return {
    lifecycle: meta.lifecycle,
    provenance: {
      createdFrom: meta.provenance.createdFrom,
      ...(meta.provenance.sourceEventIds?.length
        ? { sourceEventIds: [...meta.provenance.sourceEventIds] }
        : {}),
      ...(meta.provenance.sourceCandidateIds?.length
        ? { sourceCandidateIds: [...meta.provenance.sourceCandidateIds] }
        : {}),
    },
    reusable: meta.reusable,
    reusableAs: [...meta.reusableAs],
    sensitivity: { ...meta.sensitivity },
  };
}

export function mergeGraphNodeMetadataWithReference(
  metadata: Record<string, unknown>,
  input: BuildFallbackReferenceMetadataInput,
): Record<string, unknown> {
  const reference = serializeProjectGraphNodeReferenceMetadata(
    buildFallbackProjectGraphNodeReferenceMetadata(input),
  );
  return { ...metadata, reference };
}

export function provenanceUserLabelFromMetadata(source: KnowledgeNodeProvenanceSource): string {
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

export function buildProjectGraphNodeReferenceViewFromMetadata(
  meta: ProjectGraphNodeReferenceMetadata,
): import("@/lib/project-knowledge/projectKnowledgeReferenceTypes").KnowledgeNodeReferenceView {
  let verificationLabel = "검증 대기";
  if (meta.lifecycle === "VERIFIED" || meta.lifecycle === "REFERENCE_READY") {
    verificationLabel = "검증 완료";
  } else if (meta.lifecycle === "USER_APPROVED") {
    verificationLabel = "승인 완료";
  }

  const reusable = meta.reusable && meta.sensitivity.safeForReference;

  return {
    lifecycleLabel: knowledgeNodeLifecycleUserLabel(meta.lifecycle),
    provenanceLabel: provenanceUserLabelFromMetadata(meta.provenance.createdFrom),
    reusable,
    reusableLabel: reusable ? "참조 사용 가능" : "참조 사용 불가",
    verificationLabel,
  };
}
