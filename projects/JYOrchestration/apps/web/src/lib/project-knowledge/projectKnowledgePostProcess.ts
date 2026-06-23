import { trySyncProjectGraphProjection } from "@/lib/project-graph/projectGraphProjection";
import { extractStructureCandidatesFromEventStore } from "@/lib/project-structure/projectStructureExtractor";

export async function runProjectKnowledgePostProcess(input: {
  projectId: string;
  eventIds?: readonly string[];
  reason?: string;
}): Promise<{
  ok: boolean;
  candidateSync?: "ok" | "failed";
  graphSync?: "queued" | "failed";
  errorCode?: string;
}> {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) {
    return { ok: false, errorCode: "MISSING_PROJECT_ID" };
  }

  let candidateSync: "ok" | "failed" = "ok";
  try {
    await extractStructureCandidatesFromEventStore(projectId);
  } catch (error) {
    console.error("Project knowledge candidate sync failed:", input.reason ?? "post_process", error);
    candidateSync = "failed";
  }

  try {
    trySyncProjectGraphProjection(projectId, input.eventIds);
  } catch (error) {
    console.error("Project knowledge graph sync failed:", input.reason ?? "post_process", error);
    return {
      ok: candidateSync === "ok",
      candidateSync,
      graphSync: "failed",
      errorCode: "GRAPH_SYNC_FAILED",
    };
  }

  return {
    ok: candidateSync === "ok",
    candidateSync,
    graphSync: "queued",
  };
}
