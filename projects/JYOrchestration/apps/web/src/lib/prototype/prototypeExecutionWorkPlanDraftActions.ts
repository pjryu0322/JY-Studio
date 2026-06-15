import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import {
  buildImplementationWorkPlanDraft,
  buildImplementationWorkPlanDraftConfirmedTimelineEntry,
  buildImplementationWorkPlanDraftTimelineEntry,
  buildWorkPlanDraftMessage,
  collectReferencePlanningArtifacts,
  hasImplementationWorkPlanDraftMessage,
  implementationWorkPlanDraftChips,
  IMPLEMENTATION_WORK_PLAN_BLOCKED_NO_PLANNING_ARTIFACTS_MESSAGE,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import { prioritizeImplementationChipsForState } from "@/lib/prototype/implementationStageNextActions";
import { evaluatePlanningArtifactReadiness } from "@/lib/prototype/planningArtifactReadiness";
import {
  mergeUserFeedbackPatchesIntoWorkPlanDraft,
  parseImplementationUserFeedbackPatchesV1,
} from "@/lib/prototype/implementationUserFeedback";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  buildImplementationSeedFromPlanning,
  buildImplementationSeedUsedForWorkPlanTimelineEntry,
  buildImplementationWorkPlanDraftBlockedBySeedMessage,
  evaluateImplementationSeedReadiness,
  summarizeImplementationSeedStatus,
  type ImplementationSeedV1,
} from "@/lib/requirements/implementationSeed";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type GenerateWorkPlanDraftResult =
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{ readonly kind: "already_exists" }>
  | Readonly<{
      readonly kind: "created";
      readonly draft: ImplementationWorkPlanDraftV1;
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: {
        readonly implementationWorkPlanDraftV1: ImplementationWorkPlanDraftV1;
        readonly implementationSeedV1: ImplementationSeedV1;
        readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
      };
    }>;

function resolveSeedForWorkPlanDraft(input: {
  readonly requirementsStateJson: Record<string, unknown>;
  readonly projectId: string;
  readonly orchestration: import("@/lib/requirements/singleChatOrchestrationTypes").RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly existingSeed?: ImplementationSeedV1 | null;
}): ImplementationSeedV1 | null {
  const existing = input.existingSeed;
  if (existing?.readiness.ready && existing.lifecycleStatus !== "candidate") {
    return existing;
  }
  const readiness = evaluateImplementationSeedReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  if (!readiness.ready) return null;
  return buildImplementationSeedFromPlanning({
    projectId: input.projectId,
    orchestration: input.orchestration,
    definitions: input.definitions,
    lifecycleStatus: "confirmed",
    sampleDataSpecV1: parseRequirementsStateJson(input.requirementsStateJson).sampleDataSpecV1 ?? undefined,
  });
}

export function buildGenerateImplementationWorkPlanDraftResult(input: {
  readonly requirementsStateJson: unknown;
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly orchestration?: import("@/lib/requirements/singleChatOrchestrationTypes").RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): GenerateWorkPlanDraftResult {
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];
  if (hasImplementationWorkPlanDraftMessage(prior)) {
    return { kind: "already_exists" };
  }

  if (!collectReferencePlanningArtifacts(input.projectArtifacts).length) {
    const planningReadiness = evaluatePlanningArtifactReadiness({
      projectArtifacts: input.projectArtifacts,
      orchestration: input.orchestration,
      slotDefinitions: input.slotDefinitions,
      implementationSeedV1: input.implementationSeedV1,
    });
    if (planningReadiness.status === "quick_design_draft_unconfirmed") {
      return {
        kind: "blocked",
        message:
          "Quick Design 초안은 생성되었지만 아직 확정되지 않았습니다. [Quick Design 확정] 또는 [초안 기준 구현 Seed 생성]을 선택해 주세요.",
      };
    }
    return {
      kind: "blocked",
      message: IMPLEMENTATION_WORK_PLAN_BLOCKED_NO_PLANNING_ARTIFACTS_MESSAGE,
    };
  }

  const stateRecord =
    input.requirementsStateJson && typeof input.requirementsStateJson === "object"
      ? (input.requirementsStateJson as Record<string, unknown>)
      : {};
  const orchestration =
    input.orchestration ??
    (stateRecord.singleChatOrchestrationV1 as import("@/lib/requirements/singleChatOrchestrationTypes").RequirementsSingleChatOrchestrationStateV1 | null) ??
    null;
  const definitions = input.slotDefinitions ?? [];

  const seed = resolveSeedForWorkPlanDraft({
    requirementsStateJson: stateRecord,
    projectId: input.projectId,
    orchestration,
    definitions,
    existingSeed: input.implementationSeedV1 ?? null,
  });

  if (!seed?.readiness.ready) {
    const summary = summarizeImplementationSeedStatus({
      orchestration,
      definitions,
      lifecycleStatus: input.implementationSeedV1?.lifecycleStatus,
    });
    return {
      kind: "blocked",
      message: buildImplementationWorkPlanDraftBlockedBySeedMessage(summary),
    };
  }

  const feedbackPatches =
    parseImplementationUserFeedbackPatchesV1(stateRecord.implementationUserFeedbackPatchesV1) ?? [];
  const draftBase = buildImplementationWorkPlanDraft({
    projectId: input.projectId,
    projectArtifacts: input.projectArtifacts,
    seed,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: input.nowIso,
  });
  const draft =
    feedbackPatches.length > 0
      ? mergeUserFeedbackPatchesIntoWorkPlanDraft(draftBase, feedbackPatches)
      : draftBase;
  const effectiveState = resolveEffectiveImplementationState({
    parsedRequirementsState: {
      implementationSeedV1: seed,
      implementationWorkPlanDraftV1: draft,
      implementationTaskPlanV1: stateRecord.implementationTaskPlanV1 ?? null,
    },
    pendingPatch: {},
    envOk: input.envOk,
    designOk: input.designOk,
  });
  const draftMsg = buildWorkPlanDraftMessage(draft, {
    nowIso: input.nowIso,
    interviewSuggestions: prioritizeImplementationChipsForState(
      implementationWorkPlanDraftChips(),
      effectiveState,
    ),
  });
  const timeline = appendPromptTimeline(
    appendPromptTimeline(
      input.promptTimeline,
      buildImplementationSeedUsedForWorkPlanTimelineEntry({ seed, nowIso: input.nowIso }),
    ),
    buildImplementationWorkPlanDraftTimelineEntry({ draft, nowIso: input.nowIso }),
  );

  return {
    kind: "created",
    draft,
    messages: [...prior, draftMsg],
    orchestrationPatch: {
      implementationWorkPlanDraftV1: draft,
      implementationSeedV1: seed,
      promptTimeline: timeline,
    },
  };
}

/** @deprecated internal — definitions required for seed gate */
export function orchestrationHasImplementationSeedSlotDefinitions(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): boolean {
  return Boolean(findOrchestrationSlotKeysBySuffix(definitions, ".flow.actorFunctionMatrix")[0]);
}

export function markImplementationWorkPlanDraftConfirmed(
  draft: ImplementationWorkPlanDraftV1,
  nowIso?: string,
): ImplementationWorkPlanDraftV1 {
  const now = nowIso ?? new Date().toISOString();
  return { ...draft, status: "confirmed", updatedAt: now };
}

export function buildWorkPlanDraftConfirmedTimeline(
  draft: ImplementationWorkPlanDraftV1,
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | undefined,
  nowIso?: string,
): readonly RequirementsPromptTimelineEntry[] {
  return appendPromptTimeline(
    promptTimeline,
    buildImplementationWorkPlanDraftConfirmedTimelineEntry({ draft, nowIso }),
  );
}
