/**
 * Project SingleChat — slot orchestration actions (separate from service-flow QuickActionId).
 */

import type {
  SingleChatRecommendedOwnerAgent,
  SingleChatSlotFocusArea,
} from "@/lib/requirements/singleChatSlotNextAction";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";

export type SingleChatSlotActionId =
  | "CONFIRM_PLANNING_CORE"
  | "REFINE_TARGET_USERS"
  | "REFINE_CORE_PROBLEM"
  | "REFINE_EXPECTED_OUTCOME"
  | "REFINE_SERVICE_ACTORS"
  | "REFINE_SERVICE_FLOW"
  | "DEFINE_FEATURE_SCOPE"
  | "DEFINE_SCREEN_STRUCTURE"
  | "REVIEW_SLOT_GAPS"
  | "PREPARE_GENERATION"
  | "APPLY_SLOT_PROPOSAL"
  | "EDIT_SLOT_PROPOSAL"
  | "REGENERATE_SLOT_PROPOSAL";

export type SingleChatSlotActionWire = Readonly<{
  readonly kind: "slot_action";
  readonly id: SingleChatSlotActionId;
  readonly label: string;
  readonly focusArea: SingleChatSlotFocusArea;
  readonly ownerAgent: SingleChatRecommendedOwnerAgent;
  readonly targetSlotKeys?: readonly string[];
}>;

export const SLOT_ACTION_DEFAULT_LABEL: Readonly<Record<SingleChatSlotActionId, string>> = {
  CONFIRM_PLANNING_CORE: "기획 핵심 정리",
  REFINE_TARGET_USERS: "주 사용자 정리",
  REFINE_CORE_PROBLEM: "핵심 문제 정리",
  REFINE_EXPECTED_OUTCOME: "기대 효과 정리",
  REFINE_SERVICE_ACTORS: "서비스 액터 정리",
  REFINE_SERVICE_FLOW: "흐름 보완",
  DEFINE_FEATURE_SCOPE: "기능 범위 정리",
  DEFINE_SCREEN_STRUCTURE: "화면 구성 보기",
  REVIEW_SLOT_GAPS: "슬롯 누락 검토",
  PREPARE_GENERATION: "생성 준비",
  APPLY_SLOT_PROPOSAL: "이 기준으로 반영",
  EDIT_SLOT_PROPOSAL: "일부 수정",
  REGENERATE_SLOT_PROPOSAL: "다른 방향 보기",
};

const LABEL_TO_SLOT_ACTION_ID = new Map<string, SingleChatSlotActionId>(
  Object.entries(SLOT_ACTION_DEFAULT_LABEL).map(([id, label]) => [label, id as SingleChatSlotActionId]),
);

export function isSingleChatSlotActionId(raw: string | null | undefined): raw is SingleChatSlotActionId {
  return Boolean(raw && raw in SLOT_ACTION_DEFAULT_LABEL);
}

export function isSingleChatSlotActionWire(
  value: unknown,
): value is SingleChatSlotActionWire {
  if (!value || typeof value !== "object") return false;
  const v = value as SingleChatSlotActionWire;
  return v.kind === "slot_action" && isSingleChatSlotActionId(String(v.id ?? ""));
}

export function resolveSlotActionIdFromLabel(label: string | null | undefined): SingleChatSlotActionId | null {
  const s = String(label ?? "").trim();
  if (!s) return null;
  if (isSingleChatSlotActionId(s)) return s;
  return LABEL_TO_SLOT_ACTION_ID.get(s) ?? null;
}

export function planningCoreSlotKeys(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): readonly string[] {
  const keys = [
    ...findOrchestrationSlotKeysBySuffix(definitions, ".planning.servicePurpose"),
    ...findOrchestrationSlotKeysBySuffix(definitions, ".planning.coreUsers"),
    ...findOrchestrationSlotKeysBySuffix(definitions, ".planning.problem"),
    ...findOrchestrationSlotKeysBySuffix(definitions, ".planning.expectedOutcome"),
  ];
  const outcome = findOrchestrationSlotKeysBySuffix(definitions, ".planning.expectedOutcome");
  const coreValue = findOrchestrationSlotKeysBySuffix(definitions, ".planning.coreValue");
  if (!outcome.length && coreValue.length) return [...keys, ...coreValue];
  return keys;
}

export function slotActionWire(input: {
  readonly id: SingleChatSlotActionId;
  readonly label?: string;
  readonly focusArea: SingleChatSlotFocusArea;
  readonly ownerAgent: SingleChatRecommendedOwnerAgent;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly targetSlotKeys?: readonly string[];
}): SingleChatSlotActionWire {
  let targetSlotKeys = input.targetSlotKeys;
  if (!targetSlotKeys?.length && input.definitions) {
    if (input.id === "CONFIRM_PLANNING_CORE") targetSlotKeys = planningCoreSlotKeys(input.definitions);
    else if (input.id === "REFINE_TARGET_USERS") {
      targetSlotKeys = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.coreUsers");
    } else if (input.id === "REFINE_CORE_PROBLEM") {
      targetSlotKeys = findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.problem");
    } else if (input.id === "REFINE_EXPECTED_OUTCOME") {
      targetSlotKeys = [
        ...findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.expectedOutcome"),
        ...findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.coreValue"),
      ];
    }
  }
  return {
    kind: "slot_action",
    id: input.id,
    label: String(input.label ?? SLOT_ACTION_DEFAULT_LABEL[input.id]).trim(),
    focusArea: input.focusArea,
    ownerAgent: input.ownerAgent,
    ...(targetSlotKeys?.length ? { targetSlotKeys } : {}),
  };
}

export const PLANNING_FOLLOWUP_SLOT_ACTION_WIRES: readonly SingleChatSlotActionWire[] = [
  {
    kind: "slot_action",
    id: "APPLY_SLOT_PROPOSAL",
    label: "이 기준으로 반영",
    focusArea: "planning",
    ownerAgent: "planner",
  },
  {
    kind: "slot_action",
    id: "EDIT_SLOT_PROPOSAL",
    label: "일부 수정",
    focusArea: "planning",
    ownerAgent: "planner",
  },
  {
    kind: "slot_action",
    id: "REGENERATE_SLOT_PROPOSAL",
    label: "다른 방향 보기",
    focusArea: "planning",
    ownerAgent: "planner",
  },
];
