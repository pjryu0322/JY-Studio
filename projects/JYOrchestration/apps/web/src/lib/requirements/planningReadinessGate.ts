import { findOrchestrationSlotKeysBySuffix, findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

const REQUIRED_SUFFIXES_FOR_GENERATION: readonly string[] = [
  ".planning.servicePurpose",
  ".planning.coreUsers",
  ".planning.problem",
  ".planning.expectedOutcome",
  ".flow.actorTypes",
  ".flow.serviceFlow",
  ".design.coreFeatures",
  ".design.requiredScreens",
];

const SUFFIX_LABEL: Readonly<Record<string, string>> = {
  ".planning.servicePurpose": "서비스 목적",
  ".planning.coreUsers": "주 사용자",
  ".planning.problem": "핵심 문제",
  ".planning.expectedOutcome": "기대 효과",
  ".planning.coreValue": "기대 효과",
  ".flow.actorTypes": "주요 액터",
  ".flow.serviceFlow": "서비스 흐름",
  ".design.coreFeatures": "MVP 기능 후보",
  ".design.requiredScreens": "주요 화면 후보",
};

export type PlanningToGenerationReadiness = Readonly<{
  readonly ready: boolean;
  readonly missingRequiredSlotKeys: readonly string[];
  readonly missingRequiredLabels: readonly string[];
  readonly reason: string | null;
}>;

export function evaluatePlanningToGenerationReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): PlanningToGenerationReadiness {
  const missingKeys: string[] = [];
  const missingLabels: string[] = [];

  for (const suffix of REQUIRED_SUFFIXES_FOR_GENERATION) {
    const key = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0];
    if (!key) continue;
    const row = findSlotRow(input.orchestration, key);
    const status = normalizeSlotStatus(String(row?.status ?? "empty"));
    const value = String(row?.value ?? "").trim();
    if (status !== "confirmed" || value.length < 4) {
      missingKeys.push(key);
      missingLabels.push(SUFFIX_LABEL[suffix] ?? row?.label ?? key);
    }
  }

  if (!missingKeys.length) {
    return {
      ready: true,
      missingRequiredSlotKeys: [],
      missingRequiredLabels: [],
      reason: null,
    };
  }

  const preview = missingLabels.slice(0, 6).join(", ");
  return {
    ready: false,
    missingRequiredSlotKeys: missingKeys,
    missingRequiredLabels: missingLabels,
    reason: `구현 단계로 이동하려면 필수 슬롯을 먼저 확정해 주세요. 부족: ${preview}${missingLabels.length > 6 ? " …" : ""}`,
  };
}
