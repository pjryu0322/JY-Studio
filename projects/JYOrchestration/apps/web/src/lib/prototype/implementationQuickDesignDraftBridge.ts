import { prepareQuickDesignDraftForConfirm } from "@/lib/requirements/fastPlanDraftSlotPatch";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import {
  GENERATE_IMPLEMENTATION_TASK_LIST_CHIP,
  IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import {
  runQuickDesignConfirmImplementationPrep,
  type QuickDesignConfirmImplementationPrepResult,
} from "@/lib/requirements/quickDesignConfirmImplementationPrep";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { runQuickDesignConfirmFlow, type QuickDesignConfirmFlowResult } from "@/lib/requirements/quickDesignConfirmFlow";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";

export const IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_MESSAGE_INTERNAL_TYPE =
  "IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_V1" as const;

export const IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_HEADLINE =
  "Quick Design 초안을 기준으로 구현 Seed를 생성했습니다." as const;

export type CreateImplementationSeedFromQuickDesignDraftResult =
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{
      readonly kind: "created";
      readonly implementationSeedV1: ImplementationSeedV1;
      readonly singleChatOrchestrationV1: RequirementsSingleChatOrchestrationStateV1;
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: Readonly<{
        readonly implementationSeedV1: ImplementationSeedV1;
        readonly singleChatOrchestrationV1: RequirementsSingleChatOrchestrationStateV1;
        readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
      }>;
    }>;

function buildImplementationSeedCreatedFromQuickDesignDraftTimelineEntry(input: {
  readonly projectId: string;
  readonly hasQuickDesignDraft: boolean;
  readonly hasQuickDesignSlots: boolean;
  readonly hasImplementationSeed: boolean;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_seed_created_from_quick_design_draft",
    source: "system",
    responseText: [
      "type=implementation_seed_created_from_quick_design_draft",
      `projectId=${input.projectId}`,
      `hasQuickDesignDraft=${input.hasQuickDesignDraft}`,
      `hasQuickDesignSlots=${input.hasQuickDesignSlots}`,
      `hasImplementationSeed=${input.hasImplementationSeed}`,
      "source=quick_design_draft",
      "status=draft_based",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

function buildImplementationSeedReadyFromQuickDesignTimelineEntry(input: {
  readonly projectId: string;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_seed_ready_from_quick_design",
    source: "system",
    responseText: [
      "type=implementation_seed_ready_from_quick_design",
      `projectId=${input.projectId}`,
      "source=quick_design_draft",
      "status=seed_ready",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function annotateSeedAsQuickDesignDraftBased(seed: ImplementationSeedV1): ImplementationSeedV1 {
  const draftNote = "Quick Design 초안 기반 Seed. 작업목록 생성 전 주요 기능·화면 범위 확인 필요.";
  const assumptions = seed.assumptions.includes(draftNote)
    ? seed.assumptions
    : [...seed.assumptions, draftNote];
  return {
    ...seed,
    lifecycleStatus: seed.lifecycleStatus === "confirmed" ? "partial" : "candidate",
    assumptions,
  };
}

export function buildImplementationSeedFromQuickDesignDraftMessage(input: {
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const content = [
    IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_HEADLINE,
    "",
    "이제 구현 작업목록을 생성할 수 있습니다.",
    "초안 기반 Seed이므로 작업목록 생성 전 주요 기능과 화면 범위를 확인해 주세요.",
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    id: `impl-seed-from-qd-draft-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content,
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT_MESSAGE_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [GENERATE_IMPLEMENTATION_TASK_LIST_CHIP, IMPLEMENTATION_RETURN_TO_PLANNING_CHIP],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1000,
    },
  });
}

export function buildCreateImplementationSeedFromQuickDesignDraftResult(input: {
  readonly projectId: string;
  readonly projectName?: string;
  readonly fastPlanDraftV1: FastPlanDraftStateV1 | null | undefined;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): CreateImplementationSeedFromQuickDesignDraftResult {
  const now = input.nowIso ?? new Date().toISOString();
  const draft = input.fastPlanDraftV1;
  if (!draft || !(draft.memberDrafts?.length || draft.slotCandidatePatch)) {
    return {
      kind: "blocked",
      message: "Quick Design 초안이 없습니다. 기획단계에서 Quick Design을 먼저 실행해 주세요.",
    };
  }
  const orchestration = input.orchestration;
  if (!orchestration) {
    return { kind: "blocked", message: "슬롯 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  const prepared = prepareQuickDesignDraftForConfirm({
    fastPlanDraftV1: draft,
    orchestration,
    definitions: input.slotDefinitions,
    nowIso: now,
  });

  const prep: QuickDesignConfirmImplementationPrepResult = runQuickDesignConfirmImplementationPrep({
    projectId: input.projectId,
    projectName: input.projectName,
    orchestration: prepared.orchestration,
    definitions: input.slotDefinitions,
    promptTimeline: input.promptTimeline,
    nowIso: now,
  });

  const implementationSeedV1 = annotateSeedAsQuickDesignDraftBased(prep.implementationSeedV1);
  const message = buildImplementationSeedFromQuickDesignDraftMessage({ nowIso: now });

  let promptTimeline = input.promptTimeline ?? [];
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildImplementationSeedCreatedFromQuickDesignDraftTimelineEntry({
      projectId: input.projectId,
      hasQuickDesignDraft: true,
      hasQuickDesignSlots: Boolean(draft.slotCandidatePatch),
      hasImplementationSeed: true,
      nowIso: now,
    }),
  );
  promptTimeline = appendPromptTimeline(
    promptTimeline,
    buildImplementationSeedReadyFromQuickDesignTimelineEntry({
      projectId: input.projectId,
      nowIso: now,
    }),
  );

  return {
    kind: "created",
    implementationSeedV1,
    singleChatOrchestrationV1: prep.orchestration,
    messages: [message],
    orchestrationPatch: {
      implementationSeedV1,
      singleChatOrchestrationV1: prep.orchestration,
      promptTimeline,
    },
  };
}

export type ConfirmQuickDesignForImplementationFromStateInput = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  readonly conversationMessages: readonly RequirementsMessage[];
  readonly slotDefinitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sourceStage?: OrchestrationStage;
  readonly envOkOverride?: boolean;
}>;

export type ConfirmQuickDesignForImplementationResult =
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>
  | Readonly<{
      readonly kind: "success";
      readonly flow: Extract<QuickDesignConfirmFlowResult, { readonly kind: "success" }>;
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: Readonly<Record<string, unknown>>;
    }>;

export async function runConfirmQuickDesignForImplementationFromState(
  input: ConfirmQuickDesignForImplementationFromStateInput,
): Promise<ConfirmQuickDesignForImplementationResult> {
  const state =
    input.requirementsStateJson && typeof input.requirementsStateJson === "object"
      ? (input.requirementsStateJson as Record<string, unknown>)
      : {};
  const draft = state.fastPlanDraftV1 as FastPlanDraftStateV1 | null | undefined;
  if (!draft?.memberDrafts?.length) {
    return {
      kind: "blocked",
      message: "확인할 Quick Design 초안이 없습니다. 기획단계에서 Quick Design을 먼저 실행해 주세요.",
    };
  }
  const orchestrationForConfirm = state.singleChatOrchestrationV1 as
    | RequirementsSingleChatOrchestrationStateV1
    | null
    | undefined;
  if (!orchestrationForConfirm) {
    return { kind: "blocked", message: "슬롯 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  const nowIso = new Date().toISOString();
  const flowResult = await runQuickDesignConfirmFlow({
    projectId: input.projectId,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMessages: input.conversationMessages,
    serviceFlow: (state.serviceFlowV1 as { readonly version?: string } | null) ?? null,
    problemInterview: null,
    sourceStage: input.sourceStage ?? "IDEATION",
    nowIso,
    fastPlanDraftV1: draft,
    orchestrationForConfirm,
    slotDefinitions: input.slotDefinitions,
    planningState: {
      featurePlanningSlotsV1: (state.featurePlanningSlotsV1 as Record<string, unknown> | null) ?? null,
      serviceFlowV1: (state.serviceFlowV1 as { readonly version?: string } | null) ?? null,
      projectArtifacts: (state.projectArtifacts as import("@/lib/requirements/projectArtifactTypes").ProjectArtifact[]) ?? [],
      deliverableAssets:
        (state.deliverableAssets as import("@/lib/requirements/ideationDeliverables").IdeationDeliverableAsset[]) ?? [],
      requirementsOrchestrationStageV1:
        (state.requirementsOrchestrationStageV1 as import("@/lib/requirements/requirementsStateJson").RequirementsOrchestrationStageV1 | null) ??
        null,
      implementationTaskListV1:
        (state.implementationTaskListV1 as import("@/lib/requirements/implementationTaskList").ImplementationTaskListV1 | null) ??
        null,
    },
    ...(input.envOkOverride !== undefined ? { envOkOverride: input.envOkOverride } : {}),
  });

  if (flowResult.kind === "blocked") {
    return { kind: "blocked", message: flowResult.message };
  }

  const chat = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const priorMessages = chat.messages ?? [];
  let promptTimeline = (state.promptTimeline as RequirementsPromptTimelineEntry[] | undefined) ?? [];
  for (const entry of flowResult.timelineEntries) {
    promptTimeline = appendPromptTimeline(promptTimeline, entry);
  }
  promptTimeline = appendPromptTimeline(promptTimeline, {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "quick_design_confirmed_for_implementation",
    source: "system",
    responseText: [
      "type=quick_design_confirmed_for_implementation",
      `projectId=${input.projectId}`,
      "source=implementation_stage",
    ].join(" "),
    createdAt: nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  });

  return {
    kind: "success",
    flow: flowResult,
    messages: [...priorMessages, flowResult.readyMessage],
    orchestrationPatch: {
      ...flowResult.statePatch,
      promptTimeline,
    },
  };
}
