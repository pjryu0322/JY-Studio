import {
  REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT,
  buildRefineSelectedImplementationCandidatesPrompt,
  implementationCandidateLabelForKey,
} from "@/lib/requirements/implementationCandidateLabels";
import type { ImplementationSeedGapKey } from "@/lib/requirements/implementationSeed";

export const IMPLEMENTATION_CANDIDATE_REFINE_RESULT_INTERNAL_TYPE =
  "implementation_candidate_refine_result" as const;

export type ImplementationCandidateRefineMode = "all" | "selected";

export type ImplementationCandidateRefineRequestWire = Readonly<{
  readonly mode: ImplementationCandidateRefineMode;
  readonly keys: readonly ImplementationSeedGapKey[];
  readonly labels: readonly string[];
  readonly requestedAt: string;
}>;

const REFINE_ALL_PREFIX = REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT;

export function isImplementationCandidateRefinePrompt(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (t === REFINE_ALL_PREFIX || t.startsWith(REFINE_ALL_PREFIX)) return true;
  if (t.startsWith("다음 기획정보 후보 항목을 보완해 주세요:")) return true;
  if (t.startsWith("다음 기획정보 후보 항목을 적용해 주세요:")) return true;
  return false;
}

export function parseImplementationCandidateRefineFromUserMessage(
  text: string,
): ImplementationCandidateRefineRequestWire | null {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const nowIso = new Date().toISOString();

  if (t === REFINE_ALL_PREFIX || t.startsWith(REFINE_ALL_PREFIX)) {
    return { mode: "all", keys: [], labels: [], requestedAt: nowIso };
  }

  const selectedPrefix = "다음 기획정보 후보 항목을 보완해 주세요:";
  if (t.startsWith(selectedPrefix)) {
    const tail = t.slice(selectedPrefix.length).trim();
    const labels = tail
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const keys = labels
      .map((label) => labelToGapKey(label))
      .filter((k): k is ImplementationSeedGapKey => Boolean(k));
    return {
      mode: "selected",
      keys,
      labels: labels.length ? labels : keys.map(implementationCandidateLabelForKey),
      requestedAt: nowIso,
    };
  }

  return null;
}

function labelToGapKey(label: string): ImplementationSeedGapKey | null {
  const t = String(label ?? "").trim();
  const entries: [ImplementationSeedGapKey, string][] = [
    ["actor_function_matrix", "액터별 기능"],
    ["actor_permission_matrix", "액터별 권한"],
    ["process_actor_map", "프로세스-액터 매핑"],
    ["process_screen_map", "프로세스-화면 매핑"],
    ["screen_actor_matrix", "화면별 사용 액터"],
    ["screen_action_matrix", "화면별 액션"],
    ["screen_data_map", "화면별 데이터"],
    ["common_detail_features", "공통 상세 기능"],
    ["data_entities", "데이터 항목"],
    ["state_model", "상태 모델"],
    ["mock_data_strategy", "Mock 데이터 전략"],
  ];
  for (const [key, userLabel] of entries) {
    if (t === userLabel) return key;
  }
  return null;
}

export function mergeImplementationCandidateRefineRequest(input: {
  readonly wire: ImplementationCandidateRefineRequestWire | null | undefined;
  readonly userMessage: string;
  readonly fallbackKeys: readonly ImplementationSeedGapKey[];
}): ImplementationCandidateRefineRequestWire | null {
  if (input.wire?.mode) {
    const keys =
      input.wire.keys.length > 0 ? [...input.wire.keys] : [...input.fallbackKeys];
    const labels =
      input.wire.labels.length > 0
        ? [...input.wire.labels]
        : keys.map(implementationCandidateLabelForKey);
    return {
      mode: input.wire.mode,
      keys,
      labels,
      requestedAt: input.wire.requestedAt || new Date().toISOString(),
    };
  }
  const parsed = parseImplementationCandidateRefineFromUserMessage(input.userMessage);
  if (!parsed) return null;
  if (parsed.mode === "all" && input.fallbackKeys.length) {
    return {
      ...parsed,
      keys: [...input.fallbackKeys],
      labels: input.fallbackKeys.map(implementationCandidateLabelForKey),
    };
  }
  if (parsed.mode === "selected" && !parsed.keys.length && parsed.labels.length) {
    const keys = parsed.labels
      .map((l) => labelToGapKey(l))
      .filter((k): k is ImplementationSeedGapKey => Boolean(k));
    return { ...parsed, keys };
  }
  return parsed;
}

export function buildRefineSelectedImplementationCandidatesPromptFromWire(
  wire: ImplementationCandidateRefineRequestWire,
): string {
  if (wire.mode === "all") return REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT;
  return buildRefineSelectedImplementationCandidatesPrompt(wire.labels);
}
