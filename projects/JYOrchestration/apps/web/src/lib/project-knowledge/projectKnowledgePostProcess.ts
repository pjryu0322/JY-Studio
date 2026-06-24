import { trySyncProjectGraphProjection } from "@/lib/project-graph/projectGraphProjection";
import { extractStructureCandidatesFromEventStore } from "@/lib/project-structure/projectStructureExtractor";
import { appendKnowledgePipelineStep } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import type { PipelineRunMetricsInput } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

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
  metrics?: PipelineRunMetricsInput;
}> {
  const projectId = String(input.projectId ?? "").trim();
  if (!projectId) {
    return { ok: false, errorCode: "MISSING_PROJECT_ID" };
  }

  let candidateSync: "ok" | "failed" = "ok";
  let metrics: PipelineRunMetricsInput | undefined;
  const candidateStarted = Date.now();
  try {
    const stats = await extractStructureCandidatesFromEventStore(projectId);
    metrics = {
      eventCount: stats.eventCount,
      candidateCount: stats.nodeCount,
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
    };
    if (input.pipelineRunId) {
      await appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "CANDIDATE_EXTRACTION",
        title: "Candidate Generated",
        summary: `${stats.nodeCount} candidates`,
        ok: true,
        durationMs: Date.now() - candidateStarted,
      });
    }
  } catch (error) {
    console.error("Project knowledge candidate sync failed:", input.reason ?? "post_process", error);
    candidateSync = "failed";
    if (input.pipelineRunId) {
      await appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "CANDIDATE_EXTRACTION",
        title: "Candidate Generated",
        ok: false,
        durationMs: Date.now() - candidateStarted,
      });
    }
  }

  const graphStarted = Date.now();
  try {
    trySyncProjectGraphProjection(projectId, input.eventIds);
    if (input.pipelineRunId) {
      const summary =
        metrics?.nodeCount != null && metrics?.edgeCount != null
          ? `${metrics.nodeCount} nodes · ${metrics.edgeCount} edges (queued sync)`
          : "Graph projection queued";
      await appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "GRAPH_PROJECTION",
        title: "Graph Synced",
        summary,
        ok: candidateSync === "ok",
        durationMs: Date.now() - graphStarted,
      });
    }
  } catch (error) {
    console.error("Project knowledge graph sync failed:", input.reason ?? "post_process", error);
    if (input.pipelineRunId) {
      await appendKnowledgePipelineStep(input.pipelineRunId, {
        stage: "GRAPH_PROJECTION",
        title: "Graph Synced",
        ok: false,
        durationMs: Date.now() - graphStarted,
      });
    }
    return {
      ok: candidateSync === "ok",
      candidateSync,
      graphSync: "failed",
      errorCode: "GRAPH_SYNC_FAILED",
      metrics,
    };
  }

  return {
    ok: candidateSync === "ok",
    candidateSync,
    graphSync: "queued",
    metrics,
  };
}
