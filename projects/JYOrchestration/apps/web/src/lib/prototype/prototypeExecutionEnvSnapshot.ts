import type { PrototypeChatEnvBadge, PrototypeChatEnvSnapshot } from "@/lib/prototype/buildPrototypeChatMessages";
import type { ImplementationOrchestrationSummaryInput } from "@/lib/prototype/implementationOrchestrationSummary";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type PrototypeExecutionEnvStatus = PrototypeChatEnvSnapshot;

export function isPrototypeExecutionEnvLoading(env: PrototypeChatEnvSnapshot): boolean {
  return (
    env.git === "loading" ||
    env.github === "loading" ||
    env.cursor === "loading" ||
    env.connectionTest === "loading"
  );
}

export function toPrototypeChatEnvSnapshot(env: PrototypeExecutionEnvStatus): PrototypeChatEnvSnapshot {
  return { ...env };
}

export function buildImplementationBootstrapInput(input: {
  readonly envLoading: boolean;
  readonly projectId: string;
  readonly env: PrototypeChatEnvSnapshot;
  readonly envOk: boolean;
  readonly envSettingsHref: string;
  readonly featureDraftTitles: readonly string[];
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1: ArtifactOrchestrationStateV1 | null | undefined;
  readonly designOk: boolean;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
}): ImplementationOrchestrationSummaryInput | null {
  if (input.envLoading) return null;
  return {
    projectId: input.projectId,
    env: toPrototypeChatEnvSnapshot(input.env),
    envOk: input.envOk,
    envSettingsHref: input.envSettingsHref,
    featureDraftTitles: input.featureDraftTitles,
    projectArtifacts: input.projectArtifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
    designOk: input.designOk,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
  };
}

export function pickExecutionStateArtifacts(state: RequirementsStateJson): {
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1: ArtifactOrchestrationStateV1 | null | undefined;
} {
  return {
    projectArtifacts: state.projectArtifacts ?? [],
    artifactOrchestrationV1: state.artifactOrchestrationV1,
  };
}
