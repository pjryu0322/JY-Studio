/**
 * Fast prototype plan generation — current conversation + slot context (non-strict gate).
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

export type FastPlanGenerationMode = "fast_plan_from_current_context";

export type FastPlanSlotConfidence = "confirmed" | "partial" | "candidate" | "assumed_for_prototype";

export type FastPlanAssumption = Readonly<{
  readonly slotKey: string;
  readonly label: string;
  readonly value: string;
  readonly confidence: FastPlanSlotConfidence;
  readonly reason: string;
}>;

export type FastPlanGenerationInput = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly conversationMessages: readonly unknown[];
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly featurePlanning: FeaturePlanningSlotsArtifactV1 | null;
  readonly problemInterview: ProblemInterviewState | null;
  readonly sourceStage?: string | null;
  readonly nowIso: string;
}>;

export type FastPlanFieldSnapshot = Readonly<{
  readonly label: string;
  readonly value: string;
  readonly confidence: FastPlanSlotConfidence;
  readonly slotKey: string | null;
}>;

export type FastPlanGenerationContext = Readonly<{
  readonly mode: FastPlanGenerationMode;
  readonly summary: string;
  readonly servicePurpose: FastPlanFieldSnapshot;
  readonly coreUsers: FastPlanFieldSnapshot;
  readonly coreProblem: FastPlanFieldSnapshot;
  readonly expectedOutcome: FastPlanFieldSnapshot;
  readonly featureCandidates: readonly string[];
  readonly flowSteps: readonly string[];
  readonly screenCandidates: readonly string[];
  readonly assumptions: readonly FastPlanAssumption[];
  readonly missingAtGeneration: readonly string[];
}>;

export type FastPlanGenerationStateV1 = Readonly<{
  readonly mode: FastPlanGenerationMode;
  readonly generatedAt: string;
  readonly source: "current_conversation_and_slots";
  readonly assumptions: readonly FastPlanAssumption[];
  readonly missingAtGeneration: readonly string[];
  readonly artifactId: string;
}>;

export type FastPlanGenerationResult = Readonly<{
  readonly mode: FastPlanGenerationMode;
  readonly context: FastPlanGenerationContext;
  readonly artifact: ProjectArtifact;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly fastPlanGenerationV1: FastPlanGenerationStateV1;
  readonly userFacingSummary: string;
}>;
