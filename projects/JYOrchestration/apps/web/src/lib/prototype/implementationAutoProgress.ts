import { buildGenerateImplementationWorkPlanDraftResult } from "@/lib/prototype/prototypeExecutionWorkPlanDraftActions";
import {
  buildConfirmImplementationTaskPlanResult,
  type ConfirmImplementationTaskPlanInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import { buildMockImplementationModeResult } from "@/lib/prototype/prototypeExecutionDbStrategyActions";
import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { hasImplementationWorkPlanDraftReady } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  buildTaskListDerivedWipOrchestration,
  canUseTaskListForWipOrchestration,
} from "@/lib/prototype/implementationTaskListWipPrep";
import { isPlanningReadyForImplementationExecution } from "@/lib/requirements/implementationTaskList";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";

export type ImplementationAutoProgressResult = Readonly<{
  ok: boolean;
  message?: string;
  created: readonly (
    | "implementationWorkPlanDraftV1"
    | "implementationTaskPlanV1"
    | "implementationDbStrategyV1"
    | "mockImplementationMode"
  )[];
  messages?: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[];
  patch?: Record<string, unknown>;
  promptTimeline?: readonly RequirementsPromptTimelineEntry[];
}>;

export function ensureImplementationWorkPlanDraft(input: {
  readonly requirementsStateJson: unknown;
  readonly effectiveState: EffectiveImplementationState;
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly orchestration?: import("@/lib/requirements/singleChatOrchestrationTypes").RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly import("@/lib/requirements/singleChatOrchestrationTypes").SingleChatOrchestrationSlotDefinition[];
  readonly envOk: boolean;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): ImplementationAutoProgressResult {
  if (hasImplementationWorkPlanDraftReady(input.effectiveState.implementationWorkPlanDraftV1)) {
    return { ok: true, created: [] };
  }

  const res = buildGenerateImplementationWorkPlanDraftResult({
    requirementsStateJson: input.requirementsStateJson,
    projectId: input.projectId,
    projectArtifacts: input.projectArtifacts,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
    implementationSeedV1: input.effectiveState.implementationSeedV1,
    envOk: input.envOk,
    // Draft 생성은 seed readiness 기반으로 허용되며, designOk는 gate로 사용하지 않는다.
    designOk: true,
    promptTimeline: input.promptTimeline,
    nowIso: input.nowIso,
  });

  if (res.kind === "already_exists") return { ok: true, created: [] };
  if (res.kind === "blocked") return { ok: false, message: res.message, created: [] };

  return {
    ok: true,
    created: ["implementationWorkPlanDraftV1"],
    messages: res.messages,
    patch: {
      implementationWorkPlanDraftV1: res.orchestrationPatch.implementationWorkPlanDraftV1,
      implementationSeedV1: res.orchestrationPatch.implementationSeedV1,
    },
    promptTimeline: res.orchestrationPatch.promptTimeline,
  };
}

export function ensureImplementationArtifactsFromTaskList(input: {
  readonly requirementsStateJson: unknown;
  readonly effectiveState: EffectiveImplementationState;
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly envCursorBadge?: "ok" | "needs" | "error" | "loading";
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
}): ImplementationAutoProgressResult {
  if (input.effectiveState.implementationSlotsV1) {
    return { ok: true, created: [] };
  }

  const parsed = parseRequirementsStateJson(input.requirementsStateJson);
  const taskList = input.effectiveState.implementationTaskListV1 ?? parsed.implementationTaskListV1;
  const seed = input.effectiveState.implementationSeedV1 ?? parsed.implementationSeedV1;

  if (
    !canUseTaskListForWipOrchestration({ taskList, seed }) ||
    !isPlanningReadyForImplementationExecution({
      implementationSeedV1: seed,
      implementationTaskListV1: taskList,
    })
  ) {
    return { ok: false, message: "구현 작업목록이 준비되지 않았습니다.", created: [] };
  }

  const derived = buildTaskListDerivedWipOrchestration({
    projectId: input.projectId,
    taskList: taskList!,
    projectArtifacts: input.projectArtifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
    envOk: input.envOk,
    designOk: input.designOk,
    envCursorBadge: input.envCursorBadge ?? (input.envOk ? "ok" : "needs"),
    priorTimeline: input.promptTimeline ?? parsed.promptTimeline,
    priorExecutionState: parsed.implementationTaskExecutionStateV1,
    planningHandoffForImplementationV1: parsed.planningHandoffForImplementationV1 ?? null,
  });

  return {
    ok: true,
    created: ["implementationTaskPlanV1", "implementationTaskExecutionStateV1"],
    patch: {
      implementationTaskPlanV1: derived.plan,
      cursorWorkItemsV1: derived.workItems,
      implementationSlotsV1: derived.slots,
      implementationDbStrategyV1: derived.dbStrategy,
      implementationTaskExecutionStateV1: derived.executionState,
    },
    promptTimeline: derived.promptTimeline,
  };
}

export function ensureImplementationTaskPlan(input: {
  readonly requirementsStateJson: unknown;
  readonly effectiveState: EffectiveImplementationState;
  readonly confirmTaskPlanInput: Omit<
    ConfirmImplementationTaskPlanInput,
    "requirementsStateJson" | "implementationWorkPlanDraftV1" | "promptTimeline"
  > & {
    readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  };
  readonly ensureDraftInput: Omit<
    Parameters<typeof ensureImplementationWorkPlanDraft>[0],
    "effectiveState"
  >;
}): ImplementationAutoProgressResult {
  if (input.effectiveState.implementationTaskPlanV1) {
    return { ok: true, created: [] };
  }

  const parsed = parseRequirementsStateJson(input.requirementsStateJson);
  const taskList =
    input.effectiveState.implementationTaskListV1 ?? parsed.implementationTaskListV1;
  const seed = input.effectiveState.implementationSeedV1 ?? parsed.implementationSeedV1;
  if (
    canUseTaskListForWipOrchestration({ taskList, seed }) &&
    isPlanningReadyForImplementationExecution({
      implementationSeedV1: seed,
      implementationTaskListV1: taskList,
    }) &&
    !input.effectiveState.implementationSlotsV1
  ) {
    return ensureImplementationArtifactsFromTaskList({
      requirementsStateJson: input.requirementsStateJson,
      effectiveState: input.effectiveState,
      projectId: input.confirmTaskPlanInput.projectId,
      projectArtifacts: input.confirmTaskPlanInput.projectArtifacts,
      artifactOrchestrationV1: input.confirmTaskPlanInput.artifactOrchestrationV1,
      envOk: input.confirmTaskPlanInput.envOk,
      designOk: input.confirmTaskPlanInput.designOk,
      promptTimeline:
        input.confirmTaskPlanInput.promptTimeline ?? input.ensureDraftInput.promptTimeline,
    });
  }

  const draftRes = ensureImplementationWorkPlanDraft({
    ...input.ensureDraftInput,
    requirementsStateJson: input.requirementsStateJson,
    effectiveState: input.effectiveState,
  });
  if (!draftRes.ok) return draftRes;

  const stateRecord =
    input.requirementsStateJson && typeof input.requirementsStateJson === "object"
      ? (input.requirementsStateJson as Record<string, unknown>)
      : {};
  const draft =
    (draftRes.patch?.implementationWorkPlanDraftV1 as import("@/lib/prototype/implementationWorkPlanDraft").ImplementationWorkPlanDraftV1 | null | undefined) ??
    (stateRecord.implementationWorkPlanDraftV1 as import("@/lib/prototype/implementationWorkPlanDraft").ImplementationWorkPlanDraftV1 | null | undefined) ??
    null;

  const confirm = buildConfirmImplementationTaskPlanResult({
    ...input.confirmTaskPlanInput,
    requirementsStateJson: input.requirementsStateJson,
    implementationWorkPlanDraftV1: draft,
    promptTimeline: draftRes.promptTimeline ?? input.confirmTaskPlanInput.promptTimeline,
  });
  if (confirm.kind !== "created") {
    const message =
      confirm.kind === "blocked"
        ? "구현 작업안을 자동으로 확정할 수 없습니다. 구현 작업안 초안을 먼저 확인해 주세요."
        : undefined;
    return { ok: false, message: message ?? "구현 작업안을 자동 확정할 수 없습니다.", created: [] };
  }

  return {
    ok: true,
    created: [...draftRes.created, "implementationTaskPlanV1"],
    messages: confirm.chatPatch.messages,
    patch: confirm.orchestrationPatch,
    promptTimeline: confirm.orchestrationPatch.promptTimeline,
  };
}

export function ensureMockImplementationReady(input: {
  readonly requirementsStateJson: unknown;
  readonly effectiveState: EffectiveImplementationState;
  readonly ensureTaskPlanInput: Parameters<typeof ensureImplementationTaskPlan>[0];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): ImplementationAutoProgressResult {
  const ensured = ensureImplementationTaskPlan(input.ensureTaskPlanInput);
  if (!ensured.ok || !ensured.patch) return ensured;

  const patch = ensured.patch as Record<string, unknown>;
  const slots = patch.implementationSlotsV1 as import("@/lib/prototype/implementationSlots").ImplementationSlotsV1 | null | undefined;
  if (!slots) {
    return { ok: false, message: "PostgreSQL 구현 준비를 자동으로 완료할 수 없습니다.", created: [] };
  }

  const result = buildMockImplementationModeResult({
    requirementsStateJson: input.requirementsStateJson,
    implementationSlotsV1: slots,
    implementationDbStrategyV1:
      (patch.implementationDbStrategyV1 as import("@/lib/prototype/implementationDbStrategy").ImplementationDbStrategyV1 | null | undefined) ??
      (input.effectiveState.implementationDbStrategyV1 as any),
    promptTimeline: (ensured.promptTimeline ?? input.promptTimeline) as any,
    nowIso: input.nowIso,
  });

  if (result.kind === "blocked") {
    return { ok: false, message: result.message, created: [] };
  }

  return {
    ok: true,
    created: [...ensured.created, "implementationDbStrategyV1", "mockImplementationMode"],
    messages: result.messages,
    patch: {
      ...patch,
      ...result.orchestrationPatch,
    },
    promptTimeline: result.orchestrationPatch.promptTimeline,
  };
}

