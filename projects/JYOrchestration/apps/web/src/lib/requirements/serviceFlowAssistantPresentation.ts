/**
 * QuickReply-aware assistant message presentation (CTA deduplication).
 */

import type { ProposalVariantMode } from "@/lib/requirements/serviceFlowProposalVariant";
import {
  quickReplyWiresToDisplayLabels,
  type QuickReplyWire,
} from "@/lib/requirements/requirementsQuickActionRegistry";

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function dedupeDuplicateCtaLines(text: string): string {
  const lines = String(text ?? "").split("\n");
  const seenCta = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (/^다음\s*[:：]/i.test(trimmed)) {
      const key = norm(trimmed.replace(/^다음\s*[:：]\s*/i, ""));
      if (!key || seenCta.has(key)) continue;
      seenCta.add(key);
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

function stripEnumeratedChipCtaLines(text: string, chips: readonly string[]): string {
  const chipNorms = chips.map((c) => norm(c)).filter((c) => c.length >= 2);
  const lines = String(text ?? "").split("\n");
  const out: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      out.push(raw);
      continue;
    }

    const isNextCta = /^다음\s*[:：]/i.test(trimmed);
    const isRecommendLine = /^추천\s*[:：]/i.test(trimmed);
    const slashCount = (trimmed.match(/\//g) ?? []).length;
    const commaCount = (trimmed.match(/,/g) ?? []).length;
    const enumeratesChips =
      slashCount >= 2 ||
      commaCount >= 2 ||
      /중\s*(하나|1개)|골라\s*주|선택·수정|적용\s*\/\s*|선택해\s*주/.test(trimmed);

    let chipHits = 0;
    for (const c of chipNorms) {
      if (norm(trimmed).includes(c)) chipHits += 1;
    }

    const enumeratesQuickReplies = enumeratesChips || chipHits >= 2;
    const isRecommendCtaHint =
      isRecommendLine &&
      (chipHits >= 1 ||
        /맞춰|기준으로|골라|선택|적용|수정|대안|검토해\s*주/.test(trimmed));

    if ((isNextCta && enumeratesQuickReplies) || isRecommendCtaHint) {
      continue;
    }

    if (!isNextCta && !isRecommendLine && chipHits >= 3 && /추천안|일부\s*수정|다른\s*대안|직접\s*입력|보류/.test(trimmed)) {
      continue;
    }

    if (!isNextCta && chipHits >= 2 && /추천안\s*적용|일부\s*수정|다른\s*대안/.test(trimmed) && /중\s*(하나|선택)|골라/.test(trimmed)) {
      continue;
    }

    out.push(raw);
  }

  return out.join("\n").trim();
}

export function ensureAlternativeProposalIntro(assistantMessage: string): string {
  const body = String(assistantMessage ?? "").trim();
  if (!body) return body;
  if (/다른\s*방향|대안을\s*제시|기존\s*초안과\s*다른/.test(body.slice(0, 280))) {
    return body;
  }
  return `기존 초안과 다른 방향의 대안을 제시합니다.\n\n${body}`;
}

/** quickReplies가 있으면 버튼과 중복되는 enumerated CTA 문장 제거 */
export function applyQuickReplyAwareAssistantPresentation(
  assistantMessage: string,
  quickReplies: readonly QuickReplyWire[] | readonly string[] | null | undefined,
): string {
  let text = dedupeDuplicateCtaLines(String(assistantMessage ?? "").trim());
  const chips = quickReplyWiresToDisplayLabels(quickReplies ?? []);
  if (!chips.length) return text;

  text = stripEnumeratedChipCtaLines(text, chips);
  return text.trim();
}

/** 채팅 표시용 variant — APPLY 등 상태 전환 시 flow의 ALTERNATIVE 플래그로 intro가 붙지 않게 한다 */
export function resolveProposalPresentationVariantMode(input: {
  readonly proposalDecision?: string | null;
  readonly flowVariantMode?: ProposalVariantMode | null;
}): ProposalVariantMode {
  const decision = String(input.proposalDecision ?? "")
    .trim()
    .toUpperCase();
  if (decision === "ALTERNATIVE") return "ALTERNATIVE";
  if (
    decision === "APPLY" ||
    decision === "FLOW_APPROVE" ||
    decision === "REVIEW_FLOW" ||
    decision === "FEATURE_DETAIL"
  ) {
    return "PRIMARY";
  }
  return input.flowVariantMode === "ALTERNATIVE" ? "ALTERNATIVE" : "PRIMARY";
}

export function finalizeServiceFlowAssistantForResponse(input: {
  readonly assistantMessage: string;
  readonly nextQuestion: string | null | undefined;
  readonly quickReplies: readonly QuickReplyWire[] | readonly string[] | null | undefined;
  readonly proposalVariantMode?: ProposalVariantMode | null;
}): string {
  const chips = quickReplyWiresToDisplayLabels(input.quickReplies ?? []);
  let body = applyQuickReplyAwareAssistantPresentation(input.assistantMessage, chips);

  if (input.proposalVariantMode === "ALTERNATIVE") {
    body = ensureAlternativeProposalIntro(body);
  }

  const nextQ = String(input.nextQuestion ?? "").trim();
  if (!nextQ || chips.length) return body;

  const nextLine = /^다음\s*[:：]/i.test(nextQ) ? nextQ : `다음: ${nextQ}`;
  return dedupeDuplicateCtaLines(`${body}\n\n${nextLine}`);
}
