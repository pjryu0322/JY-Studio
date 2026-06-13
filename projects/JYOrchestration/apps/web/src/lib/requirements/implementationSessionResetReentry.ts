import { buildImplementationPlanningReadinessPatch } from "@/lib/prototype/implementationPlanningReadiness";
import { buildInitialImplementationIntegratedExecutionState } from "@/lib/prototype/implementationIntegratedExecutionState";
import { buildInitialImplementationTaskExecutionStateFromTaskList } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { buildGenerationReadinessCheckedTimelineEntry } from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import { patchRequirementsStageForImplementationStart } from "@/lib/requirements/quickDesignConfirmArtifacts";
import {
  runQuickDesignConfirmImplementationPrep,
  type QuickDesignConfirmImplementationPrepResult,
} from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import { evaluateImplementationStartReadiness } from "@/lib/requirements/planningReadinessGate";
import { buildImplementationConversationResetStateJson } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type {
  RequirementsPromptTimelineEntry,
  RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimelineEntriesOnce } from "@/lib/requirements/promptTimelineState";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import type { PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";

export type BuildImplementationResetWithPlanningReentryResult = Readonly<
  | {
      readonly ok: true;
      readonly state: RequirementsStateJson;
      readonly prepComplete: boolean;
    }
  | {
      readonly ok: false;
      readonly state: RequirementsStateJson;
      readonly reason: string;
    }
>;

type StructuralSnapshot = Readonly<{
  readonly seed: ImplementationSeedV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
}>;

function readStructuralSnapshot(base: RequirementsStateJson): StructuralSnapshot {
  return {
    seed: base.implementationSeedV1 ?? null,
    taskList:
      (base.implementationTaskListV1?.tasks?.length ?? 0) > 0
        ? base.implementationTaskListV1!
        : null,
    codeTaskPlan:
      (base.implementationCodeTaskPlanV1?.tasks?.length ?? 0) > 0
        ? base.implementationCodeTaskPlanV1!
        : null,
  };
}

function ensureCodeTaskPlanForReset(input: {
  readonly projectId: string;
  readonly cleared: RequirementsStateJson;
  readonly prep: QuickDesignConfirmImplementationPrepResult;
  readonly snapshot: StructuralSnapshot;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso: string;
  readonly priorTimeline: readonly RequirementsPromptTimelineEntry[];
}): Readonly<{
  readonly taskList: ImplementationTaskListV1 | null;
  readonly seed: ImplementationSeedV1 | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly cursorWorkItemsV1: readonly CursorWorkItem[] | null;
  readonly implementationWorkItemPreflightSummaryV1: RequirementsStateJson["implementationWorkItemPreflightSummaryV1"];
  readonly implementationCodeTaskQualityGateV1: RequirementsStateJson["implementationCodeTaskQualityGateV1"];
  readonly codeTaskPromptContextMapV1: RequirementsStateJson["codeTaskPromptContextMapV1"];
  readonly extraTimeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const taskList = input.prep.implementationTaskListV1 ?? input.snapshot.taskList ?? null;
  const seed = input.prep.implementationSeedV1 ?? input.snapshot.seed ?? null;

  let codeTaskPlan = input.prep.implementationCodeTaskPlanV1 ?? null;
  let cursorWorkItemsV1 = input.prep.cursorWorkItemsV1 ?? null;
  let implementationWorkItemPreflightSummaryV1 = input.prep.implementationWorkItemPreflightSummaryV1 ?? null;
  let implementationCodeTaskQualityGateV1 = input.prep.implementationCodeTaskQualityGateV1 ?? null;
  let codeTaskPromptContextMapV1 = input.prep.codeTaskPromptContextMapV1 ?? null;
  let extraTimeline: readonly RequirementsPromptTimelineEntry[] = [];

  const needsPlan =
    (taskList?.tasks?.length ?? 0) > 0 && (codeTaskPlan?.tasks?.length ?? 0) === 0;

  if (needsPlan && taskList) {
    const readinessPatch = buildImplementationPlanningReadinessPatch({
      projectId: input.projectId,
      taskList,
      projectArtifacts: input.cleared.projectArtifacts ?? [],
      requirementsStateJson: {
        implementationSeedV1: seed ?? undefined,
        implementationTaskListV1: taskList,
        ...(input.cleared.projectArtifacts?.length
          ? { projectArtifacts: input.cleared.projectArtifacts }
          : {}),
        ...(input.cleared.artifactOrchestrationV1
          ? { artifactOrchestrationV1: input.cleared.artifactOrchestrationV1 }
          : {}),
      },
      envOk: input.envOk,
      designOk: input.designOk,
      priorTimeline: input.priorTimeline,
      nowIso: input.nowIso,
      includeTaskListCreatedEvent: false,
      syncMode: "synced",
    });
    codeTaskPlan = readinessPatch.implementationCodeTaskPlanV1;
    cursorWorkItemsV1 = readinessPatch.cursorWorkItemsV1;
    implementationWorkItemPreflightSummaryV1 = readinessPatch.implementationWorkItemPreflightSummaryV1;
    implementationCodeTaskQualityGateV1 = readinessPatch.implementationCodeTaskQualityGateV1;
    codeTaskPromptContextMapV1 = readinessPatch.codeTaskPromptContextMapV1;
    extraTimeline = readinessPatch.promptTimeline;
  }

  return {
    taskList,
    seed,
    codeTaskPlan,
    cursorWorkItemsV1,
    implementationWorkItemPreflightSummaryV1,
    implementationCodeTaskQualityGateV1,
    codeTaskPromptContextMapV1,
    extraTimeline,
  };
}

/**
 * Clears implementation session state, then rebuilds Seed / TaskList / CodeTask plan from planning
 * (same sync prep as Quick Design confirm → implementation). Ensures CodeTask plan + board execution
 * bootstrap exist so the CodeTask list renders after reset.
 */
export function buildImplementationResetWithPlanningReentry(input: {
  readonly base: RequirementsStateJson;
  readonly nowIso: string;
  readonly projectId: string;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly userSelectedTemplateId?: PrototypeTemplateType | null;
}): BuildImplementationResetWithPlanningReentryResult {
  const snapshot = readStructuralSnapshot(input.base);
  const cleared = buildImplementationConversationResetStateJson(input.base, input.nowIso);
  const orchestration = cleared.singleChatOrchestrationV1;
  if (!orchestration) {
    return {
      ok: false,
      state: cleared,
      reason: "기획 슬롯 상태가 없어 구현 준비를 다시 생성할 수 없습니다. /requirements에서 Quick Design을 확정해 주세요.",
    };
  }

  const startReadiness = evaluateImplementationStartReadiness({
    orchestration,
    definitions: input.slotDefinitions,
    projectArtifacts: cleared.projectArtifacts,
    artifactOrchestrationV1: cleared.artifactOrchestrationV1,
  });

  const prep = runQuickDesignConfirmImplementationPrep({
    projectId: input.projectId,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    userSelectedTemplateId: input.userSelectedTemplateId,
    orchestration,
    definitions: input.slotDefinitions,
    nowIso: input.nowIso,
    generatedArtifactCount: cleared.projectArtifacts?.length ?? 0,
    envOk: input.envOk,
    designOk: input.designOk,
    projectArtifacts: cleared.projectArtifacts,
    artifactOrchestrationV1: cleared.artifactOrchestrationV1,
    existingTaskList: null,
    promptTimeline: [],
  });

  const timelineSeed = [
    buildGenerationReadinessCheckedTimelineEntry({
      projectId: input.projectId,
      nowIso: input.nowIso,
      ready: startReadiness.ready,
      detail: startReadiness.reason ?? "implementation_reset_reentry",
    }),
    ...prep.timelineEntries,
  ];

  const structural = ensureCodeTaskPlanForReset({
    projectId: input.projectId,
    cleared,
    prep,
    snapshot,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: input.nowIso,
    priorTimeline: timelineSeed,
  });

  const taskList = structural.taskList;
  const executionBootstrap =
    taskList?.tasks?.length && input.projectId.trim()
      ? {
          implementationTaskExecutionStateV1: buildInitialImplementationTaskExecutionStateFromTaskList({
            projectId: input.projectId,
            taskList,
            nowIso: input.nowIso,
          }),
          implementationIntegratedExecutionStateV1: buildInitialImplementationIntegratedExecutionState({
            projectId: input.projectId,
            nowIso: input.nowIso,
          }),
        }
      : {};

  const state: RequirementsStateJson = {
    ...cleared,
    singleChatOrchestrationV1: prep.orchestration,
    implementationSeedV1: structural.seed,
    implementationTaskListV1: taskList,
    implementationCodeTaskPlanV1: structural.codeTaskPlan,
    cursorWorkItemsV1: structural.cursorWorkItemsV1?.length ? [...structural.cursorWorkItemsV1] : null,
    implementationWorkItemPreflightSummaryV1: structural.implementationWorkItemPreflightSummaryV1 ?? null,
    implementationCodeTaskQualityGateV1: structural.implementationCodeTaskQualityGateV1 ?? null,
    codeTaskPromptContextMapV1: structural.codeTaskPromptContextMapV1 ?? null,
    ...executionBootstrap,
    requirementsOrchestrationStageV1: patchRequirementsStageForImplementationStart({
      existing: cleared.requirementsOrchestrationStageV1,
      nowIso: input.nowIso,
    }),
    promptTimeline: appendPromptTimelineEntriesOnce([], [
      ...timelineSeed,
      ...structural.extraTimeline,
    ]),
  };

  const hasCodeTaskBoard =
    (taskList?.tasks?.length ?? 0) > 0 && (structural.codeTaskPlan?.tasks?.length ?? 0) > 0;

  if (!hasCodeTaskBoard) {
    return {
      ok: false,
      state,
      reason:
        startReadiness.reason ??
        "구현 작업목록·CodeTask 계획을 다시 만들지 못했습니다. /requirements에서 구현 준비 상태를 확인해 주세요.",
    };
  }

  return { ok: true, state, prepComplete: prep.prepComplete };
}
