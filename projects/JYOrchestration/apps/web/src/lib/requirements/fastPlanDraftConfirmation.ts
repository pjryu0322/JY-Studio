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
import { buildQuickDesignConfirmedTimelineEntry } from "@/lib/requirements/quickDesignLabels";
import { prepareQuickDesignDraftForConfirm } from "@/lib/requirements/fastPlanDraftSlotPatch";
import { getQuickDesignPatchedSlotKeys } from "@/lib/requirements/quickDesignSlotArea";

export const FAST_PLAN_DRAFT_CONFIRMED_INTERNAL_TYPE = "fast_plan_draft_confirmed" as const;

export const QUICK_DESIGN_CONFIRM_BLOCKED_MESSAGE =
  "확정할 Quick Design 초안 정보를 찾을 수 없습니다. Quick Design을 다시 실행한 뒤 확인해 주세요." as const;

export type ConfirmFastPlanDraftSlotsResult = Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly fastPlanDraftV1: FastPlanDraftStateV1;
  readonly confirmedSlotKeys: readonly string[];
  readonly confirmedLabels: readonly string[];
  readonly chatMessage: RequirementsMessage;
  readonly timelineEntry: RequirementsPromptTimelineEntry;
  readonly blocked: boolean;
  readonly blockReason?: string;
}>;

export function confirmFastPlanDraftSlots(input: {
  readonly fastPlanDraftV1: FastPlanDraftStateV1;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
  readonly projectId?: string;
  readonly onlyPatchedSlotKeys?: boolean;
}): ConfirmFastPlanDraftSlotsResult {
  const onlyPatched = input.onlyPatchedSlotKeys !== false;
  const prepared = prepareQuickDesignDraftForConfirm({
    fastPlanDraftV1: input.fastPlanDraftV1,
    orchestration: input.orchestration,
    definitions: input.definitions,
    nowIso: input.nowIso,
  });
  const fastPlanDraftV1 = prepared.fastPlanDraftV1;
  const orchestrationBase = prepared.orchestration;
  const patchScope = getQuickDesignPatchedSlotKeys(fastPlanDraftV1.slotCandidatePatch);

  if (onlyPatched && patchScope.length === 0) {
    const chatMessage = newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "ai-planner",
      speakerName: "AI기획자",
      messageType: "NOTICE",
      content: QUICK_DESIGN_CONFIRM_BLOCKED_MESSAGE,
      createdAt: input.nowIso,
      meta: {
        stage: "REQUIREMENTS",
        internalType: FAST_PLAN_DRAFT_CONFIRMED_INTERNAL_TYPE,
        interviewAllowCustomInput: true,
      },
    });
    const timelineEntry = buildQuickDesignConfirmedTimelineEntry({
      projectId: String(input.projectId ?? "").trim() || "unknown",
      nowIso: input.nowIso,
      confirmedCount: 0,
    });
    return {
      orchestration: input.orchestration,
      fastPlanDraftV1,
      confirmedSlotKeys: [],
      confirmedLabels: [],
      chatMessage,
      timelineEntry,
      blocked: true,
      blockReason: QUICK_DESIGN_CONFIRM_BLOCKED_MESSAGE,
    };
  }

  const patches: SlotPatchInput[] = [];
  const confirmedSlotKeys: string[] = [];
  const confirmedLabels: string[] = [];

  for (const slotKey of patchScope) {
    const row = findSlotRow(orchestrationBase, slotKey);
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
      derivedFrom: "quick_design_confirmed",
    });
    confirmedSlotKeys.push(slotKey);
    confirmedLabels.push(row.label);
  }

  const orchestration =
    patches.length > 0
      ? mergeOrchestrationSlotPatches({
          base: orchestrationBase,
          patches,
          nowIso: input.nowIso,
          definitions: input.definitions,
          propagateStaleFromPlanner: false,
        })
      : input.orchestration;

  const fastPlanDraftV1Confirmed: FastPlanDraftStateV1 = {
    ...fastPlanDraftV1,
    status: "confirmed",
    slotCandidatePatch: fastPlanDraftV1.slotCandidatePatch as FastPlanDraftSlotCandidatePatchV1 | undefined,
  };

  /** 사용자 메시지는 확정 직후 산출물 생성과 함께 workspace에서 구현 준비 완료 메시지로 대체 */
  const chatMessage = newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "ai-planner",
    speakerName: "AI기획자",
    messageType: "NOTICE",
    content: "",
    createdAt: input.nowIso,
    meta: {
      stage: "REQUIREMENTS",
      internalType: FAST_PLAN_DRAFT_CONFIRMED_INTERNAL_TYPE,
      interviewAllowCustomInput: false,
    },
  });

  const timelineEntry = buildQuickDesignConfirmedTimelineEntry({
    projectId: String(input.projectId ?? "").trim() || "unknown",
    nowIso: input.nowIso,
    confirmedCount: confirmedSlotKeys.length,
  });

  return {
    orchestration,
    fastPlanDraftV1: fastPlanDraftV1Confirmed,
    confirmedSlotKeys,
    confirmedLabels: [...new Set(confirmedLabels)].slice(0, 12),
    chatMessage,
    timelineEntry,
    blocked: false,
  };
}
