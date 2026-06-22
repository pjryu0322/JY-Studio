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
  readonly confidenceReason: string;
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
    confidenceReason: String(e.confidenceReason ?? ""),
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
  const confidenceReason = buildConfidenceReason({
    conversationText,
    messageId,
    eventType,
    inferred,
    score01,
  });

  return {
    confidence,
    confidenceLabel: confidenceLabelFromScore(score01),
    reason,
    confidenceReason,
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

export function buildConfidenceReason(input: Readonly<{
  conversationText: string;
  messageId: string | null;
  eventType: string;
  inferred: boolean;
  score01: number;
}>): string {
  const parts: string[] = [];
  if (input.conversationText.length >= 40) parts.push("대화 발화가 충분히 길어 근거로 활용했습니다.");
  else if (input.conversationText.length > 0) parts.push("짧은 대화 발화를 보조 근거로 사용했습니다.");
  if (input.messageId) parts.push("원본 메시지 ID가 연결되어 있습니다.");
  if (input.eventType && !input.inferred) parts.push(`이벤트 유형(${input.eventType})이 명확합니다.`);
  if (input.inferred) parts.push("대화에서 추론(inferred)된 신호가 포함되어 신뢰도가 조정되었습니다.");
  if (!input.conversationText) parts.push("직접 대화 인용이 없어 이벤트·메타데이터에 의존합니다.");
  const pct = Math.round(input.score01 * 100);
  parts.push(`종합 점수 ${pct}% 기준으로 confidence를 산정했습니다.`);
  return parts.join(" ");
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
