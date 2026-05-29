import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { resolveImplementationEntrySeedReady } from "@/lib/requirements/implementationReadinessGates";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import { collectReferencePlanningArtifacts } from "@/lib/prototype/implementationWorkPlanDraft";

export type PlanningArtifactReadiness =
  | Readonly<{
      readonly status: "confirmed_artifacts_ready";
      readonly canStartImplementation: true;
    }>
  | Readonly<{
      readonly status: "quick_design_draft_unconfirmed";
      readonly canStartImplementation: false;
      readonly canPromoteQuickDesign: true;
    }>
  | Readonly<{
      readonly status: "missing_planning_artifacts";
      readonly canStartImplementation: false;
      readonly canPromoteQuickDesign: false;
    }>;

export function hasQuickDesignDraftInState(
  fastPlanDraftV1: FastPlanDraftStateV1 | null | undefined,
): boolean {
  if (!fastPlanDraftV1) return false;
  if ((fastPlanDraftV1.memberDrafts?.length ?? 0) > 0) return true;
  const patch = fastPlanDraftV1.slotCandidatePatch;
  if (!patch) return false;
  return (
    (patch.patchedSlotKeys?.length ?? 0) > 0 ||
    (patch.candidateSlotKeys?.length ?? 0) > 0 ||
    (patch.updatedSlotKeys?.length ?? 0) > 0
  );
}

export function hasQuickDesignSlotsPatchedInTimeline(
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): boolean {
  return (promptTimeline ?? []).some((entry) => entry.action === "quick_design_slots_patched");
}

export function hasQuickDesignDraftCreatedInTimeline(
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): boolean {
  return (promptTimeline ?? []).some((entry) => entry.action === "quick_design_draft_created");
}

export function hasQuickDesignConfirmedInTimeline(
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): boolean {
  return (promptTimeline ?? []).some((entry) => entry.action === "quick_design_confirmed");
}

export function hasQuickDesignCandidateSlots(input: {
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): boolean {
  const orchestration = input.orchestration;
  const definitions = input.slotDefinitions ?? [];
  if (!orchestration?.slots || !definitions.length) return false;
  return definitions.some((def) => {
    const row = orchestration.slots[def.key];
    if (!row) return false;
    return row.status === "candidate" && String(row.value ?? "").trim().length > 0;
  });
}

export function detectQuickDesignDraftPresence(input: {
  readonly fastPlanDraftV1?: FastPlanDraftStateV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): boolean {
  if (hasQuickDesignDraftInState(input.fastPlanDraftV1)) return true;
  if (
    (hasQuickDesignDraftCreatedInTimeline(input.promptTimeline) ||
      hasQuickDesignSlotsPatchedInTimeline(input.promptTimeline)) &&
    !hasQuickDesignConfirmedInTimeline(input.promptTimeline)
  ) {
    return true;
  }
  return hasQuickDesignCandidateSlots({
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
  });
}

export function evaluatePlanningArtifactReadiness(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly fastPlanDraftV1?: FastPlanDraftStateV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): PlanningArtifactReadiness {
  const hasReferenceArtifacts = collectReferencePlanningArtifacts(input.projectArtifacts ?? []).length > 0;
  const hasPersistedSeed = Boolean(input.implementationSeedV1);
  const hasTaskPlan = Boolean(input.implementationTaskPlanV1);
  const seedReadyFromSlots = resolveImplementationEntrySeedReady({
    implementationSeedV1: input.implementationSeedV1,
    orchestration: input.orchestration ?? { slots: {}, updatedAt: "" },
    slotDefinitions: input.slotDefinitions,
  });

  if (hasReferenceArtifacts || hasPersistedSeed || hasTaskPlan || seedReadyFromSlots) {
    return { status: "confirmed_artifacts_ready", canStartImplementation: true };
  }

  if (
    detectQuickDesignDraftPresence({
      fastPlanDraftV1: input.fastPlanDraftV1,
      promptTimeline: input.promptTimeline,
      orchestration: input.orchestration,
      slotDefinitions: input.slotDefinitions,
    })
  ) {
    return {
      status: "quick_design_draft_unconfirmed",
      canStartImplementation: false,
      canPromoteQuickDesign: true,
    };
  }

  return {
    status: "missing_planning_artifacts",
    canStartImplementation: false,
    canPromoteQuickDesign: false,
  };
}
