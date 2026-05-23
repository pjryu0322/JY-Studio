/**
 * service-flow analyze — proposal-first UX validation (LLM JSON only, no hardcoded flows).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import {
  isServiceFlowAdviceMode,
  isWeakAdviceAssistantMessage,
} from "@/lib/requirements/serviceFlowAdviceMode";

export type ServiceFlowAnalyzeQualityIssueCode =
  | "missing_assistant_message"
  | "advice_message_too_short"
  | "question_first_without_proposal"
  | "insufficient_flow_actors"
  | "insufficient_flow_steps"
  | "flow_actor_names_not_in_message"
  | "flow_step_titles_not_in_message"
  | "duplicate_assistant_and_next_question"
  | "multi_question_cta"
  | "readiness_score_zero_on_proposal"
  | "missing_quick_replies_on_proposal";

export type ServiceFlowAnalyzeParsed = Readonly<{
  assistantMessage: string;
  updatedFlow: RequirementsServiceFlowV1;
  intent: string;
  nextQuestion: string | null;
  quickReplies: string[] | null;
  readiness: {
    score: number;
    actorsReady: boolean;
    stepsReady: boolean;
    mappingReady: boolean;
    readyForNext: boolean;
  };
}>;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function countLikelyQuestionSentences(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  const parts = t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length >= 6);
  let n = 0;
  for (const p of parts) {
    if (/\?/.test(p)) n += 1;
    else if (/(있습니까|일까요|하시겠|주실래|주시겠|될까|인가요|무엇입니까|어떤\s*단계)/.test(p)) n += 1;
  }
  return n;
}

function messagesOverlap(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const stripCtaPrefix = (x: string) => x.replace(/^다음\s*[:：]\s*/i, "");
  const ca = stripCtaPrefix(na);
  const cb = stripCtaPrefix(nb);
  if (ca && cb && (ca === cb || ca.includes(cb) || cb.includes(ca)) && Math.min(ca.length, cb.length) >= 10) {
    return true;
  }

  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;
  return long.includes(short) && short.length >= 12;
}

import { dedupeSentences, normalizeQuestionSentence, sentencesOverlap } from "@/lib/requirements/serviceFlowMessageDedupe";

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

function flowNamesReflectedInMessage(
  names: readonly string[],
  message: string,
  minHits: number,
): boolean {
  const msg = norm(message);
  if (!msg || names.length === 0) return false;
  let hits = 0;
  for (const name of names) {
    const n = norm(name);
    if (n.length >= 2 && msg.includes(n)) hits += 1;
  }
  return hits >= minHits;
}

/** 최초 proposal·인터뷰 시작 턴 — 강한 proposal-first 검증 적용 */
export function isServiceFlowProposalBootstrapTurn(input: {
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
}): boolean {
  const um = String(input.userMessage ?? "").trim();
  if (/인터뷰\s*시작/.test(um)) return true;
  const flow = input.currentFlow;
  const actors = flow?.actors?.length ?? 0;
  const steps = flow?.steps?.length ?? 0;
  return actors < 2 && steps < 3;
}

export function mergeServiceFlowUserFacingMessage(
  assistantMessage: string,
  nextQuestion: string | null | undefined,
): string {
  let assistant = dedupeDuplicateCtaLines(String(assistantMessage ?? "").trim());
  const nextQ = normalizeQuestionSentence(String(nextQuestion ?? "").trim());
  if (!assistant) return nextQ;
  if (!nextQ) return assistant;

  if (messagesOverlap(assistant, nextQ) || sentencesOverlap(assistant, nextQ)) return assistant;

  const assistantHasCta = /(다음\s*[:：]|선택|수정|맞는지|확인해\s*주|이대로|그대로\s*진행)/.test(assistant);
  const nextIsQuestion = /\?/.test(nextQ) || countLikelyQuestionSentences(nextQ) > 0;
  if (assistantHasCta && nextIsQuestion) return assistant;

  const nextNorm = norm(nextQ.replace(/^다음\s*[:：]\s*/i, ""));
  if (nextNorm && norm(assistant).includes(nextNorm)) return assistant;
  if (assistant.includes(nextQ.slice(0, Math.min(24, nextQ.length)))) return assistant;

  const nextLine = /^다음\s*[:：]/i.test(nextQ) ? nextQ : `다음: ${nextQ}`;
  const merged = `${assistant}\n\n${nextLine}`;
  return dedupeDuplicateCtaLines(merged);
}

function validateServiceFlowAdviceAnalyzeResponse(input: {
  readonly parsed: ServiceFlowAnalyzeParsed;
}): { readonly ok: boolean; readonly issues: readonly ServiceFlowAnalyzeQualityIssueCode[] } {
  const issues: ServiceFlowAnalyzeQualityIssueCode[] = [];
  const assistant = String(input.parsed.assistantMessage ?? "").trim();
  if (!assistant) issues.push("missing_assistant_message");
  if (isWeakAdviceAssistantMessage(assistant)) issues.push("advice_message_too_short");
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function validateServiceFlowAnalyzeResponse(input: {
  readonly parsed: ServiceFlowAnalyzeParsed;
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly responsePolicy?: unknown;
}): { readonly ok: boolean; readonly issues: readonly ServiceFlowAnalyzeQualityIssueCode[] } {
  if (isServiceFlowAdviceMode(input.responsePolicy)) {
    return validateServiceFlowAdviceAnalyzeResponse({ parsed: input.parsed });
  }

  const issues: ServiceFlowAnalyzeQualityIssueCode[] = [];
  const { parsed, userMessage, currentFlow } = input;
  const assistant = String(parsed.assistantMessage ?? "").trim();
  const nextQ = String(parsed.nextQuestion ?? "").trim();
  const flow = parsed.updatedFlow;
  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  const proposalBootstrap = isServiceFlowProposalBootstrapTurn({ userMessage, currentFlow });

  if (!assistant) issues.push("missing_assistant_message");

  const combinedForUx = mergeServiceFlowUserFacingMessage(assistant, nextQ || null);
  if (detectQuestionFirstUx(combinedForUx) && !hasProposalFirstStructure(combinedForUx)) {
    issues.push("question_first_without_proposal");
  }

  if (nextQ && messagesOverlap(assistant, nextQ)) {
    issues.push("duplicate_assistant_and_next_question");
  }

  const questionCount =
    countLikelyQuestionSentences(assistant) + (nextQ && !messagesOverlap(assistant, nextQ) ? 1 : 0);
  if (questionCount > 1) issues.push("multi_question_cta");

  if (proposalBootstrap) {
    if (actors.length < 2) issues.push("insufficient_flow_actors");
    if (steps.length < 3) issues.push("insufficient_flow_steps");
    if (!hasProposalFirstStructure(assistant)) issues.push("question_first_without_proposal");
    if (!parsed.quickReplies?.length) issues.push("missing_quick_replies_on_proposal");
    if (parsed.readiness.score <= 0) issues.push("readiness_score_zero_on_proposal");

    const actorNames = actors.map((a) => a.name).filter(Boolean);
    const stepTitles = steps.map((s) => s.title).filter(Boolean);
    if (actorNames.length >= 2 && !flowNamesReflectedInMessage(actorNames, assistant, 2)) {
      issues.push("flow_actor_names_not_in_message");
    }
    if (stepTitles.length >= 3 && !flowNamesReflectedInMessage(stepTitles, assistant, 2)) {
      issues.push("flow_step_titles_not_in_message");
    }
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

export function buildServiceFlowProposalRegenerationUserPayload(input: {
  readonly issues: readonly ServiceFlowAnalyzeQualityIssueCode[];
  readonly rejectedAssistantPreview: string;
  readonly rejectedNextQuestion: string | null;
}): string {
  const issueLines = input.issues.map((c) => `- ${c}`).join("\n");
  return `[service-flow proposal-first 재생성 — 필수]
직전 JSON 응답이 proposal-first UX 규칙에 맞지 않아 거부되었습니다.

거부 사유:
${issueLines || "- (미상)"}

거부된 assistantMessage 미리보기:
${input.rejectedAssistantPreview.slice(0, 600) || "(없음)"}

거부된 nextQuestion:
${input.rejectedNextQuestion?.slice(0, 240) || "(없음)"}

다시 출력할 때 반드시 지킬 것:
- assistantMessage는 코디네이터(AI 기획자) 톤의 **구조화된 초안** (요약 + "예상 액터" 불릿 + "예상 흐름" 번호 목록 + 단일 CTA 1개)
- nextQuestion은 null이거나, assistantMessage에 없는 **단일 CTA 한 문장**만 (중복 질문 금지)
- quickReplies 2~3개 (LLM 생성, 서비스명 하드코딩 선택지 금지)
- updatedFlow.actors.length >= 2, updatedFlow.steps.length >= 3
- assistantMessage에 나온 액터·단계는 updatedFlow와 일치
- readiness.score는 1 이상 (초안 제시 턴)
- "첫 단계는 무엇입니까?" 같은 백지 question-first 금지
- JSON 스키마만 출력`;
}
