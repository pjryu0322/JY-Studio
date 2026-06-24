import { syncProjectGraphProjectionWithTotals } from "@/lib/project-knowledge/projectKnowledgePipelineGraphMetrics";
import { extractStructureCandidatesFromEventStore } from "@/lib/project-structure/projectStructureExtractor";
import {
  completeKnowledgePipelineStep,
  failKnowledgePipelineStep,
  startKnowledgePipelineStep,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import type { PipelineRunMetricsInput } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import { normalizePipelineRunMetrics } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export async function runProjectKnowledgePostProcess(input: {
  projectId: string;
  eventIds?: readonly string[];
  reason?: string;
  pipelineRunId?: string;
}): Promise<{
  ok: boolean;
  candidateSync?: "ok" | "failed";
  graphSync?: "ok" | "failed";
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
  const candidateStepId = input.pipelineRunId
    ? await startKnowledgePipelineStep(input.pipelineRunId, {
        stage: "CANDIDATE_EXTRACTION",
        title: "Candidate Generated",
      })
    : null;
  try {
    const stats = await extractStructureCandidatesFromEventStore(projectId);
    metrics = normalizePipelineRunMetrics({
      eventCount: stats.eventCount,
      candidateNodeCount: stats.nodeCount,
      candidateEdgeCount: stats.edgeCount,
    });
    if (candidateStepId) {
      await completeKnowledgePipelineStep(candidateStepId, {
        summary: `${stats.nodeCount} candidate nodes · ${stats.edgeCount} candidate edges`,
        durationMs: Date.now() - candidateStarted,
      });
    }
  } catch (error) {
    console.error("Project knowledge candidate sync failed:", input.reason ?? "post_process", error);
    candidateSync = "failed";
    if (candidateStepId) {
      await failKnowledgePipelineStep(candidateStepId, {
        durationMs: Date.now() - candidateStarted,
      });
    }
  }

  const graphStarted = Date.now();
  const graphStepId = input.pipelineRunId
    ? await startKnowledgePipelineStep(input.pipelineRunId, {
        stage: "GRAPH_PROJECTION",
        title: "Graph Synced",
      })
    : null;
  try {
    const graphTotals = await syncProjectGraphProjectionWithTotals(projectId, input.eventIds);
    metrics = normalizePipelineRunMetrics({
      ...metrics,
      graphNodeCount: graphTotals.graphNodeCount,
      graphEdgeCount: graphTotals.graphEdgeCount,
    });
    if (graphStepId) {
      await completeKnowledgePipelineStep(graphStepId, {
        summary: `${graphTotals.graphNodeCount} graph nodes · ${graphTotals.graphEdgeCount} graph edges`,
        durationMs: Date.now() - graphStarted,
      });
    }
  } catch (error) {
    console.error("Project knowledge graph sync failed:", input.reason ?? "post_process", error);
    if (graphStepId) {
      await failKnowledgePipelineStep(graphStepId, {
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
    graphSync: "ok",
    metrics,
  };
}
