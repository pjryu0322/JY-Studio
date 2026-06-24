import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { PROJECT_EVENT_TYPES } from "@/lib/project-process/projectEventTypes";
import {
  publishKnowledgeEvent,
  subscribeKnowledgeEvent,
  type KnowledgeBusEvent,
} from "@/lib/project-knowledge/projectKnowledgeEventBus";
import { runProjectKnowledgePostProcess } from "@/lib/project-knowledge/projectKnowledgePostProcess";
import {
  runProjectKnowledgePipeline,
  type RunProjectKnowledgePipelineResult,
} from "@/lib/project-knowledge/projectKnowledgePipeline";

const POST_PROCESS_EVENT_TYPES = new Set<string>([
  PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED,
  PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
  PROJECT_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED,
]);

let registered = false;

async function handleKnowledgeBusEvent(event: KnowledgeBusEvent): Promise<unknown> {
  if (event.kind === "requirements_saved") {
    return runProjectKnowledgePipeline(event.db, event.input);
  }

  if (event.kind === "project_event_appended") {
    if (!POST_PROCESS_EVENT_TYPES.has(event.eventType)) return null;
    return runProjectKnowledgePostProcess({
      projectId: event.projectId,
      eventIds: [event.eventId],
      reason: event.eventType,
    });
  }

  return null;
}

export function registerProjectKnowledgePipelineSubscriber(): void {
  if (registered) return;
  registered = true;
  subscribeKnowledgeEvent(handleKnowledgeBusEvent);
}

export async function publishRequirementsSavedKnowledgeEvent(input: {
  db: import("@/lib/project-process/projectEventStore").ProjectEventStoreClient;
  pipelineInput: import("@/lib/project-knowledge/projectKnowledgePipeline").RunProjectKnowledgePipelineInput;
}): Promise<RunProjectKnowledgePipelineResult> {
  registerProjectKnowledgePipelineSubscriber();
  const results = await publishKnowledgeEvent({
    kind: "requirements_saved",
    db: input.db,
    input: input.pipelineInput,
  });
  const first = results.find(
    (r): r is RunProjectKnowledgePipelineResult =>
      typeof r === "object" && r !== null && "warnings" in r && Array.isArray((r as RunProjectKnowledgePipelineResult).warnings),
  );
  return (
    first ?? {
      ok: false,
      warnings: ["KNOWLEDGE_PIPELINE_NO_RESULT"],
    }
  );
}

registerProjectKnowledgePipelineSubscriber();
