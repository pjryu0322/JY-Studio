export type KnowledgeProjectEventAppended = Readonly<{
  readonly kind: "project_event_appended";
  readonly projectId: string;
  readonly eventId: string;
  readonly eventType: string;
}>;

export type KnowledgeRequirementsSaved = Readonly<{
  readonly kind: "requirements_saved";
  readonly db: import("@/lib/project-process/projectEventStore").ProjectEventStoreClient;
  readonly input: import("@/lib/project-knowledge/projectKnowledgePipeline").RunProjectKnowledgePipelineInput;
}>;

export type KnowledgeBusEvent = KnowledgeProjectEventAppended | KnowledgeRequirementsSaved;

export type KnowledgeEventHandler = (event: KnowledgeBusEvent) => void | Promise<unknown>;

const subscribers = new Set<KnowledgeEventHandler>();

export function subscribeKnowledgeEvent(handler: KnowledgeEventHandler): () => void {
  subscribers.add(handler);
  return () => unsubscribeKnowledgeEvent(handler);
}

export function unsubscribeKnowledgeEvent(handler: KnowledgeEventHandler): void {
  subscribers.delete(handler);
}

export async function publishKnowledgeEvent(event: KnowledgeBusEvent): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const handler of subscribers) {
    try {
      results.push(await handler(event));
    } catch (error) {
      console.error("Knowledge event subscriber failed:", event.kind, error);
      results.push(error);
    }
  }
  return results;
}
