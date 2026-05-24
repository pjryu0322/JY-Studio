import type { PlatformDraftConfidence, PlatformMemberDraft } from "@/lib/platform-orchestration/types";
import {
  mergeOrchestrationSlotPatches,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
  SingleChatOrchestrationSlotStatus,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type FastPlanDraftSlotCandidatePatchV1 = Readonly<{
  readonly updatedSlotKeys: readonly string[];
  readonly candidateSlotKeys: readonly string[];
  readonly assumedSlotKeys: readonly string[];
  readonly patchedAt: string;
}>;

export type BuildSlotCandidatePatchesResult = Readonly<{
  readonly patches: readonly SlotPatchInput[];
  readonly updatedSlotKeys: readonly string[];
  readonly candidateSlotKeys: readonly string[];
  readonly assumedSlotKeys: readonly string[];
  readonly confirmedSlotKeys: readonly string[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotCandidatePatch: FastPlanDraftSlotCandidatePatchV1 | null;
}>;

const BULLET_PREFIX_BY_SUFFIX: Readonly<Record<string, readonly string[]>> = {
  ".planning.servicePurpose": ["서비스 목적"],
  ".planning.coreUsers": ["주 사용자"],
  ".planning.problem": ["핵심 문제"],
  ".planning.expectedOutcome": ["기대 효과"],
  ".planning.coreValue": ["기대 효과"],
  ".flow.actorTypes": ["주요 액터"],
  ".flow.serviceFlow": ["기본 서비스 흐름"],
  ".flow.approvalFlow": ["검토가 필요한 예외 흐름", "검토·승인"],
  ".design.coreFeatures": ["MVP 기능 후보"],
  ".design.featurePriority": ["우선순위"],
  ".design.requiredScreens": ["주요 화면 후보"],
  ".design.userJourney": ["사용자 동선"],
  ".architecture.systemResponsibility": ["데이터/API 후보"],
};

function slotSuffix(slotKey: string): string {
  const parts = String(slotKey ?? "").split(".");
  if (parts.length < 2) return slotKey;
  return `.${parts.slice(-2).join(".")}`;
}

function extractValueFromDraftContent(content: string, slotKey: string): string {
  const suffix = slotSuffix(slotKey);
  const prefixes = BULLET_PREFIX_BY_SUFFIX[suffix] ?? [];
  const lines = String(content ?? "").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("- ")) continue;
    const body = t.slice(2).trim();
    const colon = body.indexOf(":");
    if (colon < 0) continue;
    const head = body.slice(0, colon).trim();
    const value = body.slice(colon + 1).trim();
    if (!value) continue;
    if (prefixes.some((p) => head.includes(p))) return value;
  }
  const multi = lines
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().slice(2))
    .join("\n")
    .trim();
  return multi.slice(0, 4000);
}

function platformConfidenceToSlotStatus(confidence: PlatformDraftConfidence): SingleChatOrchestrationSlotStatus {
  if (confidence === "partial") return "partial";
  return "candidate";
}

function numericConfidence(confidence: PlatformDraftConfidence): number {
  if (confidence === "partial") return 0.72;
  if (confidence === "candidate") return 0.65;
  return 0.55;
}

function shouldSkipPatch(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null,
  slotKey: string,
): boolean {
  const row = findSlotRow(orchestration, slotKey);
  if (!row) return true;
  return String(row.status) === "confirmed";
}

export function buildSlotCandidatePatchesFromFastPlanDrafts(input: {
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
}): BuildSlotCandidatePatchesResult {
  const patchMap = new Map<string, SlotPatchInput>();
  const candidateSlotKeys: string[] = [];
  const assumedSlotKeys: string[] = [];
  const confirmedSlotKeys: string[] = [];

  for (const draft of input.memberDrafts) {
    const keys = draft.targetSlotKeys ?? [];
    for (const slotKey of keys) {
      if (!slotKey || shouldSkipPatch(input.orchestration, slotKey)) {
        if (slotKey && String(findSlotRow(input.orchestration, slotKey)?.status) === "confirmed") {
          confirmedSlotKeys.push(slotKey);
        }
        continue;
      }
      const value = extractValueFromDraftContent(draft.content, slotKey);
      if (!value.trim()) continue;
      const status = platformConfidenceToSlotStatus(draft.confidence);
      if (draft.confidence === "assumed_for_prototype") assumedSlotKeys.push(slotKey);
      else candidateSlotKeys.push(slotKey);
      patchMap.set(slotKey, {
        slotKey,
        status,
        value: value.slice(0, 4000),
        confidence: numericConfidence(draft.confidence),
        derivedFrom: `fast_plan_draft:${draft.role}`,
      });
    }
  }

  const patches = [...patchMap.values()];
  if (!patches.length || !input.orchestration) {
    return {
      patches,
      updatedSlotKeys: [],
      candidateSlotKeys,
      assumedSlotKeys,
      confirmedSlotKeys,
      orchestration: input.orchestration,
      slotCandidatePatch: null,
    };
  }

  const orchestration = mergeOrchestrationSlotPatches({
    base: input.orchestration,
    patches,
    nowIso: input.nowIso,
    definitions: input.definitions,
    propagateStaleFromPlanner: false,
  });

  const updatedSlotKeys = patches.map((p) => p.slotKey);
  const slotCandidatePatch: FastPlanDraftSlotCandidatePatchV1 = {
    updatedSlotKeys,
    candidateSlotKeys: [...new Set(candidateSlotKeys)],
    assumedSlotKeys: [...new Set(assumedSlotKeys)],
    patchedAt: input.nowIso,
  };

  return {
    patches,
    updatedSlotKeys,
    candidateSlotKeys: slotCandidatePatch.candidateSlotKeys,
    assumedSlotKeys: slotCandidatePatch.assumedSlotKeys,
    confirmedSlotKeys,
    orchestration,
    slotCandidatePatch,
  };
}
