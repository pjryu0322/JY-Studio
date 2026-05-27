import type { SlotPatchInput } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

const UI_INSTRUCTION_EXACT_PHRASES: readonly string[] = [
  "기획 정보를 보완하겠습니다. 수정할 슬롯이나 항목을 알려 주세요.",
  "기획정보 보완이 필요한 항목을 확인해 주세요.",
  "구현 전 확인이 필요한 기획정보 후보 항목 전체를 검토하고, 보완이 필요한 내용을 정리해 주세요.",
  "정밀 기획을 이어가겠습니다. 우선 확인할 슬롯을 알려 주세요.",
  "추가 보완을 이어가겠습니다. 우선 수정할 항목을 알려 주세요.",
] as const;

const UI_INSTRUCTION_PREFIXES: readonly string[] = [
  "다음 기획정보 후보 항목을 보완해 주세요:",
  "다음 기획정보 후보 항목을 적용해 주세요:",
  "다음 기획정보 후보 항목을 확정해 주세요:",
] as const;

const UI_INSTRUCTION_COMMAND_PATTERNS: readonly RegExp[] = [
  /^기획\s*정보를\s*보완하겠습니다/i,
  /^구현\s*전\s*확인이\s*필요한\s*기획정보\s*후보/i,
  /^다음\s*기획정보\s*후보\s*항목을\s*(보완|적용|확정)해\s*주세요/i,
  /^추가\s*보완을\s*이어가겠습니다/i,
  /^정밀\s*기획을\s*이어가겠습니다/i,
  /^수정할\s*항목을\s*알려\s*주세요\.?$/i,
  /^우선\s*(확인|수정)할\s*(슬롯|항목)을\s*알려\s*주세요/i,
];

/** planner·구현 준비 슬롯에 UI 명령문이 들어가는 것을 막기 위한 suffix */
export const PLANNER_SLOT_SUFFIXES_GUARDED_FROM_UI_INSTRUCTIONS: readonly string[] = [
  ".planning.mvpScope",
  ".planning.coreValue",
  ".planning.resolvePriority",
  ".planning.successCriteria",
  ".planning.problemStatement",
  ".planning.expectedOutcome",
] as const;

export function isUiInstructionLikePlanningValue(value: unknown): boolean {
  const t = String(value ?? "").trim();
  if (!t || t.length < 12) return false;
  if (UI_INSTRUCTION_EXACT_PHRASES.some((p) => t === p || t.includes(p))) return true;
  if (UI_INSTRUCTION_PREFIXES.some((p) => t.startsWith(p))) return true;
  if (UI_INSTRUCTION_COMMAND_PATTERNS.some((re) => re.test(t))) return true;
  return false;
}

function slotKeyMatchesGuardedSuffix(slotKey: string, suffixes: readonly string[]): boolean {
  const k = String(slotKey ?? "").trim();
  return suffixes.some((s) => k.endsWith(s) || k.includes(s));
}

export function sanitizePlannerSlotAdjustments(
  patches: readonly SlotPatchInput[],
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): readonly SlotPatchInput[] {
  const plannerKeys = new Set(
    definitions.filter((d) => d.ownerAgent === "planner").map((d) => d.slotKey),
  );
  const out: SlotPatchInput[] = [];
  for (const p of patches) {
    const key = String(p.slotKey ?? "").trim();
    if (!key) continue;
    const guarded =
      plannerKeys.has(key) ||
      slotKeyMatchesGuardedSuffix(key, PLANNER_SLOT_SUFFIXES_GUARDED_FROM_UI_INSTRUCTIONS);
    if (guarded && p.value !== undefined && p.value !== null && isUiInstructionLikePlanningValue(p.value)) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[planner_slot_update_filtered]", {
          reason: "ui_instruction_like_value",
          slot: key,
        });
      }
      continue;
    }
    out.push(p);
  }
  return out;
}

export function sanitizeUpdatedSlots(
  patches: readonly SlotPatchInput[],
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
): SlotPatchInput[] {
  return [...sanitizePlannerSlotAdjustments(patches, definitions)];
}

/** 기존 오염 값을 candidate/empty로 낮춤(확정된 실제 기획 값은 보존) */
export function repairUiInstructionContaminatedOrchestrationSlots(input: {
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  const nextSlots = { ...input.state.slots };
  let changed = false;
  for (const def of input.definitions) {
    const key = def.slotKey;
    const row = nextSlots[key];
    if (!row) continue;
    const guarded =
      def.ownerAgent === "planner" ||
      slotKeyMatchesGuardedSuffix(key, PLANNER_SLOT_SUFFIXES_GUARDED_FROM_UI_INSTRUCTIONS);
    if (!guarded) continue;
    const v = String(row.value ?? "").trim();
    if (!v || !isUiInstructionLikePlanningValue(v)) continue;
    nextSlots[key] = {
      ...row,
      status: "empty",
      value: null,
      staleReason: "ui_instruction_contamination_repaired",
      updatedAt: input.nowIso,
      revision: (row.revision ?? 0) + 1,
    };
    changed = true;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[planner_slot_update_filtered]", {
        reason: "ui_instruction_contamination_repair",
        slot: key,
      });
    }
  }
  if (!changed) return input.state;
  return { ...input.state, slots: nextSlots, updatedAt: input.nowIso };
}
