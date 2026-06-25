import type {
  GraphSnapshotPurpose,
  KnowledgeNodeLifecycle,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

export function normalizeGraphSnapshotPurpose(raw: unknown): GraphSnapshotPurpose {
  const value = String(raw ?? "").trim().toUpperCase();
  switch (value) {
    case "REPLAY":
    case "TRACE":
    case "APPROVAL":
    case "REFERENCE_CANDIDATE":
    case "REFERENCE_PACKAGE":
      return value;
    default:
      return "REPLAY";
  }
}

export function graphSnapshotPurposeFromMilestone(
  milestone: string,
): GraphSnapshotPurpose {
  if (milestone === "proposal_approval" || milestone === "graph_projection") {
    return "REFERENCE_CANDIDATE";
  }
  return "REPLAY";
}

export function normalizeKnowledgeNodeLifecycle(input: Readonly<{
  readonly lifecycle?: KnowledgeNodeLifecycle | string | null;
  readonly lifecycleStatus?: string | null;
  readonly projectionKey?: string | null;
}>): KnowledgeNodeLifecycle {
  const explicit = String(input.lifecycle ?? "").trim().toUpperCase();
  if (
    explicit === "DRAFT" ||
    explicit === "AI_PROPOSED" ||
    explicit === "USER_APPROVED" ||
    explicit === "VERIFIED" ||
    explicit === "REFERENCE_READY" ||
    explicit === "RETIRED"
  ) {
    return explicit;
  }

  const status = String(input.lifecycleStatus ?? "").trim().toUpperCase();
  if (status === "CANDIDATE") return "AI_PROPOSED";
  if (status === "APPROVED" || status === "PROJECTED") return "USER_APPROVED";
  if (String(input.projectionKey ?? "").startsWith("approved-candidate:")) {
    return "USER_APPROVED";
  }
  return "DRAFT";
}

export function knowledgeNodeLifecycleUserLabel(lifecycle: KnowledgeNodeLifecycle): string {
  switch (lifecycle) {
    case "AI_PROPOSED":
      return "AI 제안";
    case "USER_APPROVED":
      return "사용자 승인됨";
    case "VERIFIED":
      return "검증 완료";
    case "REFERENCE_READY":
      return "참조 가능";
    case "RETIRED":
      return "사용 종료";
    case "DRAFT":
    default:
      return "작성 중";
  }
}
