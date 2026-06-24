import { trySyncProjectGraphProjection } from "@/lib/project-graph/projectGraphProjection";
import { extractStructureCandidatesFromEventStore } from "@/lib/project-structure/projectStructureExtractor";
import { appendKnowledgePipelineStep } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";

export async function runProjectKnowledgePostProcess(input: {
  projectId: string;
  eventIds?: readonly string[];
  reason?: string;
  pipelineRunId?: string;
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
    if (input.pipelineRunId) {
      appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "CANDIDATE_EXTRACTION",
        title: "Candidate Generated",
        ok: true,
      });
    }
  } catch (error) {
    console.error("Project knowledge candidate sync failed:", input.reason ?? "post_process", error);
    candidateSync = "failed";
    if (input.pipelineRunId) {
      appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "CANDIDATE_EXTRACTION",
        title: "Candidate Generated",
        ok: false,
      });
    }
  }

  try {
    trySyncProjectGraphProjection(projectId, input.eventIds);
    if (input.pipelineRunId) {
      appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "GRAPH_PROJECTION",
        title: "Graph Synced",
        ok: candidateSync === "ok",
      });
    }
  } catch (error) {
    console.error("Project knowledge graph sync failed:", input.reason ?? "post_process", error);
    if (input.pipelineRunId) {
      appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "GRAPH_PROJECTION",
        title: "Graph Synced",
        ok: false,
      });
    }
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
