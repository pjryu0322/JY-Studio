import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { getMessageTargets } from "@/lib/requirements/requirementsTargets";
import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";

/** 정리·산출물용 memory_facts 정식 키(저장·API) */
export const ORGANIZE_MEMORY_FACT_CANONICAL_KEYS = [
  "coreUser",
  "currentProblems",
  "existingSolutions",
  "improvementNeed",
  "coreFeatureRequirements",
  "decisions",
  "openItems",
  "mandatoryRequirements",
  "constraints",
] as const;

export type OrganizeMemoryFactKey = (typeof ORGANIZE_MEMORY_FACT_CANONICAL_KEYS)[number];

const LEGACY_KEY_MAP: Record<string, OrganizeMemoryFactKey> = {
  user: "coreUser",
  problemPoints: "currentProblems",
  featureRequirements: "coreFeatureRequirements",
};

export type OrganizeMemoryFactValue = {
  text: string;
  /** true면 이후 정리에서도 모델이 반드시 존중(삭제·반박 금지) */
  mandatory?: boolean;
};

export type OrganizeMemoryFacts = Partial<Record<OrganizeMemoryFactKey, OrganizeMemoryFactValue>>;

/**
 * 정리 요청용 저장 맥락 (원문 대화 본문은 DB의 requirementsConversationJson이 단일 소스).
 * rawMessagesMeta만으로 원문과의 대응을 추적한다.
 */
export type RequirementsOrganizeContextV1 = {
  v?: 1;
  rawMessagesMeta?: {
    messageCount: number;
    lastMessageAt?: string;
    lastMessageId?: string;
  } | null;
  memoryFacts?: OrganizeMemoryFacts | null;
  rollingSummary?: string | null;
  /** 마지막 정리 요청에 실어 보낸 recent 블록(감사·재현용, 선택) */
  recentMessagesSnapshot?: string | null;
  /** recent_messages 계산 시 사용할 N (기본 24) */
  recentMessageCount?: number;
  updatedAt?: string;
};

export const DEFAULT_ORGANIZE_RECENT_MESSAGE_COUNT = 24;

const FACT_LABELS_KR: Record<OrganizeMemoryFactKey, string> = {
  coreUser: "핵심 사용자",
  currentProblems: "현재 문제점",
  existingSolutions: "기존 해결 방식",
  improvementNeed: "개선 필요성",
  coreFeatureRequirements: "핵심 기능 요구",
  decisions: "결정 사항",
  openItems: "미결정 사항",
  mandatoryRequirements: "필수 요구사항(MANDATORY)",
  constraints: "강제조건",
};

function trimText(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function readFactBlock(raw: unknown): OrganizeMemoryFactValue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = trimText(r.text);
  if (!text) return null;
  const mandatory = r.mandatory === true;
  return { text, ...(mandatory ? { mandatory: true } : {}) };
}

function normalizeIncomingKey(k: string): OrganizeMemoryFactKey | null {
  if ((ORGANIZE_MEMORY_FACT_CANONICAL_KEYS as readonly string[]).includes(k)) return k as OrganizeMemoryFactKey;
  return LEGACY_KEY_MAP[k] ?? null;
}

/** JSON(구·신 키 혼용) → 정식 키만 갖는 memory_facts */
export function parseOrganizeMemoryFacts(raw: unknown): OrganizeMemoryFacts | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: OrganizeMemoryFacts = {};
  for (const [rawKey, val] of Object.entries(o)) {
    const canon = normalizeIncomingKey(rawKey);
    if (!canon) continue;
    const block = readFactBlock(val);
    if (!block) continue;
    const existing = out[canon];
    if (!existing?.text) {
      out[canon] = block;
    } else if (!existing.text.includes(block.text.slice(0, 40))) {
      out[canon] = { text: `${existing.text}\n\n${block.text}`, mandatory: Boolean(existing.mandatory || block.mandatory) };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseRequirementsOrganizeContextV1(raw: unknown): RequirementsOrganizeContextV1 | undefined {
  if (raw === null) return undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const rawMeta = o.rawMessagesMeta;
  let rawMessagesMeta: RequirementsOrganizeContextV1["rawMessagesMeta"];
  if (rawMeta === null) rawMessagesMeta = null;
  else if (rawMeta && typeof rawMeta === "object") {
    const m = rawMeta as Record<string, unknown>;
    const messageCount = typeof m.messageCount === "number" && Number.isFinite(m.messageCount) ? Math.floor(m.messageCount) : 0;
    rawMessagesMeta =
      messageCount > 0
        ? {
            messageCount,
            lastMessageAt: typeof m.lastMessageAt === "string" ? m.lastMessageAt : undefined,
            lastMessageId: typeof m.lastMessageId === "string" ? m.lastMessageId : undefined,
          }
        : undefined;
  } else rawMessagesMeta = undefined;

  const memoryFacts = parseOrganizeMemoryFacts(o.memoryFacts);
  const rollingSummary = o.rollingSummary === null ? null : trimText(o.rollingSummary) || undefined;
  const recentMessagesSnapshot =
    o.recentMessagesSnapshot === null ? null : trimText(o.recentMessagesSnapshot) || undefined;
  const recentMessageCount =
    typeof o.recentMessageCount === "number" && Number.isFinite(o.recentMessageCount)
      ? Math.max(1, Math.floor(o.recentMessageCount))
      : undefined;
  const updatedAt = trimText(o.updatedAt) || undefined;

  const has =
    rawMessagesMeta ||
    memoryFacts ||
    rollingSummary !== undefined ||
    recentMessagesSnapshot !== undefined ||
    recentMessageCount !== undefined ||
    updatedAt;
  if (!has) return undefined;

  return {
    v: 1,
    ...(rawMessagesMeta !== undefined ? { rawMessagesMeta } : {}),
    ...(memoryFacts !== undefined ? { memoryFacts } : {}),
    ...(rollingSummary !== undefined ? { rollingSummary: rollingSummary ?? null } : {}),
    ...(recentMessagesSnapshot !== undefined ? { recentMessagesSnapshot: recentMessagesSnapshot ?? null } : {}),
    ...(recentMessageCount !== undefined ? { recentMessageCount } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/** 요약 패널 값으로 memory_facts 초기 시드(대화 압축 전) */
export function bootstrapOrganizeMemoryFacts(input: {
  goals: string;
  targetUsers: string;
  scopeIn: string;
  scopeOut: string;
  success: string;
  nfr: string;
  openIssues: string;
  priorityFeatures: string;
}): OrganizeMemoryFacts {
  const out: OrganizeMemoryFacts = {};
  const u = input.targetUsers.trim();
  if (u) out.coreUser = { text: u };
  const goals = input.goals.trim();
  const open = input.openIssues.trim();
  const prob = [goals && `목표·맥락: ${goals}`, open && `열린 이슈: ${open}`].filter(Boolean).join("\n");
  if (prob) out.currentProblems = { text: prob };
  const pf = input.priorityFeatures.trim();
  const si = input.scopeIn.trim();
  const feats = [pf && `우선 기능: ${pf}`, si && `범위(포함): ${si}`].filter(Boolean).join("\n");
  if (feats) out.coreFeatureRequirements = { text: feats };
  const sc = input.success.trim();
  if (sc) {
    out.decisions = { text: `합의·성공 기준(초안): ${sc}` };
    out.mandatoryRequirements = { text: `필수 반영: ${sc}`, mandatory: true };
  }
  if (open) out.openItems = { text: open };
  const so = input.scopeOut.trim();
  const nfr = input.nfr.trim();
  const cons = [so && `제외 범위: ${so}`, nfr && `NFR/제약: ${nfr}`].filter(Boolean).join("\n");
  if (cons) out.constraints = { text: cons };
  return out;
}

export function mergeOrganizeMemoryFactsPreserveMandatory(
  previous: OrganizeMemoryFacts | null | undefined,
  incoming: OrganizeMemoryFacts | null | undefined
): OrganizeMemoryFacts {
  const out: OrganizeMemoryFacts = { ...(incoming ?? {}) };
  const prev = previous ?? {};
  for (const k of ORGANIZE_MEMORY_FACT_CANONICAL_KEYS) {
    const p = prev[k];
    if (!p?.mandatory) continue;
    const n = out[k];
    const nextText = n?.text?.trim() ?? "";
    if (!nextText) {
      out[k] = { text: p.text, mandatory: true };
    } else if (!n?.mandatory && p.mandatory) {
      out[k] = { text: `${p.text}\n\n[정리본 반영]\n${nextText}`, mandatory: true };
    }
  }
  return out;
}

export function buildOrganizeMemoryFactsFromDraft(
  draft: Pick<
    RequirementsDraftDoc,
    "overview" | "goals" | "users" | "features" | "excluded" | "nonFunctional" | "successCriteria" | "openIssues"
  >
): OrganizeMemoryFacts {
  const users = draft.users.map((s) => s.trim()).filter(Boolean).join("\n");
  const goals = draft.goals.map((s) => s.trim()).filter(Boolean).join("\n");
  const features = draft.features.map((s) => s.trim()).filter(Boolean).join("\n");
  const open = draft.openIssues.map((s) => s.trim()).filter(Boolean).join("\n");
  const success = draft.successCriteria.map((s) => s.trim()).filter(Boolean).join("\n");
  const ex = draft.excluded.map((s) => s.trim()).filter(Boolean).join("\n");
  const nfr = draft.nonFunctional.map((s) => s.trim()).filter(Boolean).join("\n");
  const out: OrganizeMemoryFacts = {};
  if (users) out.coreUser = { text: users };
  const prob = [draft.overview.trim() && `개요: ${draft.overview.trim()}`, goals && `목표: ${goals}`, open && `이슈: ${open}`]
    .filter(Boolean)
    .join("\n");
  if (prob) out.currentProblems = { text: prob };
  if (features) out.coreFeatureRequirements = { text: features };
  if (success) {
    out.decisions = { text: success };
    out.mandatoryRequirements = { text: `정리본 기준 필수: ${success.slice(0, 2000)}`, mandatory: true };
  }
  if (open) out.openItems = { text: open };
  const cons = [ex && `제외: ${ex}`, nfr && `비기능/제약: ${nfr}`].filter(Boolean).join("\n");
  if (cons) out.constraints = { text: cons };
  return out;
}

export function buildRollingSummaryFromIdeationFields(input: {
  goals: string;
  openIssues: string;
  priorityFeatures: string;
}): string {
  const parts = [input.goals.trim(), input.priorityFeatures.trim(), input.openIssues.trim()].filter(Boolean);
  return parts.join("\n\n").slice(0, 6000);
}

export function buildRollingSummaryFromDraft(draft: Pick<RequirementsDraftDoc, "overview" | "goals" | "openIssues">): string {
  const g = draft.goals.slice(0, 6).filter(Boolean).join(" · ");
  const oi = draft.openIssues.slice(0, 4).filter(Boolean).join(" · ");
  return [draft.overview.trim(), g && `핵심 목표: ${g}`, oi && `미결정: ${oi}`].filter(Boolean).join("\n\n");
}

export function formatMemoryFactsForModel(facts: OrganizeMemoryFacts | null | undefined): string {
  if (!facts) return "";
  const lines: string[] = [];
  for (const k of ORGANIZE_MEMORY_FACT_CANONICAL_KEYS) {
    const row = facts[k];
    if (!row?.text?.trim()) continue;
    const m = row.mandatory ? " [mandatory: 반드시 존중]" : "";
    lines.push(`- ${FACT_LABELS_KR[k]}${m}:\n${row.text.trim()}`);
  }
  return lines.join("\n\n");
}

export function formatMandatoryReminderForModel(facts: OrganizeMemoryFacts | null | undefined): string {
  const keys = ORGANIZE_MEMORY_FACT_CANONICAL_KEYS.filter((k) => facts?.[k]?.mandatory && facts[k]?.text?.trim());
  if (!keys.length) return "";
  return `[필수 유지 항목]\n다음 memory_facts 섹션은 mandatory입니다. 최종 JSON에서 이 내용과 모순되게 바꾸거나 삭제하지 마세요.\n${keys.map((k) => `- ${FACT_LABELS_KR[k]}`).join("\n")}`;
}

export function formatOrganizeRecentMessages(
  messages: readonly RequirementsMessage[],
  count: number,
  maxChars: number
): string {
  const n = Math.max(1, Math.floor(count));
  const slice = messages.slice(-n);
  const lines = slice.map((m) => {
    const who =
      m.role === "user"
        ? "사용자"
        : m.role === "ai"
          ? `AI${m.speakerName ? `(${m.speakerName})` : ""}`
          : m.role === "human"
            ? `멤버${m.speakerName ? `(${m.speakerName})` : ""}`
            : "시스템";
    const tg = getMessageTargets(m);
    const arrow = tg.length ? ` → ${tg.map((t) => t.name).join(", ")}` : "";
    return `${who}${arrow}: ${m.content}`;
  });
  return lines.join("\n").slice(-maxChars);
}

export function mergeOrganizeContextAfterDraft(input: {
  previous: RequirementsOrganizeContextV1 | undefined;
  draft: Pick<
    RequirementsDraftDoc,
    "overview" | "goals" | "users" | "features" | "excluded" | "nonFunctional" | "successCriteria" | "openIssues"
  >;
  messages: readonly RequirementsMessage[];
  recentSnapshot: string;
  recentCount: number;
}): RequirementsOrganizeContextV1 {
  const last = input.messages[input.messages.length - 1];
  const fromDraft = buildOrganizeMemoryFactsFromDraft(input.draft);
  const mergedFacts = mergeOrganizeMemoryFactsPreserveMandatory(input.previous?.memoryFacts ?? undefined, fromDraft);
  const rolling = buildRollingSummaryFromDraft(input.draft);
  const now = new Date().toISOString();
  return {
    v: 1,
    rawMessagesMeta: {
      messageCount: input.messages.length,
      lastMessageAt: last?.createdAt,
      lastMessageId: last?.id,
    },
    memoryFacts: mergedFacts,
    rollingSummary: rolling,
    recentMessagesSnapshot: input.recentSnapshot.trim() || null,
    recentMessageCount:
      typeof input.previous?.recentMessageCount === "number" && input.previous.recentMessageCount > 0
        ? input.previous.recentMessageCount
        : input.recentCount > 0
          ? input.recentCount
          : DEFAULT_ORGANIZE_RECENT_MESSAGE_COUNT,
    updatedAt: now,
  };
}
