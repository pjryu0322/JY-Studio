import {
  buildImplementationCandidateItems,
  implementationCandidateLabelForKey,
  resolveImplementationCandidateGapKeys,
} from "@/lib/requirements/implementationCandidateLabels";
import { implementationCandidateRefineApplyResultChips } from "@/lib/requirements/implementationCandidateRefineCta";
import type { ImplementationCandidateRefineMode } from "@/lib/requirements/implementationCandidateRefineRequest";
import {
  IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS,
  IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP,
  resolveImplementationSeedSlotSnapshots,
  type ImplementationSeedGapKey,
} from "@/lib/requirements/implementationSeed";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import {
  mergeOrchestrationSlotPatches,
  type SlotPatchInput,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type ImplementationCandidateRefineResultStatus =
  | "refined"
  | "needs_confirmation"
  | "not_enough_context";

export type ImplementationCandidateRefineNextActionLabel =
  | "확정 가능"
  | "추가 확인"
  | "정보 부족";

export type ImplementationCandidateRefineResultItem = Readonly<{
  readonly key: ImplementationSeedGapKey;
  readonly label: string;
  readonly beforeStatus: "candidate" | "confirmed" | "missing" | "unknown";
  readonly refinedValue: string;
  readonly resultStatus: ImplementationCandidateRefineResultStatus;
  readonly nextActionLabel: ImplementationCandidateRefineNextActionLabel;
}>;

export type ImplementationCandidateRefineSummary = Readonly<{
  readonly targetCount: number;
  readonly reviewedCount: number;
  readonly confirmableCount: number;
  readonly needsConfirmationCount: number;
}>;

const NEEDS_EXTRA_CONFIRMATION_KEYS: ReadonlySet<ImplementationSeedGapKey> = new Set([
  "actor_permission_matrix",
  "screen_data_map",
  "state_model",
  "mock_data_strategy",
  "data_entities",
  "process_actor_map",
]);

const REFINED_VALUE_HINTS: Readonly<Partial<Record<ImplementationSeedGapKey, string>>> = {
  actor_function_matrix: "서비스 이용자·검수자·관리자·시스템별 기능 범위를 정리했습니다.",
  screen_action_matrix: "입력·처리·결과·관리 화면별 주요 버튼과 액션을 정리했습니다.",
  process_screen_map: "업로드→처리→결과 확인 흐름과 화면 연결을 정리했습니다.",
  common_detail_features: "로딩, 오류, 빈 결과, 재시도, 권한 없음, 임시 저장을 공통 기능으로 정리했습니다.",
  data_entities: "사용자, 작업 요청, 처리 결과, 검수 의견, 처리 이력을 후보 데이터로 정리했습니다.",
  actor_permission_matrix: "사용자/검수자/관리자의 조회·수정·승인·관리 권한 초안을 정리했습니다.",
  screen_actor_matrix: "각 화면을 사용하는 액터를 정리했습니다.",
  screen_data_map: "화면별 표시·입력 데이터를 정리했습니다.",
  state_model: "업로드, 처리중, 완료, 검토요청, 승인, 실패 상태를 정리했습니다.",
  mock_data_strategy: "프로토타입용 JSON Mock과 시드 데이터 3~5건 전략을 정리했습니다.",
  process_actor_map: "업무 단계별 참여 액터를 정리했습니다.",
};

function summarizeSlotValue(raw: string): string {
  const lines = String(raw ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  if (lines.length <= 4) return lines.join(", ");
  return `${lines.slice(0, 4).join(", ")} 등`;
}

function beforeStatusForGap(
  snap: ReturnType<typeof resolveImplementationSeedSlotSnapshots>[number] | undefined,
): ImplementationCandidateRefineResultItem["beforeStatus"] {
  if (!snap) return "unknown";
  if (snap.fill === "confirmed") return "confirmed";
  if (snap.fill === "candidate") return "candidate";
  return "missing";
}

function buildRefinedValueForGap(
  gapKey: ImplementationSeedGapKey,
  slotValue: string,
): { readonly refinedValue: string; readonly resultStatus: ImplementationCandidateRefineResultStatus } {
  const hint = REFINED_VALUE_HINTS[gapKey] ?? "";
  const summarized = summarizeSlotValue(slotValue);
  const refinedValue = hint || summarized;
  if (!refinedValue) {
    return { refinedValue: "현재 대화·산출물만으로는 구체화가 부족합니다.", resultStatus: "not_enough_context" };
  }
  if (NEEDS_EXTRA_CONFIRMATION_KEYS.has(gapKey)) {
    return { refinedValue, resultStatus: "needs_confirmation" };
  }
  return { refinedValue, resultStatus: "refined" };
}

function nextActionLabelFor(
  status: ImplementationCandidateRefineResultStatus,
): ImplementationCandidateRefineNextActionLabel {
  if (status === "not_enough_context") return "정보 부족";
  if (status === "needs_confirmation") return "추가 확인";
  return "확정 가능";
}

export function buildImplementationCandidateRefineResultItems(input: {
  readonly keys: readonly ImplementationSeedGapKey[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): readonly ImplementationCandidateRefineResultItem[] {
  const snapshots = resolveImplementationSeedSlotSnapshots({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  const snapByKey = new Map(snapshots.map((s) => [s.gapKey, s]));

  return input.keys.map((gapKey) => {
    const snap = snapByKey.get(gapKey);
    const slotValue = String(snap?.value ?? "").trim();
    const { refinedValue, resultStatus } = buildRefinedValueForGap(gapKey, slotValue);
    const label = buildImplementationCandidateItems([gapKey])[0]?.label ?? gapKey;
    return {
      key: gapKey,
      label,
      beforeStatus: beforeStatusForGap(snap),
      refinedValue,
      resultStatus,
      nextActionLabel: nextActionLabelFor(resultStatus),
    };
  });
}

export function summarizeImplementationCandidateRefineResult(
  items: readonly ImplementationCandidateRefineResultItem[],
): ImplementationCandidateRefineSummary {
  const targetCount = items.length;
  const reviewedCount = items.filter((i) => i.resultStatus !== "not_enough_context").length;
  const confirmableCount = items.filter((i) => i.nextActionLabel === "확정 가능").length;
  const needsConfirmationCount = items.filter((i) => i.nextActionLabel === "추가 확인").length;
  return { targetCount, reviewedCount, confirmableCount, needsConfirmationCount };
}

export function implementationCandidateRefineResultChips(mode: ImplementationCandidateRefineMode): readonly string[] {
  const apply =
    mode === "all" ? "전체 보완안 적용" : ("선택 보완안 적용" as const);
  return [apply, "항목별 수정", "추가 확인 필요 항목만 보기", "다시 검토", "나중에 검토"];
}

export function formatImplementationCandidateRefineResultMessage(input: {
  readonly mode: ImplementationCandidateRefineMode;
  readonly items: readonly ImplementationCandidateRefineResultItem[];
  readonly summary: ImplementationCandidateRefineSummary;
}): string {
  const title =
    input.mode === "all"
      ? "기획정보 후보 항목 전체 검토 결과입니다."
      : "선택한 기획정보 후보 항목 검토 결과입니다.";

  const tableHeader = "| 항목 | 현재 상태 | 보완 결과 | 다음 처리 |";
  const tableSep = "|---|---|---|---|";
  const rows = input.items.map(
    (item) =>
      `| ${item.label} | 후보 | ${item.refinedValue} | ${item.nextActionLabel} |`,
  );

  const recommendation =
    input.summary.needsConfirmationCount > 0
      ? input.mode === "all"
        ? "추천: 추가 확인이 필요한 항목만 먼저 확인한 뒤 전체 보완안을 적용하는 것이 안전합니다."
        : "추천: 위 항목은 구현 영향이 크므로 적용 전 한 번 더 확인하는 것이 좋습니다."
      : "추천: 검토된 항목을 보완안 적용으로 반영할 수 있습니다.";

  return [
    title,
    "",
    "검토 요약:",
    `- 처리 대상: ${input.summary.targetCount}개`,
    `- 검토 완료: ${input.summary.reviewedCount}개`,
    `- 확정 가능: ${input.summary.confirmableCount}개`,
    `- 추가 확인 필요: ${input.summary.needsConfirmationCount}개`,
    "",
    tableHeader,
    tableSep,
    ...rows,
    "",
    recommendation,
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");
}

export function runImplementationCandidateRefineTurn(input: {
  readonly mode: ImplementationCandidateRefineMode;
  readonly keys: readonly ImplementationSeedGapKey[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
  readonly autoCandidateGenerated?: boolean;
}): Readonly<{
  readonly assistantMessage: string;
  readonly interviewSuggestions: readonly string[];
  readonly items: readonly ImplementationCandidateRefineResultItem[];
  readonly summary: ImplementationCandidateRefineSummary;
  readonly nextState: RequirementsSingleChatOrchestrationStateV1;
  readonly resolvedKeys: readonly ImplementationSeedGapKey[];
}> {
  const resolvedKeys =
    input.keys.length > 0
      ? [...input.keys]
      : resolveImplementationCandidateGapKeys({
          touchedGapKeys: input.keys,
          autoCandidateGenerated: input.autoCandidateGenerated ?? true,
          orchestration: input.orchestration,
          definitions: input.definitions,
        });

  const keysForMode =
    input.mode === "all" && resolvedKeys.length === 0
      ? ([...IMPLEMENTATION_SEED_RECOMMENDED_GAP_KEYS] as ImplementationSeedGapKey[])
      : resolvedKeys;

  const items = buildImplementationCandidateRefineResultItems({
    keys: keysForMode,
    orchestration: input.orchestration,
    definitions: input.definitions,
  });
  const summary = summarizeImplementationCandidateRefineResult(items);
  const assistantMessage = formatImplementationCandidateRefineResultMessage({
    mode: input.mode,
    items,
    summary,
  });

  return {
    assistantMessage,
    interviewSuggestions: implementationCandidateRefineResultChips(input.mode),
    items,
    summary,
    nextState: input.orchestration,
    resolvedKeys: keysForMode,
  };
}

export function buildApplyImplementationCandidateRefinePatches(input: {
  readonly keys: readonly ImplementationSeedGapKey[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 {
  const patches: SlotPatchInput[] = [];
  for (const gapKey of input.keys) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0];
    if (!slotKey) continue;
    const row = input.orchestration.slots[slotKey];
    if (!row) continue;
    const value = String(row.value ?? "").trim();
    if (!value) continue;
    patches.push({
      slotKey,
      status: "partial",
      value,
      staleReason: "implementation_candidate_refine_applied",
    });
  }
  if (!patches.length) return input.orchestration;
  return mergeOrchestrationSlotPatches({
    base: input.orchestration,
    patches,
    nowIso: input.nowIso,
    definitions: input.definitions,
  });
}

export function filterRefineResultItemsNeedingConfirmation(
  items: readonly ImplementationCandidateRefineResultItem[],
): readonly ImplementationCandidateRefineResultItem[] {
  return items.filter((i) => i.nextActionLabel === "추가 확인");
}

export type ImplementationCandidateRefineApplySummary = Readonly<{
  readonly targetCount: number;
  readonly appliedCount: number;
  readonly needsConfirmationCount: number;
}>;

export function formatImplementationCandidateRefineApplyResultMessage(input: {
  readonly mode: ImplementationCandidateRefineMode;
  readonly appliedKeys: readonly ImplementationSeedGapKey[];
  readonly remainingKeys: readonly ImplementationSeedGapKey[];
  readonly summary: ImplementationCandidateRefineApplySummary;
}): string {
  const title =
    input.mode === "all" ? "전체 보완안 적용 결과입니다." : "선택 보완안 적용 결과입니다.";

  const appliedLines = input.appliedKeys.map(
    (key) => `- ${implementationCandidateLabelForKey(key)}: partial 반영`,
  );
  const remainingLines = input.remainingKeys.map(
    (key) => `- ${implementationCandidateLabelForKey(key)}`,
  );

  return [
    title,
    "",
    "적용 요약:",
    `- 적용 대상: ${input.summary.targetCount}개`,
    `- partial 반영: ${input.summary.appliedCount}개`,
    `- 추가 확인 유지: ${input.summary.needsConfirmationCount}개`,
    "",
    "적용 항목:",
    ...(appliedLines.length ? appliedLines : ["- (적용된 항목 없음)"]),
    "",
    "남은 확인 항목:",
    ...(remainingLines.length ? remainingLines : ["- (남은 확인 항목 없음)"]),
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");
}

export function runImplementationCandidateRefineApplyTurn(input: {
  readonly mode: ImplementationCandidateRefineMode;
  readonly appliedKeys: readonly ImplementationSeedGapKey[];
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly autoCandidateGenerated?: boolean;
}): Readonly<{
  readonly assistantMessage: string;
  readonly interviewSuggestions: readonly string[];
  readonly appliedKeys: readonly ImplementationSeedGapKey[];
  readonly remainingKeys: readonly ImplementationSeedGapKey[];
  readonly needsConfirmationKeys: readonly ImplementationSeedGapKey[];
  readonly summary: ImplementationCandidateRefineApplySummary;
  readonly nextState: RequirementsSingleChatOrchestrationStateV1;
}> {
  const allKeys = resolveImplementationCandidateGapKeys({
    orchestration: input.orchestration,
    definitions: input.definitions,
    autoCandidateGenerated: input.autoCandidateGenerated ?? true,
  });

  const appliedKeysResolved =
    input.appliedKeys.length > 0
      ? [...input.appliedKeys]
      : input.mode === "all"
        ? [...allKeys]
        : [];

  const appliedSet = new Set(appliedKeysResolved);
  const reviewItems = buildImplementationCandidateRefineResultItems({
    keys: allKeys,
    orchestration: input.orchestration,
    definitions: input.definitions,
  });

  const needsConfirmationKeys = reviewItems
    .filter((i) => i.nextActionLabel === "추가 확인")
    .map((i) => i.key);

  const remainingKeys = allKeys.filter((k) => !appliedSet.has(k));

  let appliedCount = 0;
  for (const gapKey of appliedKeysResolved) {
    const suffix = IMPLEMENTATION_SEED_SLOT_SUFFIX_BY_GAP[gapKey];
    const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0];
    const row = slotKey ? input.orchestration.slots[slotKey] : null;
    const status = String(row?.status ?? "").trim().toLowerCase();
    if (status === "partial" || row?.staleReason === "implementation_candidate_refine_applied") {
      appliedCount += 1;
    }
  }

  const needsConfirmationRemaining = remainingKeys.filter((k) =>
    needsConfirmationKeys.includes(k),
  ).length;

  const summary: ImplementationCandidateRefineApplySummary = {
    targetCount: appliedKeysResolved.length,
    appliedCount,
    needsConfirmationCount: needsConfirmationRemaining,
  };

  const assistantMessage = formatImplementationCandidateRefineApplyResultMessage({
    mode: input.mode,
    appliedKeys: appliedKeysResolved,
    remainingKeys,
    summary,
  });

  return {
    assistantMessage,
    interviewSuggestions: implementationCandidateRefineApplyResultChips(),
    appliedKeys: appliedKeysResolved,
    remainingKeys,
    needsConfirmationKeys,
    summary,
    nextState: input.orchestration,
  };
}
