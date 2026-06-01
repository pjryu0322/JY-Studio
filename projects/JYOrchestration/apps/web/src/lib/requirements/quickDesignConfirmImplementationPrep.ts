import {
  formatImplementationCandidateSummaryLines,
  resolveImplementationCandidateGapKeys,
} from "@/lib/requirements/implementationCandidateLabels";
import {
  buildImplementationSeedCandidateSlotPatches,
  buildImplementationSeedFromPlanning,
  evaluateImplementationSeedAutoConfirmEligibility,
  evaluateImplementationSeedReadiness,
  IMPLEMENTATION_SEED_GAP_LABELS,
  promoteImplementationSeedRequiredSlotsToConfirmed,
  type ImplementationSeedGapKey,
  type ImplementationSeedLifecycleStatus,
  type ImplementationSeedReadiness,
  type ImplementationSeedV1,
} from "@/lib/requirements/implementationSeed";
import {
  evaluateQuickDesignPostConfirmReadiness,
  type ImplementationSurfaceReadiness,
} from "@/lib/requirements/implementationReadinessGates";
import { quickDesignPostConfirmChipLabelsForState } from "@/lib/requirements/implementationUxLabels";
import {
  buildImplementationPlanningReadinessPatch,
  buildImplementationPlanningReadinessPatchWithLlm,
  type ImplementationWorkItemPreflightSummaryV1,
} from "@/lib/prototype/implementationPlanningReadiness";
import type { LlmCodeTaskRefinementCaller } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import { createProjectLlmCodeTaskRefinementCaller } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinementClient";
import type { LlmCodeTaskRefinementProviderContext } from "@/lib/prototype/implementationCodeTaskPlanLlmProvider";
import type { ProjectCodeTaskRefinementSettings } from "@/lib/prototype/resolveProjectCodeTaskRefinementSettingsShared";
import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildImplementationTaskListFromSeed,
  isPlanningReadyForImplementationExecution,
  summarizeImplementationTaskRoles,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type QuickDesignConfirmImplementationPrepResult = Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly implementationSeedV1: ImplementationSeedV1;
  readonly implementationTaskListV1: ImplementationTaskListV1 | null;
  readonly implementationCodeTaskPlanV1: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItemsV1: readonly CursorWorkItem[] | null;
  readonly implementationWorkItemPreflightSummaryV1: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly implementationCodeTaskQualityGateV1: ImplementationCodeTaskQualityGateV1 | null;
  readonly readiness: ImplementationSeedReadiness;
  readonly lifecycleStatus: ImplementationSeedLifecycleStatus;
  readonly autoCandidateGenerated: boolean;
  readonly autoConfirmedRequired: boolean;
  readonly touchedGapKeys: readonly ImplementationSeedGapKey[];
  readonly chipLabels: readonly string[];
  readonly prepComplete: boolean;
  readonly postConfirmState: ImplementationSurfaceReadiness;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

function buildImplementationTaskListAutoCreatedTimelineEntry(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  const roles = input.taskList.roleSummary;
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_confirmed_implementation_task_list_auto_created",
    source: "system",
    responseText: [
      "type=implementation_task_list_auto_created",
      "mode=planning",
      "source=quick_design_confirm",
      `taskCount=${input.taskList.tasks.length}`,
      `developerTasks=${roles.developer}`,
      `designerTasks=${roles.designer}`,
      `reviewerTasks=${roles.reviewer}`,
      `securityTasks=${roles.security}`,
      `scmTasks=${roles.scm}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

function buildPlanningReadyForImplementationExecutionTimelineEntry(input: {
  readonly projectId: string;
  readonly ok: boolean;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_confirmed_planning_ready_for_implementation_execution",
    source: "system",
    responseText: [
      "type=planning_ready_for_implementation_execution",
      "mode=planning",
      "source=quick_design_confirm",
      `ok=${input.ok}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

function buildQuickDesignSeedAutoBuiltTimelineEntry(input: {
  readonly projectId: string;
  readonly seed: ImplementationSeedV1;
  readonly generatedArtifactCount: number;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_confirmed_implementation_seed_auto_built",
    source: "system",
    responseText: [
      "type=quick_design_confirmed_implementation_seed_auto_built",
      "mode=planning",
      "source=quick_design_confirm",
      `seedReady=${input.seed.readiness.ready}`,
      `seedStatus=${input.seed.lifecycleStatus}`,
      `missing=${input.seed.readiness.missing.join(",")}`,
      `generatedArtifacts=${input.generatedArtifactCount}`,
      `processItems=${input.seed.processImplementationItems.length}`,
      `screenItems=${input.seed.screenImplementationItems.length}`,
      `actorRows=${input.seed.actorCapabilityMatrix.length}`,
      `commonFeatures=${input.seed.commonDetailFeatures.length}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

function buildQuickDesignReadinessEvaluatedTimelineEntry(input: {
  readonly projectId: string;
  readonly readiness: ImplementationSeedReadiness;
  readonly lifecycleStatus: ImplementationSeedLifecycleStatus;
  readonly autoCandidateGenerated: boolean;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_confirmed_implementation_readiness_evaluated",
    source: "system",
    responseText: [
      "type=quick_design_confirmed_implementation_readiness_evaluated",
      "mode=planning",
      "source=quick_design_confirm",
      `seedReady=${input.readiness.ready}`,
      `seedStatus=${input.lifecycleStatus}`,
      `missing=${input.readiness.missing.join(",")}`,
      `autoCandidateGenerated=${input.autoCandidateGenerated}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

function buildQuickDesignSeedAutoConfirmedTimelineEntry(input: {
  readonly projectId: string;
  readonly confirmedGapKeys: readonly ImplementationSeedGapKey[];
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_confirmed_implementation_seed_auto_confirmed",
    source: "system",
    responseText: [
      "type=quick_design_confirmed_implementation_seed_auto_confirmed",
      "mode=planning",
      "source=quick_design_confirm",
      `confirmed=${input.confirmedGapKeys.join(",")}`,
      "lifecycleStatus=confirmed",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

function buildQuickDesignCandidatesAutoGeneratedTimelineEntry(input: {
  readonly projectId: string;
  readonly touchedGapKeys: readonly ImplementationSeedGapKey[];
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "requirements",
    stageGroup: "기획",
    workspaceScreenKey: "requirements",
    action: "quick_design_confirmed_implementation_candidates_auto_generated",
    source: "system",
    responseText: [
      "type=quick_design_confirmed_implementation_candidates_auto_generated",
      "mode=planning",
      "source=quick_design_confirm",
      `touched=${input.touchedGapKeys.join(",")}`,
      "lifecycleStatus=candidate",
      "autoCandidateGenerated=true",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "planning_orchestration",
  };
}

export function resolveQuickDesignSeedLifecycleStatus(input: {
  readonly autoConfirmedRequired: boolean;
  readonly autoCandidateGenerated: boolean;
  readonly readinessReady: boolean;
}): ImplementationSeedLifecycleStatus {
  if (input.autoConfirmedRequired && input.readinessReady) return "confirmed";
  if (input.autoCandidateGenerated) return input.readinessReady ? "partial" : "candidate";
  return input.readinessReady ? "confirmed" : "candidate";
}

export function runQuickDesignConfirmImplementationPrep(input: {
  readonly projectId: string;
  readonly projectName?: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso: string;
  readonly generatedArtifactCount?: number;
  readonly envOk?: boolean;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly existingTaskList?: ImplementationTaskListV1 | null;
}): QuickDesignConfirmImplementationPrepResult {
  const now = input.nowIso;
  const initialReadiness = evaluateImplementationSeedReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });

  let orchestration = input.orchestration;
  let touchedGapKeys: ImplementationSeedGapKey[] = [];
  let autoCandidateGenerated = false;
  let autoConfirmedRequired = false;

  if (initialReadiness.missing.length > 0) {
    const patch = buildImplementationSeedCandidateSlotPatches({
      orchestration,
      definitions: input.definitions,
      projectName: input.projectName,
      nowIso: now,
    });
    if (patch.touchedGapKeys.length > 0) {
      orchestration = { ...orchestration, slots: patch.slots, updatedAt: now };
      touchedGapKeys = [...patch.touchedGapKeys];
      autoCandidateGenerated = true;
    }
  }

  const autoConfirmEligibility = evaluateImplementationSeedAutoConfirmEligibility({
    orchestration,
    definitions: input.definitions,
  });
  if (autoConfirmEligibility.eligible) {
    orchestration = promoteImplementationSeedRequiredSlotsToConfirmed({
      orchestration,
      definitions: input.definitions,
      nowIso: now,
    });
    autoConfirmedRequired = true;
  }

  const readiness = evaluateImplementationSeedReadiness({
    orchestration,
    definitions: input.definitions,
  });

  const lifecycleStatus = resolveQuickDesignSeedLifecycleStatus({
    autoConfirmedRequired,
    autoCandidateGenerated,
    readinessReady: readiness.ready,
  });

  const implementationSeedV1 = buildImplementationSeedFromPlanning({
    projectId: input.projectId,
    orchestration,
    definitions: input.definitions,
    lifecycleStatus,
    nowIso: now,
  });

  const prepComplete = readiness.ready && lifecycleStatus === "confirmed";
  const implementationTaskListV1 = prepComplete
    ? buildImplementationTaskListFromSeed({
        projectId: input.projectId,
        seed: implementationSeedV1,
        nowIso: now,
      })
    : null;
  const postConfirmState = evaluateQuickDesignPostConfirmReadiness({
    readiness,
    prepComplete,
    projectArtifacts: input.projectArtifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
    envOk: input.envOk,
    generatedArtifactCount: input.generatedArtifactCount,
  });
  const chipLabels = quickDesignPostConfirmChipLabelsForState(postConfirmState);

  const taskListForReadiness = input.existingTaskList ?? implementationTaskListV1;
  let implementationCodeTaskPlanV1: ImplementationCodeTaskPlanV1 | null = null;
  let cursorWorkItemsV1: readonly CursorWorkItem[] | null = null;
  let implementationWorkItemPreflightSummaryV1: ImplementationWorkItemPreflightSummaryV1 | null = null;
  let implementationCodeTaskQualityGateV1: ImplementationCodeTaskQualityGateV1 | null = null;
  let planningReadinessTimeline: RequirementsPromptTimelineEntry[] = [];

  if (prepComplete && taskListForReadiness?.tasks?.length) {
    const readinessPatch = buildImplementationPlanningReadinessPatch({
      projectId: input.projectId,
      taskList: taskListForReadiness,
      projectArtifacts: input.projectArtifacts ?? [],
      envOk: input.envOk === true,
      designOk: postConfirmState.designOk,
      priorTimeline: input.promptTimeline,
      nowIso: now,
      includeTaskListCreatedEvent: !input.existingTaskList,
      syncMode: input.existingTaskList ? "synced" : "created",
    });
    implementationCodeTaskPlanV1 = readinessPatch.implementationCodeTaskPlanV1;
    cursorWorkItemsV1 = readinessPatch.cursorWorkItemsV1;
    implementationWorkItemPreflightSummaryV1 = readinessPatch.implementationWorkItemPreflightSummaryV1;
    implementationCodeTaskQualityGateV1 = readinessPatch.implementationCodeTaskQualityGateV1;
    planningReadinessTimeline = [...readinessPatch.promptTimeline];
  }

  const artifactCount = input.generatedArtifactCount ?? 0;
  const timelineEntries: RequirementsPromptTimelineEntry[] = [
    buildQuickDesignSeedAutoBuiltTimelineEntry({
      projectId: input.projectId,
      seed: implementationSeedV1,
      generatedArtifactCount: artifactCount,
      nowIso: now,
    }),
    buildQuickDesignReadinessEvaluatedTimelineEntry({
      projectId: input.projectId,
      readiness,
      lifecycleStatus,
      autoCandidateGenerated,
      nowIso: now,
    }),
  ];
  if (autoCandidateGenerated) {
    timelineEntries.push(
      buildQuickDesignCandidatesAutoGeneratedTimelineEntry({
        projectId: input.projectId,
        touchedGapKeys,
        nowIso: now,
      }),
    );
  }
  if (autoConfirmedRequired) {
    timelineEntries.push(
      buildQuickDesignSeedAutoConfirmedTimelineEntry({
        projectId: input.projectId,
        confirmedGapKeys: autoConfirmEligibility.requiredReadyGapKeys,
        nowIso: now,
      }),
    );
  }
  if (implementationTaskListV1?.tasks?.length) {
    timelineEntries.push(
      buildImplementationTaskListAutoCreatedTimelineEntry({
        projectId: input.projectId,
        taskList: {
          ...implementationTaskListV1,
          roleSummary: summarizeImplementationTaskRoles(implementationTaskListV1.tasks),
        },
        nowIso: now,
      }),
    );
    timelineEntries.push(
      buildPlanningReadyForImplementationExecutionTimelineEntry({
        projectId: input.projectId,
        ok: isPlanningReadyForImplementationExecution({
          implementationSeedV1,
          implementationTaskListV1,
        }),
        nowIso: now,
      }),
    );
  }
  if (planningReadinessTimeline.length) {
    timelineEntries.push(...planningReadinessTimeline);
  }

  return {
    orchestration,
    implementationSeedV1,
    implementationTaskListV1,
    implementationCodeTaskPlanV1,
    cursorWorkItemsV1,
    implementationWorkItemPreflightSummaryV1,
    implementationCodeTaskQualityGateV1,
    readiness,
    lifecycleStatus,
    autoCandidateGenerated,
    autoConfirmedRequired,
    touchedGapKeys,
    chipLabels,
    prepComplete,
    postConfirmState,
    timelineEntries,
  };
}

export async function runQuickDesignConfirmImplementationPrepWithLlm(input: {
  readonly projectId: string;
  readonly projectName?: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso: string;
  readonly generatedArtifactCount?: number;
  readonly envOk?: boolean;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly existingTaskList?: ImplementationTaskListV1 | null;
  readonly llmCaller?: LlmCodeTaskRefinementCaller;
  readonly forceLlm?: boolean;
  readonly refinementSettings?: ProjectCodeTaskRefinementSettings | null;
  readonly providerContext?: LlmCodeTaskRefinementProviderContext | null;
}): Promise<QuickDesignConfirmImplementationPrepResult> {
  const syncResult = runQuickDesignConfirmImplementationPrep(input);
  const taskListForReadiness = input.existingTaskList ?? syncResult.implementationTaskListV1;
  if (!syncResult.prepComplete || !taskListForReadiness?.tasks?.length) {
    return syncResult;
  }

  const now = input.nowIso;
  const llmCaller =
    input.llmCaller ??
    (input.providerContext?.apiKey
      ? undefined
      : typeof fetch === "function"
        ? createProjectLlmCodeTaskRefinementCaller(input.projectId)
        : undefined);
  const readinessPatch = await buildImplementationPlanningReadinessPatchWithLlm({
    projectId: input.projectId,
    taskList: taskListForReadiness,
    projectArtifacts: input.projectArtifacts ?? [],
    implementationSeedV1: syncResult.implementationSeedV1,
    envOk: input.envOk === true,
    designOk: syncResult.postConfirmState.designOk,
    priorTimeline: input.promptTimeline,
    nowIso: now,
    includeTaskListCreatedEvent: !input.existingTaskList,
    syncMode: input.existingTaskList ? "synced" : "created",
    llmCaller,
    forceLlm: input.forceLlm,
    refinementSettings: input.refinementSettings,
    providerContext: input.providerContext,
  });

  const nonPlanningTimeline = syncResult.timelineEntries.filter(
    (entry) => !String(entry.action ?? "").startsWith("implementation_"),
  );
  const planningTimeline = readinessPatch.promptTimeline.filter((entry) =>
    String(entry.action ?? "").startsWith("implementation_"),
  );

  return {
    ...syncResult,
    implementationCodeTaskPlanV1: readinessPatch.implementationCodeTaskPlanV1,
    cursorWorkItemsV1: readinessPatch.cursorWorkItemsV1,
    implementationWorkItemPreflightSummaryV1: readinessPatch.implementationWorkItemPreflightSummaryV1,
    implementationCodeTaskQualityGateV1: readinessPatch.implementationCodeTaskQualityGateV1,
    timelineEntries: [...nonPlanningTimeline, ...planningTimeline],
  };
}

/** @deprecated Use runQuickDesignConfirmImplementationPrepWithLlm */
export const runQuickDesignConfirmImplementationPrepAsync = runQuickDesignConfirmImplementationPrepWithLlm;

const QUICK_DESIGN_IMPLEMENTATION_PREP_INFO_LINES: readonly string[] = [
  "- 프로세스별 구현 항목",
  "- 화면별 구현 항목",
  "- 액터별 기능/권한",
  "- 공통 상세기능",
  "- 데이터/Mock 처리 기준",
] as const;

export function formatQuickDesignImplementationPrepSummaryLines(input: {
  readonly prepComplete: boolean;
  readonly readiness: ImplementationSeedReadiness;
  readonly autoCandidateGenerated: boolean;
  readonly touchedGapKeys?: readonly ImplementationSeedGapKey[];
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): readonly string[] {
  if (input.prepComplete) {
    return [...QUICK_DESIGN_IMPLEMENTATION_PREP_INFO_LINES];
  }

  const candidateKeys = resolveImplementationCandidateGapKeys({
    touchedGapKeys: input.touchedGapKeys,
    autoCandidateGenerated: input.autoCandidateGenerated,
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  const candidateLines = formatImplementationCandidateSummaryLines(candidateKeys);
  if (candidateLines.length) {
    return candidateLines;
  }

  const missingLabels = input.readiness.missing.map((k) => IMPLEMENTATION_SEED_GAP_LABELS[k]);
  if (missingLabels.length) {
    return missingLabels.map((l) => `- ${l}`);
  }

  if (input.autoCandidateGenerated) {
    return ["- 보완이 필요한 후보 항목을 확인할 수 없습니다. 기획정보 보완에서 다시 확인해 주세요."];
  }

  return [...QUICK_DESIGN_IMPLEMENTATION_PREP_INFO_LINES];
}
