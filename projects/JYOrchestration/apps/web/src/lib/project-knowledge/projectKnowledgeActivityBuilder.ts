import {
  pipelineStepsToActivityItems,
  type KnowledgePipelineRunRecord,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type ProjectKnowledgeActivityItem = {
  id: string;
  type: "event" | "candidate" | "graph" | "warning";
  title: string;
  summary?: string;
  occurredAt?: string;
  sourceEventId?: string;
  sourceMessageId?: string;
  technicalDetail?: unknown;
};

export type BuildKnowledgeActivityItemsInput = Readonly<{
  events?: readonly Record<string, unknown>[];
  warnings?: readonly string[];
  pipelineRun?: KnowledgePipelineRunRecord | null;
}>;

export function buildKnowledgeActivityItems(input: BuildKnowledgeActivityItemsInput): ProjectKnowledgeActivityItem[] {
  const items: ProjectKnowledgeActivityItem[] = [];

  if (input.pipelineRun) {
    items.push(...pipelineStepsToActivityItems(input.pipelineRun));
  }

  for (const event of input.events ?? []) {
    const id = String(event.id ?? "").trim();
    if (!id) continue;
    const eventType = String(event.eventType ?? "event").trim();
    const occurredAt =
      typeof event.createdAt === "string"
        ? event.createdAt
        : event.createdAt instanceof Date
          ? event.createdAt.toISOString()
          : undefined;
    items.push({
      id: `event:${id}`,
      type: "event",
      title: eventType,
      occurredAt,
      sourceEventId: id,
      sourceMessageId: typeof event.sourceMessageId === "string" ? event.sourceMessageId : undefined,
      technicalDetail: event.payload,
    });
  }

  for (const code of input.warnings ?? []) {
    const trimmed = String(code ?? "").trim();
    if (!trimmed) continue;
    items.push({
      id: `warning:${trimmed}`,
      type: "warning",
      title: trimmed,
    });
  }

  return items;
}
