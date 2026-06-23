import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import { appendProjectEvent, type ProjectEventStoreClient } from "@/lib/project-process/projectEventStore";
import type { PlanningProposalModel } from "@/lib/planning-proposal/planningProposalModel";
import { PLANNING_PROPOSAL_EVENT_TYPE } from "@/lib/planning-proposal/planningProposalModel";
import { planningProposalPayloadFromModel } from "@/lib/planning-proposal/planningProposalMapper";

export function buildPlanningProposalApprovedIdempotencyKey(
  projectId: string,
  proposalId: string,
  acceptedByMessageId: string,
): string {
  return `planning-proposal-approved:${projectId}:${proposalId}:${acceptedByMessageId}`;
}

export async function appendPlanningProposalApprovedEvent(
  db: ProjectEventStoreClient,
  input: Readonly<{ readonly proposal: PlanningProposalModel }>,
) {
  const proposal = input.proposal;
  const idempotencyKey = buildPlanningProposalApprovedIdempotencyKey(
    proposal.projectId,
    proposal.proposalId,
    proposal.acceptedByMessageId,
  );

  return appendProjectEvent(db, {
    projectId: proposal.projectId,
    eventType: PLANNING_PROPOSAL_EVENT_TYPE,
    actorType: "USER",
    actorId: null,
    stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_SERVICE_FLOW,
    sourceMessageId: proposal.sourceMessageId,
    idempotencyKey,
    payload: planningProposalPayloadFromModel(proposal),
    metadata: {
      proposalId: proposal.proposalId,
      acceptedByMessageId: proposal.acceptedByMessageId,
      source: PLANNING_PROPOSAL_EVENT_TYPE,
    } as Prisma.InputJsonValue,
  });
}

export async function persistPlanningProposalApproval(
  db: ProjectEventStoreClient,
  proposal: PlanningProposalModel,
): Promise<{ readonly eventId: string; readonly created: boolean }> {
  const idempotencyKey = buildPlanningProposalApprovedIdempotencyKey(
    proposal.projectId,
    proposal.proposalId,
    proposal.acceptedByMessageId,
  );
  const prior = await prisma.projectEvent.findFirst({
    where: { projectId: proposal.projectId, idempotencyKey },
    select: { id: true },
  });
  const event = await appendPlanningProposalApprovedEvent(db, { proposal });
  return { eventId: event.id, created: !prior };
}
