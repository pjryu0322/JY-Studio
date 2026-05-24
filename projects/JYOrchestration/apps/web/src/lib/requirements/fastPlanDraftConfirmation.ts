import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { FastPlanDraftSlotCandidatePatchV1 } from "@/lib/requirements/fastPlanDraftSlotPatch";
import {
  mergeOrchestrationSlotPatches,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import { buildFastPlanDraftConfirmedNextActions } from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import { formatFastPlanPlatformTimelineResponse } from "@/lib/requirements/fastPlanDraftGenerationHandoff";
import { evaluatePlanningToGenerationReadiness } from "@/lib/requirements/planningReadinessGate";

export const FAST_PLAN_DRAFT_CONFIRMED_INTERNAL_TYPE = "fast_plan_draft_confirmed" as const;

export type ConfirmFastPlanDraftSlotsResult = Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly fastPlanDraftV1: FastPlanDraftStateV1;
  readonly confirmedSlotKeys: readonly string[];
  readonly confirmedLabels: readonly string[];
  readonly chatMessage: RequirementsMessage;
  readonly timelineEntry: RequirementsPromptTimelineEntry;
}>;

function collectDraftSlotKeys(
  draft: FastPlanDraftStateV1,
  memberDraftTargetKeys: readonly string[],
): readonly string[] {
  const fromPatch = draft.slotCandidatePatch?.updatedSlotKeys ?? [];
  const merged = [...new Set([...fromPatch, ...memberDraftTargetKeys])];
  return merged;
}

export function confirmFastPlanDraftSlots(input: {
  readonly fastPlanDraftV1: FastPlanDraftStateV1;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
  readonly projectId?: string;
}): ConfirmFastPlanDraftSlotsResult {
  const memberKeys = input.fastPlanDraftV1.memberDrafts.flatMap((d) => d.targetSlotKeys ?? []);
  const keysToConfirm = collectDraftSlotKeys(input.fastPlanDraftV1, memberKeys);

  const patches: SlotPatchInput[] = [];
  const confirmedSlotKeys: string[] = [];
  const confirmedLabels: string[] = [];

  for (const slotKey of keysToConfirm) {
    const row = findSlotRow(input.orchestration, slotKey);
    if (!row) continue;
    const status = String(row.status);
    if (status === "confirmed") {
      confirmedSlotKeys.push(slotKey);
      confirmedLabels.push(row.label);
      continue;
    }
    if (status !== "candidate" && status !== "partial" && status !== "empty") continue;
    const value = String(row.value ?? "").trim();
    if (!value) continue;
    patches.push({
      slotKey,
      status: "confirmed",
      value,
      confidence: 0.9,
      derivedFrom: "fast_plan_draft_confirmed",
    });
    confirmedSlotKeys.push(slotKey);
    confirmedLabels.push(row.label);
  }

  const orchestration =
    patches.length > 0
      ? mergeOrchestrationSlotPatches({
          base: input.orchestration,
          patches,
          nowIso: input.nowIso,
          definitions: input.definitions,
          propagateStaleFromPlanner: false,
        })
      : input.orchestration;

  const uniqueLabels = [...new Set(confirmedLabels)].slice(0, 12);
  const bodyLines = [
    "AI팀 초안을 확인 처리했습니다.",
    "",
    "확정된 슬롯:",
    ...(uniqueLabels.length ? uniqueLabels.map((l) => `- ${l}`) : ["- (반영된 슬롯 없음)"]),
    "",
    "이제 정석 경로로 다음 작업을 진행할 수 있습니다.",
    "",
    "아래 버튼에서 다음 동작을 선택해 주세요.",
  ];

  const fastPlanDraftV1: FastPlanDraftStateV1 = {
    ...input.fastPlanDraftV1,
    status: "confirmed",
    slotCandidatePatch: input.fastPlanDraftV1.slotCandidatePatch as FastPlanDraftSlotCandidatePatchV1 | undefined,
  };

  const generationReadiness = evaluatePlanningToGenerationReadiness({
    orchestration,
    definitions: input.definitions,
  });
  const followUpChips = buildFastPlanDraftConfirmedNextActions({
    generationPrepReady: generationReadiness.ready,
    generationPrepReason: generationReadiness.reason,
  });

  const chatMessage = newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content: bodyLines.join("\n"),
    createdAt: input.nowIso,
    meta: {
      stage: "REQUIREMENTS",
      internalType: FAST_PLAN_DRAFT_CONFIRMED_INTERNAL_TYPE,
      interviewSuggestions: [...followUpChips],
      interviewAllowCustomInput: true,
    },
  });

  const timelineEntry: RequirementsPromptTimelineEntry = {
    stage: "requirements",
    action: "fast_plan_draft_confirmed",
    source: "platform",
    provider: "platform",
    model: "deterministic",
    routingDecision: "confirm_draft_slots",
    orchestrationTraceGroup: "platform_fast_plan",
    promptText: "초안 확인/확정",
    responseText: formatFastPlanPlatformTimelineResponse({
      routingDecision: "fast_plan_draft_confirmed",
      detail: `confirmed=${confirmedSlotKeys.length}`,
    }),
    createdAt: input.nowIso,
    aiMember: "AI 기획자",
  };

  void input.projectId;

  return {
    orchestration,
    fastPlanDraftV1,
    confirmedSlotKeys,
    confirmedLabels: uniqueLabels,
    chatMessage,
    timelineEntry,
  };
}
