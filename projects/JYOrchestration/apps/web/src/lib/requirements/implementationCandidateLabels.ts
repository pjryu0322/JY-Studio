import {
  IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS,
  resolveImplementationSeedSlotSnapshots,
  type ImplementationSeedGapKey,
} from "@/lib/requirements/implementationSeed";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type ImplementationCandidateItemStatus = "candidate" | "confirmed" | "missing" | "unknown";

export type ImplementationCandidateItem = Readonly<{
  readonly key: ImplementationSeedGapKey;
  readonly label: string;
  readonly description: string;
  readonly status: ImplementationCandidateItemStatus;
}>;

/** Quick Design 확정 후 사용자 화면용 라벨 (내부 gap key 노출 금지) */
const IMPLEMENTATION_CANDIDATE_USER_LABELS: Readonly<Record<ImplementationSeedGapKey, string>> = {
  actor_function_matrix: "액터별 기능",
  actor_permission_matrix: "액터별 권한",
  process_actor_map: "프로세스-액터 매핑",
  process_screen_map: "프로세스-화면 매핑",
  screen_actor_matrix: "화면별 사용 액터",
  screen_action_matrix: "화면별 액션",
  screen_data_map: "화면별 데이터",
  common_detail_features: "공통 상세 기능",
  data_entities: "데이터 항목",
  state_model: "상태 모델",
  mock_data_strategy: "Mock 데이터 전략",
};

const IMPLEMENTATION_CANDIDATE_DESCRIPTIONS: Readonly<Record<ImplementationSeedGapKey, string>> = {
  actor_function_matrix: "액터별로 사용할 수 있는 기능 범위를 확인해야 합니다.",
  actor_permission_matrix: "사용자/관리자/검수자의 권한 범위를 확인해야 합니다.",
  process_actor_map: "업무 단계별 참여 액터를 확인해야 합니다.",
  process_screen_map: "업무 흐름과 화면의 연결 관계를 확인해야 합니다.",
  screen_actor_matrix: "각 화면을 누가 사용하는지 확인해야 합니다.",
  screen_action_matrix: "화면에서 가능한 주요 사용자 액션을 확인해야 합니다.",
  screen_data_map: "화면에 표시·입력되는 데이터를 확인해야 합니다.",
  common_detail_features: "여러 화면에서 공통으로 필요한 상세 기능을 확인해야 합니다.",
  data_entities: "서비스에서 다룰 주요 데이터를 확인해야 합니다.",
  state_model: "회의록/TODO/검수 상태 흐름을 확인해야 합니다.",
  mock_data_strategy: "프로토타입에서 사용할 예시 데이터를 확인해야 합니다.",
};

export const REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT =
  "구현 전 확인이 필요한 기획정보 후보 항목 전체를 검토하고, 보완이 필요한 내용을 정리해 주세요." as const;

export function implementationCandidateLabelForKey(key: string): string {
  const k = key as ImplementationSeedGapKey;
  return IMPLEMENTATION_CANDIDATE_USER_LABELS[k] ?? "기획정보 항목";
}

export function implementationCandidateDescriptionForKey(key: string): string {
  const k = key as ImplementationSeedGapKey;
  return (
    IMPLEMENTATION_CANDIDATE_DESCRIPTIONS[k] ??
    "구현 전에 내용을 확인·보완해야 합니다."
  );
}

export function buildImplementationCandidateItems(
  keys: readonly string[],
  status: ImplementationCandidateItemStatus = "candidate",
): readonly ImplementationCandidateItem[] {
  const seen = new Set<ImplementationSeedGapKey>();
  const out: ImplementationCandidateItem[] = [];
  for (const raw of keys) {
    const key = String(raw ?? "").trim() as ImplementationSeedGapKey;
    if (!key || seen.has(key)) continue;
    if (!(key in IMPLEMENTATION_CANDIDATE_USER_LABELS)) continue;
    seen.add(key);
    out.push({
      key,
      label: implementationCandidateLabelForKey(key),
      description: implementationCandidateDescriptionForKey(key),
      status,
    });
  }
  return out;
}

export function buildRefineSelectedImplementationCandidatesPrompt(
  labels: readonly string[],
): string {
  const trimmed = labels.map((l) => String(l ?? "").trim()).filter(Boolean);
  if (!trimmed.length) return "";
  return `다음 기획정보 후보 항목을 보완해 주세요: ${trimmed.join(", ")}`;
}

/** Quick Design confirm prep·메시지·보완 패널에서 공통으로 쓰는 후보 gap key 목록 */
export function resolveImplementationCandidateGapKeys(input: {
  readonly touchedGapKeys?: readonly ImplementationSeedGapKey[] | null;
  readonly autoCandidateGenerated?: boolean;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions?: readonly SingleChatOrchestrationSlotDefinition[] | null;
}): readonly ImplementationSeedGapKey[] {
  const touched = (input.touchedGapKeys ?? []).filter(Boolean);
  if (touched.length > 0) return touched;

  if (input.orchestration && input.definitions?.length) {
    const fromSlots = resolveImplementationSeedSlotSnapshots({
      orchestration: input.orchestration,
      definitions: input.definitions,
    })
      .filter((s) => s.fill === "candidate")
      .map((s) => s.gapKey);
    if (fromSlots.length > 0) return fromSlots;
  }

  // Prep가 autoCandidateGenerated였으나 touchedGapKeys가 메시지에 없는 레거시·엣지 케이스용.
  if (input.autoCandidateGenerated) {
    return [...IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS];
  }

  return [];
}

export function formatImplementationCandidateSummaryLines(
  keys: readonly ImplementationSeedGapKey[],
): readonly string[] {
  if (!keys.length) return [];
  return buildImplementationCandidateItems(keys).map((item) => `- ${item.label}: 후보`);
}
