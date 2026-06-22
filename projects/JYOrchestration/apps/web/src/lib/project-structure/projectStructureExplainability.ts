export type StructureConfidenceLabel = "High" | "Medium" | "Low";

export type StructureCandidateSourceConversation = Readonly<{
  readonly excerpt: string;
  readonly messageId: string | null;
  readonly href: string | null;
}>;

export type StructureCandidateSourceEventInfo = Readonly<{
  readonly eventType: string;
  readonly eventId: string | null;
}>;

export type StructureCandidateCreatedFrom = Readonly<{
  readonly eventId: string | null;
  readonly messageId: string | null;
}>;

export type StructureCandidateExplainability = Readonly<{
  readonly confidence: number;
  readonly confidenceLabel: StructureConfidenceLabel;
  readonly reason: string;
  readonly sourceConversation: StructureCandidateSourceConversation;
  readonly sourceEvent: StructureCandidateSourceEventInfo;
  readonly createdBy: string;
  readonly createdFrom: StructureCandidateCreatedFrom;
}>;

export const STRUCTURE_EXPLAINABILITY_CREATED_BY = "AI Structure Engine";

export function buildRequirementsConversationHref(
  projectId: string,
  messageId: string | null | undefined,
): string | null {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;
  const base = `/requirements?projectId=${encodeURIComponent(pid)}`;
  const mid = String(messageId ?? "").trim();
  if (!mid) return base;
  return `${base}&sourceMessageId=${encodeURIComponent(mid)}`;
}

export function truncateConversationExcerpt(text: string, maxLen = 280): string {
  const s = String(text ?? "").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

export function confidenceLabelFromScore(score01: number): StructureConfidenceLabel {
  const pct = score01 * 100;
  if (pct >= 80) return "High";
  if (pct >= 55) return "Medium";
  return "Low";
}

export function confidencePercentFromScore(score01: number): number {
  return Math.max(0, Math.min(100, Math.round(score01 * 100)));
}

function readMetaBool(meta: unknown, key: string): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
  return Boolean((meta as Record<string, unknown>)[key]);
}

function readMetaString(meta: unknown, key: string): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  return String((meta as Record<string, unknown>)[key] ?? "").trim();
}

function readStoredExplainability(meta: unknown): StructureCandidateExplainability | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const raw = (meta as Record<string, unknown>).explainability;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  const label = String(e.confidenceLabel ?? "");
  if (label !== "High" && label !== "Medium" && label !== "Low") return null;
  return {
    confidence: Number(e.confidence ?? 0),
    confidenceLabel: label,
    reason: String(e.reason ?? ""),
    sourceConversation: (e.sourceConversation as StructureCandidateSourceConversation) ?? {
      excerpt: "",
      messageId: null,
      href: null,
    },
    sourceEvent: (e.sourceEvent as StructureCandidateSourceEventInfo) ?? {
      eventType: "",
      eventId: null,
    },
    createdBy: String(e.createdBy ?? STRUCTURE_EXPLAINABILITY_CREATED_BY),
    createdFrom: (e.createdFrom as StructureCandidateCreatedFrom) ?? { eventId: null, messageId: null },
  };
}

export type ExplainabilityBuildInput = Readonly<{
  readonly projectId: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly metadata: unknown;
  readonly sourceEventId: string | null;
  readonly eventType: string | null;
  readonly messageContent: string | null;
  readonly sourceMessageId: string | null;
}>;

export function buildStructureCandidateExplainability(
  input: ExplainabilityBuildInput,
): StructureCandidateExplainability {
  const stored = readStoredExplainability(input.metadata);
  if (stored) return stored;

  const inferred = readMetaBool(input.metadata, "inferred");
  const messageId =
    input.sourceMessageId ||
    readMetaString(input.metadata, "sourceMessageId") ||
    null;
  const conversationText = String(input.messageContent ?? input.summary ?? "").trim();
  const excerpt = truncateConversationExcerpt(conversationText || input.title);
  const href = buildRequirementsConversationHref(input.projectId, messageId);

  const eventType = String(input.eventType ?? readMetaString(input.metadata, "eventType") ?? "").trim();

  let score01 = 0.5;
  if (conversationText.length >= 40) score01 += 0.2;
  if (messageId) score01 += 0.15;
  if (eventType && !inferred) score01 += 0.1;
  if (inferred) score01 -= 0.2;
  if (!conversationText && !input.summary) score01 -= 0.15;
  score01 = Math.max(0.15, Math.min(0.98, score01));

  const reason = buildExplainabilityReason({
    nodeType: input.nodeType,
    eventType,
    inferred,
    hasConversation: Boolean(conversationText),
  });

  const confidence = confidencePercentFromScore(score01);

  return {
    confidence,
    confidenceLabel: confidenceLabelFromScore(score01),
    reason,
    sourceConversation: {
      excerpt: excerpt ? `"${excerpt}"` : "—",
      messageId,
      href,
    },
    sourceEvent: {
      eventType: eventType || "unknown",
      eventId: input.sourceEventId,
    },
    createdBy: STRUCTURE_EXPLAINABILITY_CREATED_BY,
    createdFrom: {
      eventId: input.sourceEventId,
      messageId,
    },
  };
}

function buildExplainabilityReason(input: Readonly<{
  nodeType: string;
  eventType: string;
  inferred: boolean;
  hasConversation: boolean;
}>): string {
  const nt = input.nodeType;
  if (nt === "Requirement" && input.eventType === "conversation.message_created") {
    return "사용자가 요구사항 대화에서 Needs/요구를 표현하여 Requirement 후보를 생성했습니다.";
  }
  if (nt === "Idea" && input.eventType === "project.created") {
    return "프로젝트 생성 시 입력된 이름·설명을 바탕으로 Idea 후보를 생성했습니다.";
  }
  if (nt === "Idea" && input.eventType === "idea.created") {
    return "프로젝트 아이디어 설명이 Event Store에 기록되어 Idea 후보를 생성했습니다.";
  }
  if (nt === "Problem" && input.inferred) {
    return "대화에서 문제·과제·불편 표현이 감지되어 Problem 후보를 생성했습니다.";
  }
  if (nt === "Actor" && input.inferred) {
    return "대화에서 역할·사용자·관리자 등 액터 관련 표현이 감지되어 Actor 후보를 생성했습니다.";
  }
  if (input.hasConversation) {
    return `관련 대화 내용과 ${input.eventType || "이벤트"}를 근거로 ${nt} 후보를 생성했습니다.`;
  }
  return `Event Store의 ${input.eventType || "이벤트"}를 근거로 ${nt} 후보를 생성했습니다.`;
}

export function mergeExplainabilityOntoCandidateRow<
  T extends Record<string, unknown>,
>(candidate: T, explainability: StructureCandidateExplainability): T & StructureCandidateExplainability & {
  sourceConversation: StructureCandidateSourceConversation;
  sourceEvent: StructureCandidateSourceEventInfo;
  createdFrom: StructureCandidateCreatedFrom;
  createdBy: string;
} {
  return {
    ...candidate,
    ...explainability,
    explainability,
  };
}
