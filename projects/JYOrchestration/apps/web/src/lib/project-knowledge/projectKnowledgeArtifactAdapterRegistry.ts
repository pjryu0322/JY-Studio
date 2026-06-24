import type { ProjectGraphEventInput } from "@/lib/project-graph/projectGraphProjectionPlan";
import type { ProjectGraphProjectionPlan } from "@/lib/project-graph/projectGraphProjectionPlan";
import type { StructureExtractionPlan } from "@/lib/project-structure/projectStructureExtractorPlan";
import type { ProjectKnowledgeArtifactAdapter } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapter";

const adapterByEventType = new Map<string, ProjectKnowledgeArtifactAdapter<unknown>>();

export function registerProjectKnowledgeArtifactAdapter(adapter: ProjectKnowledgeArtifactAdapter<unknown>): void {
  adapterByEventType.set(adapter.eventType, adapter);
}

function ensureDefaultAdaptersRegistered(): void {
  if (adapterByEventType.size > 0) return;
  const { bootstrapProjectKnowledgeArtifactAdapters } =
    require("./projectKnowledgeArtifactAdapterBootstrap") as typeof import("./projectKnowledgeArtifactAdapterBootstrap");
  bootstrapProjectKnowledgeArtifactAdapters();
}

export function resetProjectKnowledgeArtifactAdaptersForTests(): void {
  adapterByEventType.clear();
  const mod = require("./projectKnowledgeArtifactAdapterBootstrap") as {
    resetProjectKnowledgeArtifactBootstrapForTests?: () => void;
  };
  mod.resetProjectKnowledgeArtifactBootstrapForTests?.();
}

export function getProjectKnowledgeArtifactAdapter(
  eventType: string,
): ProjectKnowledgeArtifactAdapter<unknown> | null {
  ensureDefaultAdaptersRegistered();
  return adapterByEventType.get(eventType) ?? null;
}

export function planGraphProjectionFromArtifactAdapter(
  event: ProjectGraphEventInput,
): ProjectGraphProjectionPlan | null {
  const adapter = getProjectKnowledgeArtifactAdapter(event.eventType);
  if (!adapter) return null;
  const artifact = adapter.parseEventPayload({
    projectId: event.projectId,
    payload: event.payload,
    sourceMessageId: event.sourceMessageId,
  });
  if (!artifact) return null;
  return adapter.toGraphProjection({ eventId: event.id, projectId: event.projectId, artifact });
}

export function planStructureCandidatesFromArtifactAdapter(
  event: ProjectGraphEventInput,
): StructureExtractionPlan | null {
  const adapter = getProjectKnowledgeArtifactAdapter(event.eventType);
  if (!adapter) return null;
  const artifact = adapter.parseEventPayload({
    projectId: event.projectId,
    payload: event.payload,
    sourceMessageId: event.sourceMessageId,
  });
  if (!artifact) return null;
  return adapter.toStructureCandidates({ eventId: event.id, artifact });
}
