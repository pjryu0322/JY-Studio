import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  confirmFastPlanDraftSlots,
  type ConfirmFastPlanDraftSlotsResult,
} from "@/lib/requirements/fastPlanDraftConfirmation";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationWorkItemPreflightSummaryV1 } from "@/lib/prototype/implementationPlanningReadiness";
import {
  buildQuickDesignImplementationReadyChatMessage,
  generateQuickDesignConfirmArtifacts,
  mergeQuickDesignArtifactsIntoState,
  patchRequirementsStageForImplementationPrep,
  type QuickDesignConfirmArtifactsResult,
} from "@/lib/requirements/quickDesignConfirmArtifacts";
import {
  runQuickDesignConfirmImplementationPrep,
  runQuickDesignConfirmImplementationPrepWithLlm,
  type QuickDesignConfirmImplementationPrepResult,
} from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import { createProjectLlmCodeTaskRefinementCaller } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinementClient";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type {
  RequirementsOrchestrationStageV1,
  RequirementsPromptTimelineEntry,
} from "@/lib/requirements/requirementsStateJson";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { resolveProjectExecutionEnvOk } from "@/lib/prototype/prototypeExecutionEnvOk";
import type { LlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import type { ProjectCodeTaskRefinementSettings } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettingsShared";

/** Planning-stage snapshot needed to run Quick Design confirm (no UI deps). */
export type QuickDesignConfirmPlanningStateSnapshot = Readonly<{
  readonly featurePlanningSlotsV1: FastPlanGenerationInput["featurePlanning"];
  readonly serviceFlowV1: FastPlanGenerationInput["serviceFlow"];
  readonly projectArtifacts: readonly ProjectArtifact[] | null | undefined;
  readonly deliverableAssets: readonly IdeationDeliverableAsset[] | null | undefined;
  readonly requirementsOrchestrationStageV1: RequirementsOrchestrationStageV1 | null | undefined;
  readonly implementationTaskListV1: ImplementationTaskListV1 | null | undefined;
}>;

export type QuickDesignConfirmFlowInput = Readonly<
  Omit<FastPlanGenerationInput, "nowIso" | "orchestration" | "sourceStage"> & {
    readonly nowIso: string;
    readonly sourceStage: OrchestrationStage;
    readonly fastPlanDraftV1: FastPlanDraftStateV1;
    readonly orchestrationForConfirm: RequirementsSingleChatOrchestrationStateV1;
    readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
    readonly planningState: QuickDesignConfirmPlanningStateSnapshot;
    /** Injected by server API routes with latest ExecutionSetup. */
    readonly refinementSettings?: ProjectCodeTaskRefinementSettings | null;
    readonly providerContext?: LlmCodeTaskRefinementProviderContext | null;
    /** Optional template selection made by user. */
    readonly userSelectedTemplateId?: import("@/lib/templates/prototypeTemplates").PrototypeTemplateType | null;
    /** When set, skips `resolveProjectExecutionEnvOk` (unit tests). */
    readonly envOkOverride?: boolean;
  }
>;

export type QuickDesignConfirmFlowStatePatch = Readonly<{
  readonly fastPlanDraftV1: FastPlanDraftStateV1;
  readonly singleChatOrchestrationV1: RequirementsSingleChatOrchestrationStateV1;
  readonly implementationSeedV1: ImplementationSeedV1;
  readonly planningDataSlotsV1?: import("@/lib/planning/planningDataSlotsV1").PlanningDataSlotsV1;
  readonly planningHandoffForImplementationV1?: import("@/lib/planning/planningDataSlotsV1").PlanningHandoffForImplementationV1;
  readonly implementationTaskListV1?: ImplementationTaskListV1;
  readonly implementationCodeTaskPlanV1?: ImplementationCodeTaskPlanV1;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[];
  readonly implementationWorkItemPreflightSummaryV1?: ImplementationWorkItemPreflightSummaryV1;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
  readonly artifactOrchestrationV1: ArtifactOrchestrationStateV1;
  readonly requirementsOrchestrationStageV1: RequirementsOrchestrationStageV1;
}>;

export type QuickDesignConfirmFlowBlocked = Readonly<{
  readonly kind: "blocked";
  readonly message: string;
}>;

export type QuickDesignConfirmFlowSuccess = Readonly<{
  readonly kind: "success";
  readonly confirm: ConfirmFastPlanDraftSlotsResult;
  readonly artifactBundle: QuickDesignConfirmArtifactsResult;
  readonly prep: QuickDesignConfirmImplementationPrepResult;
  readonly readyMessage: RequirementsMessage;
  readonly statePatch: QuickDesignConfirmFlowStatePatch;
  readonly primaryArtifactId: string;
  readonly userFacingSummary: string;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

export type QuickDesignConfirmFlowResult = QuickDesignConfirmFlowBlocked | QuickDesignConfirmFlowSuccess;

export function buildQuickDesignConfirmStatePatch(input: {
  readonly confirm: ConfirmFastPlanDraftSlotsResult;
  readonly artifactBundle: QuickDesignConfirmArtifactsResult;
  readonly mergedProjectArtifacts: readonly ProjectArtifact[];
  readonly mergedDeliverableAssets: readonly IdeationDeliverableAsset[];
  readonly prep: QuickDesignConfirmImplementationPrepResult;
  readonly existingRequirementsStage: RequirementsOrchestrationStageV1 | null | undefined;
  readonly existingImplementationTaskListV1: ImplementationTaskListV1 | null | undefined;
  readonly nowIso: string;
}): QuickDesignConfirmFlowStatePatch {
  const planningArtifacts = {
    ...(input.prep.implementationCodeTaskPlanV1
      ? { implementationCodeTaskPlanV1: input.prep.implementationCodeTaskPlanV1 }
      : {}),
    ...(input.prep.cursorWorkItemsV1?.length
      ? { cursorWorkItemsV1: [...input.prep.cursorWorkItemsV1] }
      : {}),
    ...(input.prep.implementationWorkItemPreflightSummaryV1
      ? { implementationWorkItemPreflightSummaryV1: input.prep.implementationWorkItemPreflightSummaryV1 }
      : {}),
    ...(input.prep.implementationCodeTaskQualityGateV1
      ? { implementationCodeTaskQualityGateV1: input.prep.implementationCodeTaskQualityGateV1 }
      : {}),
    ...(input.prep.codeTaskPromptContextMapV1
      ? { codeTaskPromptContextMapV1: input.prep.codeTaskPromptContextMapV1 }
      : {}),
  };
  const base: QuickDesignConfirmFlowStatePatch = {
    fastPlanDraftV1: input.confirm.fastPlanDraftV1,
    singleChatOrchestrationV1: input.prep.orchestration,
    implementationSeedV1: input.prep.implementationSeedV1,
    planningDataSlotsV1: input.prep.planningDataSlotsV1,
    planningHandoffForImplementationV1: input.prep.planningHandoffForImplementationV1,
    projectArtifacts: [...input.mergedProjectArtifacts],
    deliverableAssets: [...input.mergedDeliverableAssets],
    artifactOrchestrationV1: input.artifactBundle.artifactOrchestrationV1,
    requirementsOrchestrationStageV1: patchRequirementsStageForImplementationPrep({
      existing: input.existingRequirementsStage,
      nowIso: input.nowIso,
    }),
    ...planningArtifacts,
  };
  const nextTaskList = input.prep.implementationTaskListV1;
  const nextHasFrame = Boolean(nextTaskList?.tasks?.some((t) => t.taskId === "DEV-FRAME-001"));
  const existingHasFrame = Boolean(
    input.existingImplementationTaskListV1?.tasks?.some((t) => t.taskId === "DEV-FRAME-001"),
  );
  const shouldPatchTaskList =
    input.existingImplementationTaskListV1 == null || (nextHasFrame && !existingHasFrame);
  if (!shouldPatchTaskList) return base;
  return {
    ...base,
    implementationTaskListV1: input.prep.implementationTaskListV1 ?? undefined,
  };
}

/** Slot confirm + artifacts + implementation prep. Env resolved in `runQuickDesignConfirmFlow`. */
export async function runQuickDesignConfirmFlowWithPrep(input: {
  readonly flow: QuickDesignConfirmFlowInput;
  readonly envOk: boolean;
}): Promise<QuickDesignConfirmFlowResult> {
  const { flow, envOk } = input;
  const confirm = confirmFastPlanDraftSlots({
    fastPlanDraftV1: flow.fastPlanDraftV1,
    orchestration: flow.orchestrationForConfirm,
    definitions: flow.slotDefinitions,
    nowIso: flow.nowIso,
    projectId: flow.projectId,
    onlyPatchedSlotKeys: true,
  });
  if (confirm.blocked) {
    return {
      kind: "blocked",
      message: confirm.blockReason ?? "확정할 Quick Design 초안 정보를 찾을 수 없습니다.",
    };
  }

  const st = flow.planningState;
  const artifactBundle = generateQuickDesignConfirmArtifacts({
    projectId: flow.projectId,
    projectName: flow.projectName,
    projectDescription: flow.projectDescription,
    conversationMessages: flow.conversationMessages,
    serviceFlow: flow.serviceFlow ?? st.serviceFlowV1 ?? null,
    orchestration: confirm.orchestration,
    slotDefinitions: flow.slotDefinitions,
    featurePlanning: st.featurePlanningSlotsV1 ?? null,
    problemInterview: flow.problemInterview,
    sourceStage: flow.sourceStage,
    nowIso: flow.nowIso,
    fastPlanDraftV1: confirm.fastPlanDraftV1,
  });

  const merged = mergeQuickDesignArtifactsIntoState({
    priorArtifacts: st.projectArtifacts,
    priorDeliverables: st.deliverableAssets,
    newArtifacts: artifactBundle.artifacts,
    projectId: flow.projectId,
    replacedTypes: artifactBundle.artifactOrchestrationV1.requiredTypes,
  });

  const prep = await runQuickDesignConfirmImplementationPrepWithLlm({
    projectId: flow.projectId,
    projectName: flow.projectName,
    projectDescription: flow.projectDescription,
    userSelectedTemplateId: flow.userSelectedTemplateId,
    orchestration: confirm.orchestration,
    definitions: flow.slotDefinitions,
    nowIso: flow.nowIso,
    generatedArtifactCount: artifactBundle.artifacts.length,
    envOk,
    projectArtifacts: merged.projectArtifacts,
    artifactOrchestrationV1: artifactBundle.artifactOrchestrationV1,
    existingTaskList: st.implementationTaskListV1,
    llmCaller: flow.providerContext?.apiKey
      ? undefined
      : createProjectLlmCodeTaskRefinementCaller(flow.projectId),
    refinementSettings: flow.refinementSettings,
    providerContext: flow.providerContext,
  });

  const readyMessage = buildQuickDesignImplementationReadyChatMessage({
    artifactIds: artifactBundle.artifactIds,
    artifactTitles: artifactBundle.artifacts.map((a) => a.title),
    planningSummary: artifactBundle.artifactOrchestrationV1.planningSummary,
    nowIso: flow.nowIso,
    prep,
    definitions: flow.slotDefinitions,
  });

  const statePatch = buildQuickDesignConfirmStatePatch({
    confirm,
    artifactBundle,
    mergedProjectArtifacts: merged.projectArtifacts,
    mergedDeliverableAssets: merged.deliverableAssets,
    prep,
    existingRequirementsStage: st.requirementsOrchestrationStageV1,
    existingImplementationTaskListV1: st.implementationTaskListV1,
    nowIso: flow.nowIso,
  });

  return {
    kind: "success",
    confirm,
    artifactBundle,
    prep,
    readyMessage,
    statePatch,
    primaryArtifactId: artifactBundle.primaryArtifactId,
    userFacingSummary: artifactBundle.userFacingSummary,
    timelineEntries: [confirm.timelineEntry, ...prep.timelineEntries],
  };
}

/** Slot confirm + artifacts + implementation prep (sync). Env resolved in `runQuickDesignConfirmFlow`. */
export function runQuickDesignConfirmFlowSync(input: {
  readonly flow: QuickDesignConfirmFlowInput;
  readonly envOk: boolean;
}): QuickDesignConfirmFlowResult {
  const { flow, envOk } = input;
  const confirm = confirmFastPlanDraftSlots({
    fastPlanDraftV1: flow.fastPlanDraftV1,
    orchestration: flow.orchestrationForConfirm,
    definitions: flow.slotDefinitions,
    nowIso: flow.nowIso,
    projectId: flow.projectId,
    onlyPatchedSlotKeys: true,
  });
  if (confirm.blocked) {
    return {
      kind: "blocked",
      message: confirm.blockReason ?? "확정할 Quick Design 초안 정보를 찾을 수 없습니다.",
    };
  }

  const st = flow.planningState;
  const artifactBundle = generateQuickDesignConfirmArtifacts({
    projectId: flow.projectId,
    projectName: flow.projectName,
    projectDescription: flow.projectDescription,
    conversationMessages: flow.conversationMessages,
    serviceFlow: flow.serviceFlow ?? st.serviceFlowV1 ?? null,
    orchestration: confirm.orchestration,
    slotDefinitions: flow.slotDefinitions,
    featurePlanning: st.featurePlanningSlotsV1 ?? null,
    problemInterview: flow.problemInterview,
    sourceStage: flow.sourceStage,
    nowIso: flow.nowIso,
    fastPlanDraftV1: confirm.fastPlanDraftV1,
  });

  const merged = mergeQuickDesignArtifactsIntoState({
    priorArtifacts: st.projectArtifacts,
    priorDeliverables: st.deliverableAssets,
    newArtifacts: artifactBundle.artifacts,
    projectId: flow.projectId,
    replacedTypes: artifactBundle.artifactOrchestrationV1.requiredTypes,
  });

  const prep = runQuickDesignConfirmImplementationPrep({
    projectId: flow.projectId,
    projectName: flow.projectName,
    projectDescription: flow.projectDescription,
    userSelectedTemplateId: flow.userSelectedTemplateId,
    orchestration: confirm.orchestration,
    definitions: flow.slotDefinitions,
    nowIso: flow.nowIso,
    generatedArtifactCount: artifactBundle.artifacts.length,
    envOk,
    projectArtifacts: merged.projectArtifacts,
    artifactOrchestrationV1: artifactBundle.artifactOrchestrationV1,
    existingTaskList: st.implementationTaskListV1,
    sampleDataSpecV1: st.sampleDataSpecV1 ?? null,
    planningStateJson: st,
  });

  const readyMessage = buildQuickDesignImplementationReadyChatMessage({
    artifactIds: artifactBundle.artifactIds,
    artifactTitles: artifactBundle.artifacts.map((a) => a.title),
    planningSummary: artifactBundle.artifactOrchestrationV1.planningSummary,
    nowIso: flow.nowIso,
    prep,
    definitions: flow.slotDefinitions,
  });

  const statePatch = buildQuickDesignConfirmStatePatch({
    confirm,
    artifactBundle,
    mergedProjectArtifacts: merged.projectArtifacts,
    mergedDeliverableAssets: merged.deliverableAssets,
    prep,
    existingRequirementsStage: st.requirementsOrchestrationStageV1,
    existingImplementationTaskListV1: st.implementationTaskListV1,
    nowIso: flow.nowIso,
  });

  return {
    kind: "success",
    confirm,
    artifactBundle,
    prep,
    readyMessage,
    statePatch,
    primaryArtifactId: artifactBundle.primaryArtifactId,
    userFacingSummary: artifactBundle.userFacingSummary,
    timelineEntries: [confirm.timelineEntry, ...prep.timelineEntries],
  };
}

/** End-to-end planning-stage Quick Design confirm (TaskList-centric; no work plan draft). */
export async function runQuickDesignConfirmFlow(
  input: QuickDesignConfirmFlowInput,
): Promise<QuickDesignConfirmFlowResult> {
  const envOk =
    input.envOkOverride ??
    (await resolveProjectExecutionEnvOk(input.projectId));
  return runQuickDesignConfirmFlowWithPrep({ flow: input, envOk });
}
