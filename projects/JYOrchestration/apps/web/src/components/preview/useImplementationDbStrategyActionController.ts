"use client";

import { useCallback } from "react";
import {
  ensureImplementationArtifactsFromTaskList,
  ensureImplementationTaskPlan,
  ensureMockImplementationReady,
} from "@/lib/prototype/implementationAutoProgress";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { pickExecutionStateArtifacts } from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import {
  buildDataModelDraftResult,
  buildDbIntegrationReviewResult,
  buildMockImplementationModeResult,
} from "@/lib/prototype/prototypeExecutionDbStrategyActions";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";

/**
 * Controls implementation-stage DB strategy actions.
 *
 * Scope:
 * - review DB integration need
 * - generate data model draft
 * - confirm mock implementation mode
 * - ensure prerequisite implementation slots/task plan when needed
 *
 * Not scope:
 * - planning seed creation
 * - CodeTask execution
 * - Quick Run execution
 * - GitHub verification
 * - board rendering
 */
export type ImplementationDbStrategyActionControllerInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly effectiveImplementationState: ReturnType<typeof resolveEffectiveImplementationState>;
  readonly executionArtifacts: ReturnType<typeof pickExecutionStateArtifacts>;
  readonly planningSlotDefinitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly canRequestGenerationEnvOk: boolean;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly appendUserNotice: (message: string) => void;
}>;

export type ImplementationDbStrategyActionControllerValue = Readonly<{
  readonly reviewDbIntegrationNeed: () => ImplementationStageActionRunResult;
  readonly generateDataModelDraft: () => ImplementationStageActionRunResult;
  readonly confirmMockImplementationMode: () => ImplementationStageActionRunResult;
}>;

export function useImplementationDbStrategyActionController(
  input: ImplementationDbStrategyActionControllerInput,
): ImplementationDbStrategyActionControllerValue {
  const applyDbStrategyResult = useCallback(
    (
      result:
        | ReturnType<typeof buildDbIntegrationReviewResult>
        | ReturnType<typeof buildDataModelDraftResult>
        | ReturnType<typeof buildMockImplementationModeResult>,
    ): ImplementationStageActionRunResult => {
      if (result.kind === "blocked") {
        return { outcome: "blocked", message: result.message };
      }
      input.applyImplementationOrchestrationResult({
        messages: result.messages,
        orchestrationPatch: result.orchestrationPatch,
      });
      return { outcome: "executed" };
    },
    [input.applyImplementationOrchestrationResult],
  );

  const reviewDbIntegrationNeed = useCallback((): ImplementationStageActionRunResult => {
    let slots = input.parsedRequirementsState.implementationSlotsV1;
    if (!slots) {
      const ensured = ensureImplementationTaskPlan({
        requirementsStateJson: input.requirementsStateJson,
        effectiveState: input.effectiveImplementationState,
        ensureDraftInput: {
          requirementsStateJson: input.requirementsStateJson,
          projectId: input.projectId.trim(),
          projectArtifacts: input.executionArtifacts.projectArtifacts,
          orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
          slotDefinitions: input.planningSlotDefinitions,
          envOk: input.canRequestGenerationEnvOk,
          promptTimeline: input.parsedRequirementsState.promptTimeline,
        },
        confirmTaskPlanInput: {
          projectId: input.projectId.trim(),
          requirementsStateJson: input.requirementsStateJson,
          projectArtifacts: input.executionArtifacts.projectArtifacts,
          artifactOrchestrationV1: input.parsedRequirementsState.artifactOrchestrationV1,
          featureDraftTitles: input.parsedRequirementsState.featureDraftTitles,
          envOk: input.canRequestGenerationEnvOk,
          designOk: true,
          promptTimeline: input.parsedRequirementsState.promptTimeline,
        },
      });

      if (!ensured.ok || !ensured.patch) {
        const message = ensured.message ?? "구현 작업안을 자동으로 준비할 수 없습니다.";
        return { outcome: "blocked", message };
      }

      const current = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
      input.applyImplementationOrchestrationResult({
        messages: ensured.messages ?? (current.messages ?? []),
        orchestrationPatch: ensured.patch,
      });
      slots = ensured.patch.implementationSlotsV1 as typeof slots;
    }

    return applyDbStrategyResult(
      buildDbIntegrationReviewResult({
        requirementsStateJson: input.requirementsStateJson,
        implementationSlotsV1: slots,
        implementationDbStrategyV1: input.parsedRequirementsState.implementationDbStrategyV1,
        implementationTaskPlanV1: input.effectiveImplementationState.implementationTaskPlanV1,
        projectArtifacts: input.executionArtifacts.projectArtifacts,
        promptTimeline: input.parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    input.requirementsStateJson,
    input.projectId,
    input.parsedRequirementsState.implementationSlotsV1,
    input.parsedRequirementsState.implementationDbStrategyV1,
    input.effectiveImplementationState.implementationTaskPlanV1,
    input.effectiveImplementationState,
    input.parsedRequirementsState.promptTimeline,
    input.executionArtifacts.projectArtifacts,
    input.parsedRequirementsState.singleChatOrchestrationV1,
    input.parsedRequirementsState.artifactOrchestrationV1,
    input.parsedRequirementsState.featureDraftTitles,
    input.planningSlotDefinitions,
    input.canRequestGenerationEnvOk,
    input.applyImplementationOrchestrationResult,
  ]);

  const generateDataModelDraft = useCallback((): ImplementationStageActionRunResult => {
    return applyDbStrategyResult(
      buildDataModelDraftResult({
        requirementsStateJson: input.requirementsStateJson,
        implementationSlotsV1: input.parsedRequirementsState.implementationSlotsV1,
        implementationDbStrategyV1: input.parsedRequirementsState.implementationDbStrategyV1,
        promptTimeline: input.parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    input.requirementsStateJson,
    input.parsedRequirementsState.implementationSlotsV1,
    input.parsedRequirementsState.implementationDbStrategyV1,
    input.parsedRequirementsState.promptTimeline,
  ]);

  const confirmMockImplementationMode = useCallback((): ImplementationStageActionRunResult => {
    let slots = input.parsedRequirementsState.implementationSlotsV1;
    if (!slots) {
      const taskListEnsured = ensureImplementationArtifactsFromTaskList({
        requirementsStateJson: input.requirementsStateJson,
        effectiveState: input.effectiveImplementationState,
        projectId: input.projectId.trim(),
        projectArtifacts: input.executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: input.parsedRequirementsState.artifactOrchestrationV1,
        envOk: input.canRequestGenerationEnvOk,
        designOk: true,
        envCursorBadge: input.canRequestGenerationEnvOk ? "ok" : "needs",
        promptTimeline: input.parsedRequirementsState.promptTimeline,
      });
      if (taskListEnsured.ok && taskListEnsured.patch) {
        const current = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
        input.applyImplementationOrchestrationResult({
          messages: taskListEnsured.messages ?? (current.messages ?? []),
          orchestrationPatch: taskListEnsured.patch,
        });
        slots = taskListEnsured.patch.implementationSlotsV1 as typeof slots;
      }
    }
    if (!slots) {
      const ensured = ensureMockImplementationReady({
        requirementsStateJson: input.requirementsStateJson,
        effectiveState: input.effectiveImplementationState,
        ensureTaskPlanInput: {
          requirementsStateJson: input.requirementsStateJson,
          effectiveState: input.effectiveImplementationState,
          ensureDraftInput: {
            requirementsStateJson: input.requirementsStateJson,
            projectId: input.projectId.trim(),
            projectArtifacts: input.executionArtifacts.projectArtifacts,
            orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
            slotDefinitions: input.planningSlotDefinitions,
            envOk: input.canRequestGenerationEnvOk,
            promptTimeline: input.parsedRequirementsState.promptTimeline,
          },
          confirmTaskPlanInput: {
            projectId: input.projectId.trim(),
            requirementsStateJson: input.requirementsStateJson,
            projectArtifacts: input.executionArtifacts.projectArtifacts,
            artifactOrchestrationV1: input.parsedRequirementsState.artifactOrchestrationV1,
            featureDraftTitles: input.parsedRequirementsState.featureDraftTitles,
            envOk: input.canRequestGenerationEnvOk,
            designOk: true,
            promptTimeline: input.parsedRequirementsState.promptTimeline,
          },
        },
        promptTimeline: input.parsedRequirementsState.promptTimeline,
      });

      if (!ensured.ok || !ensured.patch) {
        const message = ensured.message ?? "구현 작업안을 자동으로 준비할 수 없습니다.";
        return { outcome: "blocked", message };
      }

      const current = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
      input.applyImplementationOrchestrationResult({
        messages: ensured.messages ?? (current.messages ?? []),
        orchestrationPatch: ensured.patch,
      });
      slots = ensured.patch.implementationSlotsV1 as typeof slots;
    }

    return applyDbStrategyResult(
      buildMockImplementationModeResult({
        requirementsStateJson: input.requirementsStateJson,
        implementationSlotsV1: slots,
        implementationDbStrategyV1: input.parsedRequirementsState.implementationDbStrategyV1,
        promptTimeline: input.parsedRequirementsState.promptTimeline,
      }),
    );
  }, [
    applyDbStrategyResult,
    input.requirementsStateJson,
    input.projectId,
    input.parsedRequirementsState.implementationSlotsV1,
    input.parsedRequirementsState.implementationDbStrategyV1,
    input.parsedRequirementsState.promptTimeline,
    input.effectiveImplementationState,
    input.executionArtifacts.projectArtifacts,
    input.parsedRequirementsState.singleChatOrchestrationV1,
    input.parsedRequirementsState.artifactOrchestrationV1,
    input.parsedRequirementsState.featureDraftTitles,
    input.planningSlotDefinitions,
    input.canRequestGenerationEnvOk,
    input.applyImplementationOrchestrationResult,
  ]);

  return {
    reviewDbIntegrationNeed,
    generateDataModelDraft,
    confirmMockImplementationMode,
  };
}
