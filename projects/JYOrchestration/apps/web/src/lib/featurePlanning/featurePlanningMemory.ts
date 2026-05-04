import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { parsePlanningTopic } from "@/lib/featurePlanning/featurePlanningTopic";

/**
 * 기능정리 대화용 영구 메모리 — `featurePlanningSlotsV1.planningMemoryV1`에 저장.
 * 전체 채팅 원문을 매 턴 보내지 않고도 맥락을 유지한다.
 */
export type FeaturePlanningMemoryV1 = {
  readonly priorityFeature?: string;
  readonly addedFeatures: readonly string[];
  readonly removedFeatures: readonly string[];
  /** 사용자가 단계를 마쳤다고 본 주제(누적) */
  readonly confirmedTopics: readonly FeaturePlanningTopicV1[];
  readonly pendingTopic?: FeaturePlanningTopicV1;
  /** 짧은 의도 라벨(선택) */
  readonly lastUserIntent?: string;
  readonly notes?: readonly string[];
  /** planner 질문 큐가 적용된 서비스 단계 키(normalizePlannerQueueStepKey) */
  readonly plannerQueueStepKey?: string;
  /** 질문 큐에서 이미 다룬 세부 항목 id */
  readonly answeredPlannerFieldIds?: readonly string[];
};

export function defaultFeaturePlanningMemory(): FeaturePlanningMemoryV1 {
  return {
    addedFeatures: [],
    removedFeatures: [],
    confirmedTopics: [],
    pendingTopic: "FEATURES",
    answeredPlannerFieldIds: [],
  };
}

function dedupeStrings(xs: readonly string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

function dedupeTopics(xs: readonly FeaturePlanningTopicV1[], cap: number): FeaturePlanningTopicV1[] {
  const seen = new Set<FeaturePlanningTopicV1>();
  const out: FeaturePlanningTopicV1[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
    if (out.length >= cap) break;
  }
  return out;
}

export function parsePlanningMemoryPatch(raw: unknown): Partial<FeaturePlanningMemoryV1> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const priorityFeature = typeof o.priorityFeature === "string" ? o.priorityFeature.trim().slice(0, 400) : undefined;
  const lastUserIntent = typeof o.lastUserIntent === "string" ? o.lastUserIntent.trim().slice(0, 200) : undefined;
  const addedFeatures = Array.isArray(o.addedFeatures)
    ? dedupeStrings(
        o.addedFeatures.map((x) => String(x ?? "")),
        24
      )
    : undefined;
  const removedFeatures = Array.isArray(o.removedFeatures)
    ? dedupeStrings(
        o.removedFeatures.map((x) => String(x ?? "")),
        24
      )
    : undefined;
  const confirmedRaw = Array.isArray(o.confirmedTopics) ? o.confirmedTopics : [];
  const confirmedTopics = confirmedRaw
    .map((x) => parsePlanningTopic(x))
    .filter((x): x is FeaturePlanningTopicV1 => Boolean(x));
  const pendingTopic = parsePlanningTopic(o.pendingTopic);
  const notes = Array.isArray(o.notes)
    ? dedupeStrings(
        o.notes.map((x) => String(x ?? "")),
        12
      )
    : undefined;
  const plannerQueueStepKey =
    typeof o.plannerQueueStepKey === "string" ? o.plannerQueueStepKey.trim().slice(0, 120) : undefined;
  const answeredPlannerFieldIds = Array.isArray(o.answeredPlannerFieldIds)
    ? dedupeStrings(
        o.answeredPlannerFieldIds.map((x) => String(x ?? "")),
        40
      )
    : undefined;
  if (
    !priorityFeature &&
    !lastUserIntent &&
    !addedFeatures?.length &&
    !removedFeatures?.length &&
    !confirmedTopics.length &&
    !pendingTopic &&
    !notes?.length &&
    !plannerQueueStepKey &&
    !answeredPlannerFieldIds?.length
  ) {
    return undefined;
  }
  return {
    ...(priorityFeature ? { priorityFeature } : {}),
    ...(addedFeatures?.length ? { addedFeatures } : {}),
    ...(removedFeatures?.length ? { removedFeatures } : {}),
    ...(confirmedTopics.length ? { confirmedTopics } : {}),
    ...(pendingTopic ? { pendingTopic } : {}),
    ...(lastUserIntent ? { lastUserIntent } : {}),
    ...(notes?.length ? { notes } : {}),
    ...(plannerQueueStepKey ? { plannerQueueStepKey } : {}),
    ...(answeredPlannerFieldIds?.length ? { answeredPlannerFieldIds } : {}),
  };
}

export function mergeFeaturePlanningMemory(
  previous: FeaturePlanningMemoryV1 | undefined,
  patch: Partial<FeaturePlanningMemoryV1> | undefined
): FeaturePlanningMemoryV1 {
  const base = previous ?? defaultFeaturePlanningMemory();
  if (!patch) return base;
  return {
    priorityFeature: patch.priorityFeature?.trim() || base.priorityFeature,
    addedFeatures: dedupeStrings([...base.addedFeatures, ...(patch.addedFeatures ?? [])], 32),
    removedFeatures: dedupeStrings([...base.removedFeatures, ...(patch.removedFeatures ?? [])], 32),
    confirmedTopics: dedupeTopics([...base.confirmedTopics, ...(patch.confirmedTopics ?? [])], 12),
    pendingTopic: patch.pendingTopic ?? base.pendingTopic,
    lastUserIntent: patch.lastUserIntent?.trim() || base.lastUserIntent,
    notes: dedupeStrings([...(base.notes ?? []), ...(patch.notes ?? [])], 16),
    plannerQueueStepKey: patch.plannerQueueStepKey?.trim() || base.plannerQueueStepKey,
    answeredPlannerFieldIds: dedupeStrings(
      [...(base.answeredPlannerFieldIds ?? []), ...(patch.answeredPlannerFieldIds ?? [])],
      48
    ),
  };
}

/** 저장된 JSON·LLM 패치에서 전체 메모리 복원 */
export function parseStoredPlanningMemoryV1(raw: unknown): FeaturePlanningMemoryV1 | undefined {
  const patch = parsePlanningMemoryPatch(raw);
  if (!patch) return undefined;
  return mergeFeaturePlanningMemory(defaultFeaturePlanningMemory(), patch);
}

/** 타임라인·로그용 짧은 한 줄 */
export function compactMemorySnapshot(mem: FeaturePlanningMemoryV1 | undefined, maxChars: number): string {
  if (!mem) return "";
  try {
    const o = {
      priorityFeature: mem.priorityFeature ?? null,
      added: mem.addedFeatures.slice(0, 6),
      removed: mem.removedFeatures.slice(0, 6),
      confirmed: mem.confirmedTopics.slice(0, 8),
      pending: mem.pendingTopic ?? null,
      intent: mem.lastUserIntent ?? null,
      pq: mem.plannerQueueStepKey ?? null,
      pqAns: (mem.answeredPlannerFieldIds ?? []).slice(0, 12),
    };
    const s = JSON.stringify(o);
    return s.length <= maxChars ? s : `${s.slice(0, Math.max(0, maxChars - 1))}…`;
  } catch {
    return "";
  }
}
