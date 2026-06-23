import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import {
  syncRequirementsConversationMessagesToEventStore,
  type ProjectEventStoreClient,
} from "@/lib/project-process/projectEventStore";
import { integratePlanningSnapshotsAfterConversationSync } from "@/lib/planning-snapshot/planningSnapshotConversationIntegrate";
import { integratePlanningProposalApprovalFromRequirementsState } from "@/lib/planning-proposal/planningProposalConversationIntegrate";
import { runProjectKnowledgePostProcess } from "@/lib/project-knowledge/projectKnowledgePostProcess";
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
  /** 대화 JSON PATCH 시 conversation + snapshot 통합 */
  readonly runConversationSync?: boolean;
  /** requirements state / conversation PATCH 시 proposal 통합 */
  readonly runProposalIntegration?: boolean;
}>;

export type RunProjectKnowledgePipelineResult = Readonly<{
  ok: boolean;
  conversationSynced?: boolean;
  snapshotIntegrated?: boolean;
  proposalIntegrated?: boolean;
  postProcessed?: boolean;
  statePatch?: Partial<RequirementsStateJson>;
  warnings: string[];
}>;

export async function runProjectKnowledgePipeline(
  db: ProjectEventStoreClient,
  input: RunProjectKnowledgePipelineInput,
): Promise<RunProjectKnowledgePipelineResult> {
  const warnings: string[] = [];
  const eventIds: string[] = [];
  let conversationSynced = false;
  let snapshotIntegrated = false;
  let proposalIntegrated = false;
  let postProcessed = false;
  let statePatch: Partial<RequirementsStateJson> | undefined;

  const projectId = String(input.projectId).trim();
  if (!projectId) {
    return { ok: false, warnings: ["MISSING_PROJECT_ID"] };
  }

  const runConversation = input.runConversationSync !== false && input.nextConversationJson != null;
  const runProposal =
    input.runProposalIntegration !== false &&
    (input.requirementsStateJson !== undefined || input.nextConversationJson != null);

  if (runConversation) {
    try {
      await syncRequirementsConversationMessagesToEventStore(db, {
        projectId,
        actorId: input.actorId,
        previousConversationJson: input.previousConversationJson,
        nextConversationJson: input.nextConversationJson,
        fallbackStage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
      });
      conversationSynced = true;
    } catch (error) {
      console.error("Project Event Store sync failed:", error);
      warnings.push("EVENT_STORE_SYNC_FAILED");
    }

    if (!warnings.includes("EVENT_STORE_SYNC_FAILED")) {
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
        }
      } catch (error) {
        console.error("Planning snapshot integration failed:", error);
        warnings.push("PLANNING_SNAPSHOT_INTEGRATION_FAILED");
      }
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
      }
    } catch (error) {
      console.error("Planning proposal Event Store integration failed:", error);
      warnings.push("PLANNING_PROPOSAL_INTEGRATION_FAILED");
    }
  }

  const shouldPostProcess = runConversation || runProposal;
  if (shouldPostProcess && !warnings.includes("EVENT_STORE_SYNC_FAILED")) {
    const post = await runProjectKnowledgePostProcess({
      projectId,
      eventIds: eventIds.length ? eventIds : undefined,
      reason: input.trigger,
    });
    postProcessed = post.ok;
    if (post.candidateSync === "failed") warnings.push("STRUCTURE_CANDIDATE_SYNC_FAILED");
    if (post.graphSync === "failed") warnings.push("GRAPH_PROJECTION_SYNC_FAILED");
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
    ...(statePatch ? { statePatch } : {}),
    warnings,
  };
}
