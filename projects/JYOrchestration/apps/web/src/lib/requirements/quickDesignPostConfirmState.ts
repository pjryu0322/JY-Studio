import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ImplementationSeedReadiness } from "@/lib/requirements/implementationSeed";
import {
  evaluateRequiredImplementationArtifacts,
} from "@/lib/requirements/planningReadinessGate";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { collectReferencePlanningArtifacts } from "@/lib/prototype/implementationWorkPlanDraft";

export type QuickDesignPostConfirmState = Readonly<{
  readonly seedReady: boolean;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly hasReferenceArtifacts: boolean;
}>;

export function evaluateQuickDesignPostConfirmState(input: {
  readonly readiness: ImplementationSeedReadiness;
  readonly prepComplete: boolean;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk?: boolean;
  readonly generatedArtifactCount?: number;
}): QuickDesignPostConfirmState {
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
