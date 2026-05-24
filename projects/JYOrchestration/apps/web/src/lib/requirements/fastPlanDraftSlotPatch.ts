import type { PlatformDraftConfidence, PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import { newPlatformOrchestrationId } from "@/lib/platform-orchestration/platformIds";
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
import {
  classifyQuickDesignSlotArea,
  countQuickDesignAreaCounts,
  slotSuffixFromKey,
  type QuickDesignAreaCounts,
  type QuickDesignSlotPatchEntry,
} from "@/lib/requirements/quickDesignSlotArea";

export type { QuickDesignAreaCounts, QuickDesignSlotPatchEntry };

export type FastPlanDraftSlotCandidatePatchV1 = Readonly<{
  readonly source: "quick_design";
  readonly runId: string;
  readonly patchedSlotKeys: readonly string[];
  /** @deprecated use patchedSlotKeys */
  readonly updatedSlotKeys: readonly string[];
  readonly areaCounts: QuickDesignAreaCounts;
  readonly entries: readonly QuickDesignSlotPatchEntry[];
  readonly candidateSlotKeys: readonly string[];
  readonly assumedSlotKeys: readonly string[];
  readonly patchedAt: string;
}>;

export type BuildSlotCandidatePatchesResult = Readonly<{
  readonly patches: readonly SlotPatchInput[];
  readonly patchedSlotKeys: readonly string[];
  readonly updatedSlotKeys: readonly string[];
  readonly candidateSlotKeys: readonly string[];
  readonly assumedSlotKeys: readonly string[];
  readonly confirmedSlotKeys: readonly string[];
  readonly areaCounts: QuickDesignAreaCounts;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotCandidatePatch: FastPlanDraftSlotCandidatePatchV1 | null;
}>;

const BULLET_PREFIX_BY_SUFFIX: Readonly<Record<string, readonly string[]>> = {
  ".planning.servicePurpose": ["서비스 목적"],
  ".planning.coreUsers": ["주 사용자", "핵심 사용자"],
  ".planning.problem": ["핵심 문제", "문제 정의"],
  ".planning.expectedOutcome": ["기대 효과"],
  ".planning.coreValue": ["기대 효과", "핵심 가치"],
  ".planning.mvpScope": ["MVP 범위"],
  ".flow.actorTypes": ["주요 액터", "액터"],
  ".flow.serviceFlow": ["기본 서비스 흐름", "서비스 흐름"],
  ".flow.approvalFlow": ["검토가 필요한 예외", "예외 흐름", "승인"],
  ".flow.exceptionFlow": ["예외 흐름"],
  ".flow.collaborationFlow": ["협업"],
  ".flow.externalIntegration": ["외부 연동"],
  ".design.coreFeatures": ["MVP 기능", "핵심 기능"],
  ".design.featurePriority": ["우선순위", "기능 우선순위"],
  ".design.mvpExclusions": ["제외"],
  ".architecture.automationLevel": ["자동화"],
  ".architecture.prototypeBoundary": ["프로토타입 경계", "경계"],
  ".design.requiredScreens": ["주요 화면", "화면"],
  ".design.prototypeScope": ["프로토타입 범위", "화면 범위"],
  ".design.dataFlow": ["데이터", "API"],
  ".design.userInteractionMode": ["상호작용"],
};

const PLACEHOLDER_BY_SUFFIX: Readonly<Record<string, string>> = {
  ".planning.mvpScope": "1차 MVP는 핵심 흐름·필수 화면 중심으로 구성",
  ".flow.exceptionFlow": "오류·권한 거부·타임아웃 등 예외 흐름은 MVP 이후 단계에서 정교화",
  ".flow.collaborationFlow": "담당자 간 검토·승인 협업 흐름(초안)",
  ".architecture.automationLevel": "반복 작업은 API/배치로 자동화 검토",
  ".architecture.prototypeBoundary": "프로토타입은 핵심 사용자 시나리오와 주요 화면만 포함",
  ".design.prototypeScope": "핵심 시나리오를 검증할 최소 화면 묶음",
};

function extractValueFromDraftContent(content: string, slotKey: string): string {
  const suffix = slotSuffixFromKey(slotKey);
  const prefixes = BULLET_PREFIX_BY_SUFFIX[suffix] ?? [];
  const lines = String(content ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith("- ")) continue;
    const body = t.slice(2).trim();
    const colon = body.indexOf(":");
    if (colon < 0) continue;
    const head = body.slice(0, colon).trim();
    let value = body.slice(colon + 1).trim();
    if (!prefixes.some((p) => head.includes(p))) continue;
    if (!value) {
      const cont: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nt = lines[j].trim();
        if (nt.startsWith("- ")) break;
        if (nt) cont.push(nt);
      }
      value = cont.join("\n").trim();
    }
    if (value) return value;
  }
  const bullets = lines
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().slice(2))
    .join("\n")
    .trim();
  return bullets.slice(0, 4000);
}

function resolvePatchValue(draft: PlatformMemberDraft, slotKey: string): string {
  const extracted = extractValueFromDraftContent(draft.content, slotKey).trim();
  if (extracted) return extracted.slice(0, 4000);
  const suffix = slotSuffixFromKey(slotKey);
  const placeholder = PLACEHOLDER_BY_SUFFIX[suffix];
  if (placeholder) return placeholder;
  const compact = String(draft.content ?? "")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (compact) return compact.slice(0, 4000);
  return `Quick Design ${draft.role} 후보(대화에서 보완 필요)`;
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

function patchEntryStatus(
  confidence: PlatformDraftConfidence,
): QuickDesignSlotPatchEntry["status"] {
  if (confidence === "partial") return "partial";
  if (confidence === "assumed_for_prototype") return "assumed_for_prototype";
  return "candidate";
}

export function buildSlotCandidatePatchesFromFastPlanDrafts(input: {
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
  readonly runId?: string;
}): BuildSlotCandidatePatchesResult {
  const runId = String(input.runId ?? "").trim() || newPlatformOrchestrationId("qd");
  const patchMap = new Map<string, SlotPatchInput>();
  const entries: QuickDesignSlotPatchEntry[] = [];
  const candidateSlotKeys: string[] = [];
  const assumedSlotKeys: string[] = [];
  const confirmedSlotKeys: string[] = [];

  for (const draft of input.memberDrafts) {
    const keys = [...new Set(draft.targetSlotKeys ?? [])];
    for (const slotKey of keys) {
      if (!slotKey) continue;
      if (shouldSkipPatch(input.orchestration, slotKey)) {
        if (String(findSlotRow(input.orchestration, slotKey)?.status) === "confirmed") {
          confirmedSlotKeys.push(slotKey);
        }
        continue;
      }
      const value = resolvePatchValue(draft, slotKey);
      const status = platformConfidenceToSlotStatus(draft.confidence);
      const area = classifyQuickDesignSlotArea(slotKey);
      if (!area) continue;
      if (draft.confidence === "assumed_for_prototype") assumedSlotKeys.push(slotKey);
      else candidateSlotKeys.push(slotKey);
      entries.push({
        slotKey,
        area,
        status: patchEntryStatus(draft.confidence),
        sourceRole: draft.role,
        sourceDraftId: draft.draftId,
      });
      patchMap.set(slotKey, {
        slotKey,
        status,
        value,
        confidence: numericConfidence(draft.confidence),
        derivedFrom: `quick_design:${draft.role}`,
      });
    }
  }

  const patches = [...patchMap.values()];
  const patchedSlotKeys = patches.map((p) => p.slotKey);
  const areaCounts = countQuickDesignAreaCounts(patchedSlotKeys);

  if (!patches.length || !input.orchestration) {
    return {
      patches,
      patchedSlotKeys: [],
      updatedSlotKeys: [],
      candidateSlotKeys,
      assumedSlotKeys,
      confirmedSlotKeys,
      areaCounts,
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

  const slotCandidatePatch: FastPlanDraftSlotCandidatePatchV1 = {
    source: "quick_design",
    runId,
    patchedSlotKeys,
    updatedSlotKeys: patchedSlotKeys,
    areaCounts,
    entries,
    candidateSlotKeys: [...new Set(candidateSlotKeys)],
    assumedSlotKeys: [...new Set(assumedSlotKeys)],
    patchedAt: input.nowIso,
  };

  return {
    patches,
    patchedSlotKeys,
    updatedSlotKeys: patchedSlotKeys,
    candidateSlotKeys: slotCandidatePatch.candidateSlotKeys,
    assumedSlotKeys: slotCandidatePatch.assumedSlotKeys,
    confirmedSlotKeys,
    areaCounts,
    orchestration,
    slotCandidatePatch,
  };
}
