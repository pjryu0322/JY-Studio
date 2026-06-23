import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { parseSingleChatProposalLifecycleV1 } from "@/lib/requirements/singleChatProposalLifecycle";
import {
  buildPlanningProposalModel,
  resolveProposalMessageIdsFromConversation,
} from "@/lib/planning-proposal/planningProposalMapper";
import { persistPlanningProposalApproval } from "@/lib/planning-proposal/planningProposalEvent";
import type { ProjectEventStoreClient } from "@/lib/project-process/projectEventStore";

export type PlanningProposalIntegrationResult = Readonly<{
  readonly integrated: boolean;
  readonly eventId?: string;
  readonly proposalId?: string;
}>;

export async function integratePlanningProposalApprovalFromRequirementsState(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly projectId: string;
    readonly requirementsStateJson: unknown;
    readonly requirementsConversationJson?: unknown | null;
  }>,
): Promise<PlanningProposalIntegrationResult> {
  const pid = String(input.projectId).trim();
  if (!pid) return { integrated: false };

  const state = parseRequirementsStateJson(input.requirementsStateJson);
  const lifecycle = parseSingleChatProposalLifecycleV1(
    state.singleChatOrchestrationV1?.proposalLifecycleV1 ?? null,
  );
  if (!lifecycle) return { integrated: false };
  if (lifecycle.lastDecision !== "APPLY" || lifecycle.phase !== "NEXT_STAGE_READY") {
    return { integrated: false };
  }

  const acceptedSnapshot = String(lifecycle.acceptedProposalSnapshot ?? "").trim();
  if (!acceptedSnapshot) return { integrated: false };

  const acceptedAt = String(lifecycle.acceptedAt ?? new Date().toISOString());
  const { sourceMessageId, acceptedByMessageId } = resolveProposalMessageIdsFromConversation(
    input.requirementsConversationJson,
    acceptedSnapshot,
  );

  const proposal = buildPlanningProposalModel({
    projectId: pid,
    proposalId: lifecycle.proposalId,
    acceptedSnapshot,
    acceptedAt,
    sourceMessageId,
    acceptedByMessageId,
  });

  const { eventId } = await persistPlanningProposalApproval(db, proposal);
  return { integrated: true, eventId, proposalId: lifecycle.proposalId };
}
