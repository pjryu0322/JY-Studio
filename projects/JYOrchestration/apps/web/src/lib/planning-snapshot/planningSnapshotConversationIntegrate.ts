import { PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE } from "@/lib/requirements/preProjectPlanningSummary";
import { extractRequirementsMessagesForEventStore } from "@/lib/project-process/projectEventMessageExtract";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { mapPlanningSnapshotFromRequirementsContext } from "@/lib/planning-snapshot/planningSnapshotMapper";
import { persistPlanningSnapshotIntegration } from "@/lib/planning-snapshot/planningSnapshotEvent";
import type { PlanningSnapshotV1Wire } from "@/lib/planning-snapshot/planningSnapshotModel";
import { mergeDownstreamStateFromPlanningSnapshot } from "@/lib/planning-snapshot/planningSnapshotStageSeed";
import type { ProjectEventStoreClient } from "@/lib/project-process/projectEventStore";

export type PlanningSnapshotIntegrationResult = Readonly<{
  readonly integrated: boolean;
  readonly sourceMessageId?: string;
  readonly eventId?: string;
  readonly statePatch?: Partial<RequirementsStateJson>;
}>;

export async function integratePlanningSnapshotsAfterConversationSync(
  db: ProjectEventStoreClient,
  input: Readonly<{
    readonly projectId: string;
    readonly projectName: string;
    readonly projectDescription?: string | null;
    readonly previousConversationJson?: unknown | null;
    readonly nextConversationJson: unknown;
    readonly requirementsStateJson: unknown;
  }>,
): Promise<PlanningSnapshotIntegrationResult> {
  const pid = String(input.projectId).trim();
  if (!pid) return { integrated: false };

  const extracted = extractRequirementsMessagesForEventStore({
    previousConversationJson: input.previousConversationJson,
    nextConversationJson: input.nextConversationJson,
    fallbackStage: "requirements_ideation",
  });

  const planningMessages = extracted.filter(
    (row) => row.message.meta?.internalType === PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE,
  );
  if (!planningMessages.length) return { integrated: false };

  const state = parseRequirementsStateJson(input.requirementsStateJson);
  let last: PlanningSnapshotIntegrationResult = { integrated: false };

  for (const row of planningMessages) {
    const sourceMessageId = String(row.message.id).trim();
    const snapshot = mapPlanningSnapshotFromRequirementsContext({
      projectId: pid,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      state,
      sourceMessageId,
      orchestration: state.singleChatOrchestrationV1,
    });

    const { eventId } = await persistPlanningSnapshotIntegration(db, snapshot);

    const wire: PlanningSnapshotV1Wire = {
      productName: snapshot.productName,
      summary: snapshot.summary,
      problems: [...snapshot.problems],
      actors: [...snapshot.actors],
      features: [...snapshot.features],
      scope: snapshot.scope,
      successCriteria: [...snapshot.successCriteria],
      sourceMessageId: snapshot.sourceMessageId,
      createdBy: snapshot.createdBy,
      integratedAt: new Date().toISOString(),
      eventId,
    };

    const statePatch = mergeDownstreamStateFromPlanningSnapshot(state, wire);
    last = {
      integrated: true,
      sourceMessageId,
      eventId,
      statePatch,
    };
  }

  return last;
}
