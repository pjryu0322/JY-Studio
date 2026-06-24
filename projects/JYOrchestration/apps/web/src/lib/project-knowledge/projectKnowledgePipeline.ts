import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import {
  syncRequirementsConversationMessagesToEventStore,
  type ProjectEventStoreClient,
} from "@/lib/project-process/projectEventStore";
import { integratePlanningSnapshotsAfterConversationSync } from "@/lib/planning-snapshot/planningSnapshotConversationIntegrate";
import { integratePlanningProposalApprovalFromRequirementsState } from "@/lib/planning-proposal/planningProposalConversationIntegrate";
import { runProjectKnowledgePostProcess } from "@/lib/project-knowledge/projectKnowledgePostProcess";
import { runWithKnowledgeBusPublishSuppressed } from "@/lib/project-knowledge/knowledgeBusPublishContext";
import {
  completeKnowledgePipelineRun,
  completeKnowledgePipelineStep,
  failKnowledgePipelineRun,
  failKnowledgePipelineStep,
  startKnowledgePipelineRun,
  startKnowledgePipelineStep,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";
import { recordKnowledgeGraphRevisionForMilestone } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import type { PipelineRunMetricsInput } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ProjectKnowledgePipelineTrigger =
  | "requirements_saved"
  | "manual_sync"
  | "proposal_approved";

export type RunProjectKnowledgePipelineInput = Readonly<{
  readonly projectId: string;
  readonly actorId?: string | null;
  readonly trigger: ProjectKnowledgePipelineTrigger;
  readonly previousConversationJson?: unknown | null;
  readonly nextConversationJson?: unknown | null;
  readonly requirementsStateJson?: unknown | null;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
  readonly runConversationSync?: boolean;
  readonly runProposalIntegration?: boolean;
}>;

export type RunProjectKnowledgePipelineResult = Readonly<{
  ok: boolean;
  conversationSynced?: boolean;
  snapshotIntegrated?: boolean;
  proposalIntegrated?: boolean;
  postProcessed?: boolean;
  pipelineRunId?: string;
  statePatch?: Partial<RequirementsStateJson>;
  warnings: string[];
}>;

export async function runProjectKnowledgePipeline(
  db: ProjectEventStoreClient,
  input: RunProjectKnowledgePipelineInput,
): Promise<RunProjectKnowledgePipelineResult> {
  return runWithKnowledgeBusPublishSuppressed(async () => {
    const warnings: string[] = [];
    const eventIds: string[] = [];
    let conversationSynced = false;
    let snapshotIntegrated = false;
    let proposalIntegrated = false;
    let postProcessed = false;
    let statePatch: Partial<RequirementsStateJson> | undefined;
    let metrics: PipelineRunMetricsInput | undefined;

    const projectId = String(input.projectId).trim();
    if (!projectId) {
      return { ok: false, warnings: ["MISSING_PROJECT_ID"] };
    }

    const run = await startKnowledgePipelineRun(projectId, input.trigger);

    const runConversation = input.runConversationSync !== false && input.nextConversationJson != null;
    const runProposal =
      input.runProposalIntegration !== false &&
      (input.requirementsStateJson !== undefined || input.nextConversationJson != null);

    if (runConversation) {
      const syncStarted = Date.now();
      const syncStepId = await startKnowledgePipelineStep(run.id, {
        stage: "EVENT_SYNC",
        title: "Conversation Saved",
      });
      try {
        await syncRequirementsConversationMessagesToEventStore(db, {
          projectId,
          actorId: input.actorId,
          previousConversationJson: input.previousConversationJson,
          nextConversationJson: input.nextConversationJson,
          fallbackStage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
        });
        conversationSynced = true;
        await recordKnowledgeGraphRevisionForMilestone({
          projectId,
          milestone: "conversation_sync",
        });
        if (syncStepId) {
          await completeKnowledgePipelineStep(syncStepId, {
            durationMs: Date.now() - syncStarted,
          });
        }
      } catch (error) {
        console.error("Project Event Store sync failed:", error);
        warnings.push("EVENT_STORE_SYNC_FAILED");
        if (syncStepId) {
          await failKnowledgePipelineStep(syncStepId, { durationMs: Date.now() - syncStarted });
        }
        await failKnowledgePipelineRun(run.id, {
          errorMessage: "EVENT_STORE_SYNC_FAILED",
        });
        return { ok: false, pipelineRunId: run.id, warnings };
      }

      try {
        const snapshotIntegration = await integratePlanningSnapshotsAfterConversationSync(db, {
          projectId,
          projectName: String(input.projectName ?? "").trim(),
          projectDescription: input.projectDescription,
          previousConversationJson: input.previousConversationJson,
          nextConversationJson: input.nextConversationJson!,
          requirementsStateJson: input.requirementsStateJson,
        });
        if (snapshotIntegration.integrated) {
          snapshotIntegrated = true;
          if (snapshotIntegration.eventId) eventIds.push(snapshotIntegration.eventId);
          if (snapshotIntegration.statePatch) statePatch = snapshotIntegration.statePatch;
          await recordKnowledgeGraphRevisionForMilestone({
            projectId,
            milestone: "snapshot_integration",
            sourceEventId: snapshotIntegration.eventId,
          });
          const stepId = await startKnowledgePipelineStep(run.id, {
            stage: "ARTIFACT_INTEGRATION",
            title: "Snapshot Integrated",
            sourceEventId: snapshotIntegration.eventId,
            sourceMessageId: snapshotIntegration.sourceMessageId,
          });
          if (stepId) await completeKnowledgePipelineStep(stepId);
        }
      } catch (error) {
        console.error("Planning snapshot integration failed:", error);
        warnings.push("PLANNING_SNAPSHOT_INTEGRATION_FAILED");
      }
    }

    if (runProposal) {
      try {
        const proposalIntegration = await integratePlanningProposalApprovalFromRequirementsState(db, {
          projectId,
          requirementsStateJson: input.requirementsStateJson,
          requirementsConversationJson: input.nextConversationJson,
        });
        if (proposalIntegration.integrated) {
          proposalIntegrated = true;
          if (proposalIntegration.eventId) eventIds.push(proposalIntegration.eventId);
          await recordKnowledgeGraphRevisionForMilestone({
            projectId,
            milestone: "proposal_approval",
            sourceEventId: proposalIntegration.eventId,
          });
          const stepId = await startKnowledgePipelineStep(run.id, {
            stage: "ARTIFACT_INTEGRATION",
            title: "Proposal Approved",
            sourceEventId: proposalIntegration.eventId,
          });
          if (stepId) await completeKnowledgePipelineStep(stepId);
        }
      } catch (error) {
        console.error("Planning proposal Event Store integration failed:", error);
        warnings.push("PLANNING_PROPOSAL_INTEGRATION_FAILED");
      }
    }

    const shouldPostProcess = runConversation || runProposal;
    if (shouldPostProcess) {
      const post = await runProjectKnowledgePostProcess({
        projectId,
        eventIds: eventIds.length ? eventIds : undefined,
        reason: input.trigger,
        pipelineRunId: run.id,
      });
      postProcessed = post.ok;
      metrics = post.metrics;
      if (post.candidateSync === "failed") warnings.push("STRUCTURE_CANDIDATE_SYNC_FAILED");
      if (post.graphSync === "failed") warnings.push("GRAPH_PROJECTION_SYNC_FAILED");
    }

    buildKnowledgeActivityItems({ warnings });
    const activityStepId = await startKnowledgePipelineStep(run.id, {
      stage: "ACTIVITY_BUILD",
      title: "Activity Built",
    });
    if (activityStepId) {
      if (warnings.length === 0) {
        await completeKnowledgePipelineStep(activityStepId);
      } else {
        await failKnowledgePipelineStep(activityStepId, { summary: warnings.join(", ") });
      }
    }

    const failed =
      warnings.includes("EVENT_STORE_SYNC_FAILED") ||
      warnings.includes("STRUCTURE_CANDIDATE_SYNC_FAILED") ||
      warnings.includes("GRAPH_PROJECTION_SYNC_FAILED");

    if (failed) {
      await failKnowledgePipelineRun(run.id, {
        errorMessage: warnings.join(", "),
        metrics,
      });
    } else {
      await completeKnowledgePipelineRun(run.id, {
        summary: warnings.length ? warnings.join(", ") : undefined,
        metrics,
      });
    }

    const ok =
      warnings.length === 0 ||
      (conversationSynced || snapshotIntegrated || proposalIntegrated || postProcessed);

    return {
      ok,
      conversationSynced,
      snapshotIntegrated,
      proposalIntegrated,
      postProcessed,
      pipelineRunId: run.id,
      ...(statePatch ? { statePatch } : {}),
      warnings,
    };
  });
}
