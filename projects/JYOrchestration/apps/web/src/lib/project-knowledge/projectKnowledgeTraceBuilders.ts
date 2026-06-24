import { PROJECT_EVENT_TYPES } from "@/lib/project-process/projectEventTypes";
import { truncateConversationExcerpt } from "@/lib/project-structure/projectStructureExplainability";
import type { StructureExplainability } from "@/lib/project-structure/structureExplainabilityModel";
import type { ProjectKnowledgeTraceStep } from "@/lib/project-knowledge/projectKnowledgeTraceTypes";

export type TraceEventRow = Readonly<{
  readonly id: string;
  readonly eventType: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly sourceMessageId: string | null;
  readonly createdAt: Date;
  readonly payload: unknown;
}>;

export type TraceMessageRow = Readonly<{
  readonly sourceMessageId: string | null;
  readonly senderType: string;
  readonly content: string;
  readonly messageCreatedAt: Date | null;
}>;

export type TraceCandidateRow = Readonly<{
  readonly id: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly lifecycleStatus: string;
  readonly sourceEventId: string | null;
  readonly createdAt: Date;
}>;

export type TraceGraphNodeRow = Readonly<{
  readonly id: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceEventId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}>;

export type KnowledgeTraceBuildInput = Readonly<{
  readonly node: TraceGraphNodeRow;
  readonly explainability: StructureExplainability;
  readonly structureCandidateId: string | null;
  readonly candidate: TraceCandidateRow | null;
  readonly sourceEvent: TraceEventRow | null;
  readonly conversationMessage: TraceMessageRow | null;
  readonly proposalSourceMessage: TraceMessageRow | null;
}>;

function readPayloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return String((payload as Record<string, unknown>)[key] ?? "").trim();
}

function readPayloadStringArray(payload: unknown, key: string): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const raw = (payload as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function stepId(type: string, suffix: string): string {
  return `${type}:${suffix}`;
}

function messagePreview(row: TraceMessageRow | null): string | undefined {
  if (!row) return undefined;
  const excerpt = truncateConversationExcerpt(row.content, 160);
  if (!excerpt) return undefined;
  const who = row.senderType === "user" ? "사용자" : row.senderType === "assistant" ? "AI" : row.senderType;
  return `${who}: ${excerpt}`;
}

export function buildKnowledgeTraceLineage(input: KnowledgeTraceBuildInput): ProjectKnowledgeTraceStep[] {
  const steps: ProjectKnowledgeTraceStep[] = [];
  const ex = input.explainability;
  const messageId =
    ex.createdFrom.messageId ??
    ex.sourceConversation.messageId ??
    input.conversationMessage?.sourceMessageId ??
    null;

  if (input.conversationMessage || ex.sourceConversation.excerpt !== "—") {
    steps.push({
      id: stepId("conversation", messageId ?? "unknown"),
      type: "conversation",
      title: "대화 내용",
      summary:
        messagePreview(input.conversationMessage) ??
        (ex.sourceConversation.excerpt !== "—" ? ex.sourceConversation.excerpt : "대화에서 도출된 요구"),
      sourceMessageId: messageId ?? undefined,
      occurredAt: input.conversationMessage?.messageCreatedAt?.toISOString(),
      metadata: input.conversationMessage
        ? { senderType: input.conversationMessage.senderType }
        : undefined,
    });
  }

  const event = input.sourceEvent;
  if (event) {
    const payload = event.payload;
    if (event.eventType === PROJECT_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED) {
      const snapshotTitle = readPayloadString(payload, "snapshotTitle") || readPayloadString(payload, "title");
      steps.push({
        id: stepId("snapshot", event.id),
        type: "snapshot",
        title: "초기 기획 정리",
        summary: snapshotTitle || "기획 스냅샷 생성",
        sourceEventId: event.id,
        sourceMessageId: event.sourceMessageId ?? undefined,
        occurredAt: event.createdAt.toISOString(),
      });
    }

    if (
      event.eventType === PROJECT_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED ||
      event.eventType === PROJECT_EVENT_TYPES.PLANNING_PROPOSAL_CREATED
    ) {
      const features = readPayloadStringArray(payload, "features");
      const proposalSummary =
        features.length > 0
          ? features.slice(0, 3).join(", ")
          : readPayloadString(payload, "acceptedSnapshot") || "AI 기획 제안";
      steps.push({
        id: stepId("proposal", event.id),
        type: "proposal",
        title: "AI 추천안",
        summary: truncateConversationExcerpt(proposalSummary, 200),
        sourceEventId: event.id,
        sourceMessageId: readPayloadString(payload, "sourceMessageId") || event.sourceMessageId || undefined,
        sourceArtifactId: readPayloadString(payload, "proposalId") || undefined,
        occurredAt: event.createdAt.toISOString(),
      });
    }

    if (event.eventType === PROJECT_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED) {
      const acceptedBy = readPayloadString(payload, "acceptedBy") || event.actorType;
      steps.push({
        id: stepId("event", `${event.id}:approval`),
        type: "event",
        title: "사용자 승인",
        summary: acceptedBy === "USER" ? "추천안 승인" : `승인 주체: ${acceptedBy}`,
        sourceEventId: event.id,
        sourceMessageId: readPayloadString(payload, "acceptedByMessageId") || undefined,
        occurredAt: event.createdAt.toISOString(),
        metadata: { actorId: event.actorId },
      });
    }

    if (event.eventType === PROJECT_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED && steps.every((s) => s.type !== "conversation")) {
      steps.push({
        id: stepId("conversation", event.id),
        type: "conversation",
        title: "대화 내용",
        summary: messagePreview(input.conversationMessage) ?? "대화 메시지 이벤트",
        sourceEventId: event.id,
        sourceMessageId: event.sourceMessageId ?? undefined,
        occurredAt: event.createdAt.toISOString(),
      });
    }
  }

  if (input.candidate) {
    const c = input.candidate;
    steps.push({
      id: stepId("candidate", c.id),
      type: "candidate",
      title: "구조 후보",
      summary: `${c.nodeType}: ${c.title}`,
      sourceEventId: c.sourceEventId ?? undefined,
      sourceArtifactId: c.id,
      occurredAt: c.createdAt.toISOString(),
      metadata: { lifecycleStatus: c.lifecycleStatus },
    });
  } else if (input.structureCandidateId) {
    steps.push({
      id: stepId("candidate", input.structureCandidateId),
      type: "candidate",
      title: "구조 후보",
      summary: "구조 후보 정보를 불러오지 못했습니다.",
      sourceArtifactId: input.structureCandidateId,
    });
  }

  if (input.node.sourceEventId) {
    steps.push({
      id: stepId("projection", input.node.sourceEventId),
      type: "projection",
      title: "그래프 반영",
      summary: "지식 그래프에 반영됨",
      sourceEventId: input.node.sourceEventId,
      occurredAt: input.node.updatedAt.toISOString(),
    });
  }

  steps.push({
    id: stepId("graph-node", input.node.id),
    type: "graph-node",
    title: "현재 항목",
    summary: input.node.title,
    occurredAt: input.node.createdAt.toISOString(),
    metadata: { nodeType: input.node.nodeType },
  });

  return steps;
}
