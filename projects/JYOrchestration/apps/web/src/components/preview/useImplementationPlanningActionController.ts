"use client";

import { useCallback } from "react";
import {
  postImplementationPrepSync,
  postQuickDesignConfirm,
} from "@/components/project-spec/apis/quickDesignConfirmApi";
import { appendCreateWorkPlanBootstrapCtaRouteTimeline } from "@/lib/prototype/implementationIntentTimeline";
import { buildCreateImplementationSeedFromQuickDesignDraftResult } from "@/lib/prototype/implementationQuickDesignDraftBridge";
import type { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { pickExecutionStateArtifacts } from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import {
  buildConfirmImplementationTaskPlanResult,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import type { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";

/**
 * Controls implementation-stage planning, seed, and task-list actions.
 *
 * Scope:
 * - create implementation seed from Quick Design draft
 * - confirm Quick Design for implementation
 * - generate implementation task list
 * - generate implementation work-plan draft
 * - confirm implementation task plan
 *
 * Not scope:
 * - DB strategy decisions
 * - CodeTask execution
 * - Quick Run execution
 * - GitHub verification
 * - board rendering
 */
export type ImplementationPlanningActionControllerInput = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly effectiveImplementationState: ReturnType<typeof resolveEffectiveImplementationState>;
  readonly executionArtifacts: ReturnType<typeof pickExecutionStateArtifacts>;
  readonly featureDraftTitles?: readonly string[];
  readonly planningSlotDefinitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly setProtoBusy: (busy: boolean) => void;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
  readonly appendUserNotice: (message: string) => void;
}>;

export type ImplementationPlanningActionControllerValue = Readonly<{
  readonly createImplementationSeedFromQuickDesignDraft: () => ImplementationStageActionRunResult;
  readonly confirmQuickDesignForImplementation: () => ImplementationStageActionRunResult;
  readonly generateImplementationTaskList: () => ImplementationStageActionRunResult;
  readonly generateImplementationWorkPlanDraft: () => ImplementationStageActionRunResult;
  readonly confirmImplementationTaskPlan: () => ImplementationStageActionRunResult;
}>;

export function useImplementationPlanningActionController(
  input: ImplementationPlanningActionControllerInput,
): ImplementationPlanningActionControllerValue {
  const confirmImplementationTaskPlan = useCallback((): ImplementationStageActionRunResult => {
    const pid = input.projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildConfirmImplementationTaskPlanResult({
      projectId: pid,
      requirementsStateJson: input.requirementsStateJson,
      projectArtifacts: input.executionArtifacts.projectArtifacts,
      artifactOrchestrationV1: input.executionArtifacts.artifactOrchestrationV1,
      featureDraftTitles: input.featureDraftTitles ?? [],
      implementationWorkPlanDraftV1: input.effectiveImplementationState.implementationWorkPlanDraftV1,
      envOk: input.effectiveImplementationState.envOk,
      designOk: input.effectiveImplementationState.designOk,
      promptTimeline: input.parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_confirmed") {
      const message = "이미 구현 작업안이 확정되었습니다.";
      return { outcome: "no_op", message };
    }
    input.applyImplementationOrchestrationResult({
      orchestrationPatch: result.orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    input.projectId,
    input.requirementsStateJson,
    input.executionArtifacts,
    input.featureDraftTitles,
    input.effectiveImplementationState,
    input.parsedRequirementsState.promptTimeline,
    input.applyImplementationOrchestrationResult,
  ]);

  const generateImplementationWorkPlanDraft = useCallback((): ImplementationStageActionRunResult => {
    const pid = input.projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildGenerateImplementationWorkPlanDraftResult({
      requirementsStateJson: input.requirementsStateJson,
      projectId: pid,
      projectArtifacts: input.executionArtifacts.projectArtifacts,
      orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: input.planningSlotDefinitions,
      implementationSeedV1: input.parsedRequirementsState.implementationSeedV1,
      envOk: input.envOk,
      designOk: input.designOk,
      promptTimeline: input.parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      return { outcome: "blocked", message: result.message };
    }
    if (result.kind === "already_exists") {
      const message = "이미 구현 작업안 초안이 생성되었습니다.";
      return { outcome: "no_op", message };
    }
    const orchestrationPatch = {
      ...result.orchestrationPatch,
      promptTimeline: appendCreateWorkPlanBootstrapCtaRouteTimeline({
        promptTimeline:
          result.orchestrationPatch.promptTimeline ?? input.parsedRequirementsState.promptTimeline,
      }),
    };
    input.applyImplementationOrchestrationResult({
      orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    input.projectId,
    input.requirementsStateJson,
    input.executionArtifacts.projectArtifacts,
    input.envOk,
    input.designOk,
    input.parsedRequirementsState.promptTimeline,
    input.parsedRequirementsState.singleChatOrchestrationV1,
    input.parsedRequirementsState.implementationSeedV1,
    input.planningSlotDefinitions,
    input.applyImplementationOrchestrationResult,
  ]);

  const createImplementationSeedFromQuickDesignDraft = useCallback((): ImplementationStageActionRunResult => {
    const pid = input.projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    const result = buildCreateImplementationSeedFromQuickDesignDraftResult({
      projectId: pid,
      projectName: input.projectName || "프로젝트",
      fastPlanDraftV1: input.parsedRequirementsState.fastPlanDraftV1,
      orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
      slotDefinitions: input.planningSlotDefinitions,
      promptTimeline: input.parsedRequirementsState.promptTimeline,
    });
    if (result.kind === "blocked") {
      return { outcome: "blocked", message: result.message };
    }
    const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
    input.applyImplementationOrchestrationResult({
      messages: [...(resolved.messages ?? []), ...result.messages],
      orchestrationPatch: result.orchestrationPatch,
    });
    return { outcome: "executed" };
  }, [
    input.projectId,
    input.projectName,
    input.parsedRequirementsState.fastPlanDraftV1,
    input.parsedRequirementsState.singleChatOrchestrationV1,
    input.parsedRequirementsState.promptTimeline,
    input.planningSlotDefinitions,
    input.requirementsStateJson,
    input.applyImplementationOrchestrationResult,
  ]);

  const confirmQuickDesignForImplementation = useCallback((): ImplementationStageActionRunResult => {
    const pid = input.projectId.trim();
    if (!pid) return { outcome: "blocked", message: "프로젝트를 선택해 주세요." };
    void (async () => {
      input.setProtoBusy(true);
      try {
        const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
        const { res, json } = await postQuickDesignConfirm(pid, {
          mode: "implementation",
          projectName: input.projectName || "프로젝트",
          projectDescription: input.projectDescription ?? "",
          requirementsStateJson: input.requirementsStateJson,
          conversationMessages: resolved.messages ?? [],
          slotDefinitions: input.planningSlotDefinitions,
          envOkOverride: input.envOk,
        });
        if (!res.ok || !json.success || !json.data) {
          return;
        }
        input.applyImplementationOrchestrationResult({
          messages: json.data.messages ?? [],
          orchestrationPatch: (json.data.orchestrationPatch ?? {}) as PrototypeExecutionOrchestrationPersistInput,
        });
      } catch {
      } finally {
        input.setProtoBusy(false);
      }
    })();
    return { outcome: "executed" };
  }, [
    input.projectId,
    input.projectName,
    input.projectDescription,
    input.requirementsStateJson,
    input.planningSlotDefinitions,
    input.envOk,
    input.applyImplementationOrchestrationResult,
    input.setProtoBusy,
  ]);

  const generateImplementationTaskList = useCallback((): ImplementationStageActionRunResult => {
    const pid = input.projectId.trim();
    const seed = input.parsedRequirementsState.implementationSeedV1;
    void (async () => {
      const { res, json } = await postImplementationPrepSync(pid, {
        seed,
        existingTaskList: input.parsedRequirementsState.implementationTaskListV1,
        existingCodeTaskPlan: input.parsedRequirementsState.implementationCodeTaskPlanV1,
        existingExecutionState: input.parsedRequirementsState.implementationTaskExecutionStateV1,
        existingCursorWorkItems: input.parsedRequirementsState.cursorWorkItemsV1,
        existingPreflightSummary: input.parsedRequirementsState.implementationWorkItemPreflightSummaryV1,
        existingQualityGate: input.parsedRequirementsState.implementationCodeTaskQualityGateV1,
        priorTimeline: input.parsedRequirementsState.promptTimeline,
        projectArtifacts: input.executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: input.parsedRequirementsState.artifactOrchestrationV1,
        envOk: input.envOk,
        designOk: input.designOk,
        previewReady: input.prototypeRunSyncSnapshot.previewReady,
      });
      const result = json.data;
      if (!res.ok || !json.success || !result?.ok) {
        return;
      }
      void input.persistChatToDb(
        resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson),
        result.patch,
      );
      for (const message of result.messages) {
        input.appendImplementationTaskListAiMessage(message);
      }
    })();
    return { outcome: "executed" };
  }, [
    input.projectId,
    input.parsedRequirementsState,
    input.executionArtifacts,
    input.envOk,
    input.designOk,
    input.prototypeRunSyncSnapshot.previewReady,
    input.persistChatToDb,
    input.requirementsStateJson,
    input.appendImplementationTaskListAiMessage,
  ]);

  return {
    createImplementationSeedFromQuickDesignDraft,
    confirmQuickDesignForImplementation,
    generateImplementationTaskList,
    generateImplementationWorkPlanDraft,
    confirmImplementationTaskPlan,
  };
}
