import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";
import { appendProjectEvent, type ProjectEventStoreClient } from "@/lib/project-process/projectEventStore";
import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";
import { PLANNING_SNAPSHOT_EVENT_TYPE } from "@/lib/planning-snapshot/planningSnapshotModel";
import { planningSnapshotPayloadFromModel } from "@/lib/planning-snapshot/planningSnapshotMapper";

export function buildPlanningSnapshotEventIdempotencyKey(projectId: string, sourceMessageId: string): string {
  return `planning-snapshot-created:${projectId}:${sourceMessageId}`;
}

export async function appendPlanningSnapshotCreatedEvent(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly snapshot: PlanningSnapshotModel;
  }>,
) {
  const projectId = input.snapshot.projectId.trim();
  const sourceMessageId = input.snapshot.sourceMessageId.trim();
  const idempotencyKey = buildPlanningSnapshotEventIdempotencyKey(projectId, sourceMessageId);

  return appendProjectEvent(db, {
    projectId,
    eventType: PLANNING_SNAPSHOT_EVENT_TYPE,
    actorType: "AI",
    actorId: null,
    stage: PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION,
    sourceMessageId,
    idempotencyKey,
    payload: planningSnapshotPayloadFromModel(input.snapshot),
    metadata: {
      createdBy: input.snapshot.createdBy,
      source: PLANNING_SNAPSHOT_EVENT_TYPE,
    } as Prisma.InputJsonValue,
  });
}

export async function persistPlanningSnapshotIntegration(
  db: ProjectEventStoreClient,
  snapshot: PlanningSnapshotModel,
): Promise<{ readonly eventId: string; readonly created: boolean }> {
  const existingKey = buildPlanningSnapshotEventIdempotencyKey(snapshot.projectId, snapshot.sourceMessageId);
  const prior = await prisma.projectEvent.findFirst({
    where: { projectId: snapshot.projectId, idempotencyKey: existingKey },
    select: { id: true },
  });
  const event = await appendPlanningSnapshotCreatedEvent(db, { snapshot });
  return { eventId: event.id, created: !prior };
}
