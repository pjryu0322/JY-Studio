import type { SampleDataSpecV1 } from "@/lib/featurePlanning/sampleDataSpecV1";
import {
  buildPlanningHandoffForImplementation,
  mergePlanningDataSlotsPatch,
  parsePlanningDataSlotsV1,
  type PlanningDataSlotsV1,
  type PlanningHandoffForImplementationV1,
} from "@/lib/planning/planningDataSlotsV1";
import { extractRepositoryBaseNameFromGitRepoName } from "@/lib/planning/projectDataStoreNaming";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export function resolvePlanningRepositoryName(input: Readonly<{
  readonly gitRepoName?: string | null;
  readonly projectName?: string | null;
}>): string {
  const fromGit = extractRepositoryBaseNameFromGitRepoName(input.gitRepoName);
  if (fromGit) return fromGit;
  return String(input.projectName ?? "").trim() || "project";
}

export function buildPlanningDataSlotsStatePatch(input: Readonly<{
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly repositoryName: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sampleDataSpecV1?: SampleDataSpecV1 | null;
  readonly nowIso?: string;
}>): Readonly<{
  readonly planningDataSlotsV1: PlanningDataSlotsV1;
  readonly planningHandoffForImplementationV1: PlanningHandoffForImplementationV1;
}> {
  const prior = parsePlanningDataSlotsV1(input.state.planningDataSlotsV1);
  const planningDataSlotsV1 = mergePlanningDataSlotsPatch({
    repositoryName: input.repositoryName,
    projectId: input.projectId,
    orchestration: input.orchestration,
    definitions: input.definitions,
    sampleDataSpecV1: input.sampleDataSpecV1 ?? input.state.sampleDataSpecV1 ?? null,
    planningDatabaseSettings: input.state.planningDatabaseSettingsV1 ?? null,
    prior,
    nowIso: input.nowIso,
  });
  const planningHandoffForImplementationV1 = buildPlanningHandoffForImplementation({
    projectId: input.projectId,
    repositoryName: input.repositoryName,
    planningDataSlots: planningDataSlotsV1,
    planningDatabaseSettings: input.state.planningDatabaseSettingsV1 ?? null,
  });
  return { planningDataSlotsV1, planningHandoffForImplementationV1 };
}
