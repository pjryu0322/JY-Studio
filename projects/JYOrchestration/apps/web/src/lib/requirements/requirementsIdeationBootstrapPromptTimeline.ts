import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const IDEATION_BOOTSTRAP_PROMPT_TIMELINE_AI_MEMBER = "AI 기획자" as const;
export const IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION = "bootstrapInterview" as const;
export const IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE = "ideation" as const;

/** 서버 부트스트랩 실패 시 API·디버그 타임라인에서 공통으로 쓰는 첫 질문 fallback 문구 */
export const IDEATION_BOOTSTRAP_DEFAULT_FALLBACK_FIRST_QUESTION = "무엇을 만들고 싶은가?" as const;

const MAX_PROMPT_TIMELINE = 50;
const BOOTSTRAP_DRAWER_SLICE = 10;

/**
 * `promptTimeline` 행·API `data.promptTrace` 등을 `RequirementsPromptTimelineEntry`로 정규화한다.
 * 필수 필드가 없으면 null(호출부에서 warn 로그 권장).
 */
export function coerceRequirementsPromptTimelineEntry(raw: unknown): RequirementsPromptTimelineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : "";
  const action = typeof r.action === "string" ? r.action : "";
  const stage = typeof r.stage === "string" ? r.stage : "";
  const source = typeof r.source === "string" ? r.source : "";
  if (!createdAt || !action || !stage || !source) return null;
  return {
    stage,
    action,
    source,
    createdAt,
    ...(typeof r.aiMember === "string" ? { aiMember: r.aiMember } : {}),
    ...(typeof r.promptText === "string" ? { promptText: r.promptText } : {}),
    ...(typeof r.responseText === "string" ? { responseText: r.responseText } : {}),
    ...(typeof r.error === "string" ? { error: r.error } : {}),
    ...(typeof r.fallbackText === "string" ? { fallbackText: r.fallbackText } : {}),
    ...(typeof r.model === "string" || r.model === null ? { model: r.model as string | null } : {}),
    ...(typeof r.provider === "string" || r.provider === null ? { provider: r.provider as string | null } : {}),
  };
}

/** API 부트스트랩 `promptTrace`용 별칭(`coerceRequirementsPromptTimelineEntry`와 동일) */
export const coerceBootstrapPromptTrace = coerceRequirementsPromptTimelineEntry;

export function buildIdeationBootstrapFallbackPromptTrace(params: {
  readonly error: string;
  readonly fallbackText: string;
  readonly createdAtIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE,
    action: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION,
    aiMember: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_AI_MEMBER,
    source: "fallback",
    error: params.error,
    fallbackText: params.fallbackText,
    createdAt: params.createdAtIso ?? new Date().toISOString(),
  };
}

export function buildIdeationBootstrapLlmPromptTrace(params: {
  readonly responseText: string;
  readonly promptText?: string | null;
  readonly model?: string | null;
  readonly provider?: string | null;
  readonly createdAtIso?: string;
}): RequirementsPromptTimelineEntry {
  const pt = String(params.promptText ?? "").trim();
  return {
    stage: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE,
    action: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION,
    aiMember: IDEATION_BOOTSTRAP_PROMPT_TIMELINE_AI_MEMBER,
    source: "llm",
    ...(pt ? { promptText: pt } : {}),
    responseText: params.responseText,
    ...(params.model !== undefined ? { model: params.model } : {}),
    provider: params.provider ?? "openai",
    createdAt: params.createdAtIso ?? new Date().toISOString(),
  };
}

export function isIdeationBootstrapTimelineEntry(
  entry: { readonly stage?: string; readonly action?: string } | null | undefined
): boolean {
  return Boolean(
    entry &&
      entry.stage === IDEATION_BOOTSTRAP_PROMPT_TIMELINE_STAGE &&
      entry.action === IDEATION_BOOTSTRAP_PROMPT_TIMELINE_ACTION
  );
}

/** 프롬프트 서랍 등: ideation·bootstrapInterview 항목만 최근 N건(역순) */
export function pickIdeationBootstrapPromptTimelineEntries(
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  limit: number = BOOTSTRAP_DRAWER_SLICE
): RequirementsPromptTimelineEntry[] {
  const list = Array.isArray(promptTimeline) ? promptTimeline : [];
  return list.filter((x) => isIdeationBootstrapTimelineEntry(x)).slice(-limit).reverse();
}

export function appendIdeationBootstrapPromptTimeline(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entry: RequirementsPromptTimelineEntry | null | undefined
): RequirementsPromptTimelineEntry[] {
  if (!entry) return Array.isArray(existing) ? [...existing] : [];
  const base = Array.isArray(existing) ? [...existing] : [];
  return [...base, entry].slice(-MAX_PROMPT_TIMELINE);
}
