import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ImplementationSeedV1, ImplementationSeedReadiness } from "@/lib/requirements/implementationSeed";
import { summarizeImplementationSeedStatus } from "@/lib/requirements/implementationSeed";
import {
  isPlanningReadyForImplementationExecution,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";
import { evaluateRequiredImplementationArtifacts } from "@/lib/requirements/planningReadinessGate";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { collectReferencePlanningArtifacts } from "@/lib/prototype/implementationWorkPlanDraft";

/** Planning / implementation entry surfaces share these readiness dimensions. */
export type ImplementationSurfaceReadiness = Readonly<{
  readonly seedReady: boolean;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly hasReferenceArtifacts: boolean;
}>;

export type ImplementationEntrySurfaceReadiness = ImplementationSurfaceReadiness &
  Readonly<{
    readonly taskListReady: boolean;
  }>;

export function evaluateQuickDesignPostConfirmReadiness(input: {
  readonly readiness: ImplementationSeedReadiness;
  readonly prepComplete: boolean;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk?: boolean;
  readonly generatedArtifactCount?: number;
}): ImplementationSurfaceReadiness {
  const artifacts = input.projectArtifacts ?? [];
  const artifactReadiness = evaluateRequiredImplementationArtifacts({
    projectArtifacts: artifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
  });
  const referenceArtifacts = collectReferencePlanningArtifacts(artifacts);
  const quickDesignArtifactsJustGenerated =
    (input.generatedArtifactCount ?? 0) > 0 &&
    referenceArtifacts.length > 0 &&
    Boolean(input.artifactOrchestrationV1?.requiredTypes.length);

  return {
    seedReady: input.readiness.ready && input.prepComplete,
    envOk: input.envOk === true,
    designOk: artifactReadiness.ready || quickDesignArtifactsJustGenerated,
    hasReferenceArtifacts: referenceArtifacts.length > 0,
  };
}

export function resolveImplementationEntrySeedReady(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): boolean {
  if (input.implementationSeedV1?.readiness?.ready) return true;
  if (!input.slotDefinitions?.length) return false;
  return summarizeImplementationSeedStatus({
    orchestration: input.orchestration,
    definitions: input.slotDefinitions,
    lifecycleStatus: input.implementationSeedV1?.lifecycleStatus,
  }).ready;
}

export function evaluateImplementationEntrySurfaceReadiness(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly projectArtifacts?: readonly ProjectArtifact[] | null | undefined;
  readonly envOk: boolean;
  readonly designOk: boolean;
}): ImplementationEntrySurfaceReadiness {
  const referenceArtifacts = collectReferencePlanningArtifacts(input.projectArtifacts);
  const seedReady = resolveImplementationEntrySeedReady({
    implementationSeedV1: input.implementationSeedV1,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
  });
  const taskListReady = isPlanningReadyForImplementationExecution({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
  });

  return {
    seedReady,
    envOk: input.envOk,
    designOk: input.designOk,
    hasReferenceArtifacts: referenceArtifacts.length > 0,
    taskListReady,
  };
}

/** @deprecated Use `ImplementationSurfaceReadiness`. */
export type QuickDesignPostConfirmState = ImplementationSurfaceReadiness;

/** @deprecated Use `evaluateQuickDesignPostConfirmReadiness`. */
export const evaluateQuickDesignPostConfirmState = evaluateQuickDesignPostConfirmReadiness;
