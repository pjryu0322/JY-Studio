import {
  REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT,
  buildRefineSelectedImplementationCandidatesPrompt,
  implementationCandidateLabelForKey,
} from "@/lib/requirements/implementationCandidateLabels";
import type { ImplementationSeedGapKey } from "@/lib/requirements/implementationSeed";

export const IMPLEMENTATION_CANDIDATE_REFINE_RESULT_INTERNAL_TYPE =
  "implementation_candidate_refine_result" as const;

export const IMPLEMENTATION_CANDIDATE_REFINE_APPLY_RESULT_INTERNAL_TYPE =
  "implementation_candidate_refine_apply_result" as const;

export type ImplementationCandidateRefineMode = "all" | "selected";

export type ImplementationCandidateRefineRequestKind = "review" | "apply";

export type ImplementationCandidateRefineRequestWire = Readonly<{
  readonly mode: ImplementationCandidateRefineMode;
  readonly kind?: ImplementationCandidateRefineRequestKind;
  readonly keys: readonly ImplementationSeedGapKey[];
  readonly labels: readonly string[];
  readonly requestedAt: string;
}>;

const REFINE_ALL_PREFIX = REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT;

const APPLY_ALL_PREFIX = "기획정보 후보 항목 전체 보완안을 적용해 주세요";
const APPLY_SELECTED_PREFIXES = [
  "다음 기획정보 후보 항목 보완안을 적용해 주세요:",
  "다음 기획정보 후보 항목을 적용해 주세요:",
] as const;

const REVIEW_SELECTED_PREFIX = "다음 기획정보 후보 항목을 보완해 주세요:";

export function refineRequestKind(
  wire: ImplementationCandidateRefineRequestWire,
): ImplementationCandidateRefineRequestKind {
  return wire.kind === "apply" ? "apply" : "review";
}

export function isImplementationCandidateRefineApplyPrompt(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (t === APPLY_ALL_PREFIX || t.startsWith(APPLY_ALL_PREFIX)) return true;
  return APPLY_SELECTED_PREFIXES.some((p) => t.startsWith(p));
}

export function isImplementationCandidateRefineReviewPrompt(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (t === REFINE_ALL_PREFIX || t.startsWith(REFINE_ALL_PREFIX)) return true;
  if (t.startsWith(REVIEW_SELECTED_PREFIX)) return true;
  return false;
}

export function isImplementationCandidateRefinePrompt(text: string): boolean {
  return isImplementationCandidateRefineApplyPrompt(text) || isImplementationCandidateRefineReviewPrompt(text);
}

function parseLabelsFromTail(tail: string): { readonly labels: string[]; readonly keys: ImplementationSeedGapKey[] } {
  const labels = tail
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keys = labels
    .map((label) => labelToGapKey(label))
    .filter((k): k is ImplementationSeedGapKey => Boolean(k));
  return {
    labels: labels.length ? labels : keys.map(implementationCandidateLabelForKey),
    keys,
  };
}

export function parseImplementationCandidateRefineApplyFromUserMessage(
  text: string,
): ImplementationCandidateRefineRequestWire | null {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const nowIso = new Date().toISOString();

  if (t === APPLY_ALL_PREFIX || t.startsWith(APPLY_ALL_PREFIX)) {
    return { mode: "all", kind: "apply", keys: [], labels: [], requestedAt: nowIso };
  }

  for (const prefix of APPLY_SELECTED_PREFIXES) {
    if (!t.startsWith(prefix)) continue;
    const { labels, keys } = parseLabelsFromTail(t.slice(prefix.length).trim());
    return { mode: "selected", kind: "apply", keys, labels, requestedAt: nowIso };
  }

  return null;
}

export function parseImplementationCandidateRefineReviewFromUserMessage(
  text: string,
): ImplementationCandidateRefineRequestWire | null {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const nowIso = new Date().toISOString();

  if (t === REFINE_ALL_PREFIX || t.startsWith(REFINE_ALL_PREFIX)) {
    return { mode: "all", kind: "review", keys: [], labels: [], requestedAt: nowIso };
  }

  if (t.startsWith(REVIEW_SELECTED_PREFIX)) {
    const { labels, keys } = parseLabelsFromTail(t.slice(REVIEW_SELECTED_PREFIX.length).trim());
    return { mode: "selected", kind: "review", keys, labels, requestedAt: nowIso };
  }

  return null;
}

export function parseImplementationCandidateRefineFromUserMessage(
  text: string,
): ImplementationCandidateRefineRequestWire | null {
  return (
    parseImplementationCandidateRefineApplyFromUserMessage(text) ??
    parseImplementationCandidateRefineReviewFromUserMessage(text)
  );
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
      kind: input.wire.kind ?? "review",
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
  if (wire.kind === "apply") {
    if (wire.mode === "all") {
      return `${APPLY_ALL_PREFIX}. 적용된 항목과 남은 확인 항목을 정리해 주세요.`;
    }
    const list = wire.labels.join(", ");
    return `${APPLY_SELECTED_PREFIXES[0]} ${list}`;
  }
  if (wire.mode === "all") return REFINE_ALL_IMPLEMENTATION_CANDIDATES_PROMPT;
  return buildRefineSelectedImplementationCandidatesPrompt(wire.labels);
}
