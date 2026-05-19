/**
 * SingleChat bootstrap — proposal-driven schema (proposalDraft primary, question secondary).
 */

import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";

export type BootstrapProposalDraftWire = Readonly<{
  summary: string;
  actors: readonly string[];
  workflow: readonly string[];
  stages: readonly string[];
  capabilities: readonly string[];
}>;

export type BootstrapProposalQualityIssueCode =
  | "missing_proposal_draft"
  | "empty_proposal_draft"
  | "insufficient_proposal_structure"
  | "question_first_without_proposal";

function normalizeStringList(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((s) => s.slice(0, maxLen))
    .slice(0, maxItems);
}

export function parseBootstrapProposalDraftFromJson(raw: unknown): BootstrapProposalDraftWire | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const summary = String(o.summary ?? "").trim().slice(0, 600);
  const actors = normalizeStringList(o.actors, 12, 80);
  const workflow = normalizeStringList(o.workflow, 12, 120);
  const stages = normalizeStringList(o.stages, 12, 120);
  const capabilities = normalizeStringList(o.capabilities, 12, 120);
  if (!summary && actors.length === 0 && workflow.length === 0 && stages.length === 0 && capabilities.length === 0) {
    return null;
  }
  return { summary, actors, workflow, stages, capabilities };
}

export function validateBootstrapProposalDraft(input: {
  readonly proposalDraft: BootstrapProposalDraftWire | null | undefined;
  readonly question: string;
}): { readonly ok: boolean; readonly issues: readonly BootstrapProposalQualityIssueCode[] } {
  const issues: BootstrapProposalQualityIssueCode[] = [];
  const draft = input.proposalDraft;
  const question = String(input.question ?? "").trim();

  if (!draft) {
    issues.push("missing_proposal_draft");
    if (question && detectQuestionFirstUx(question) && !hasProposalFirstStructure(question)) {
      issues.push("question_first_without_proposal");
    }
    return { ok: false, issues: [...new Set(issues)] };
  }

  const hasStructure =
    Boolean(draft.summary.trim()) ||
    draft.workflow.length >= 2 ||
    draft.stages.length >= 2 ||
    (draft.actors.length >= 2 && (draft.workflow.length >= 1 || draft.stages.length >= 1));

  if (!hasStructure) issues.push("insufficient_proposal_structure");
  if (
    !draft.summary.trim() &&
    draft.actors.length === 0 &&
    draft.workflow.length === 0 &&
    draft.stages.length === 0 &&
    draft.capabilities.length === 0
  ) {
    issues.push("empty_proposal_draft");
  }

  const synthesized = synthesizeBootstrapUserMessageFromProposalDraft(draft, question);
  if (detectQuestionFirstUx(synthesized) && !hasProposalFirstStructure(synthesized)) {
    issues.push("question_first_without_proposal");
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

/** proposalDraft → 사용자 대면 코디네이터 메시지(question secondary는 CTA 보강용만) */
export function synthesizeBootstrapUserMessageFromProposalDraft(
  draft: BootstrapProposalDraftWire,
  questionSecondary?: string | null
): string {
  const lines: string[] = [];
  const summary = draft.summary.trim();
  if (summary) lines.push(summary);

  const workflow = draft.workflow.length ? draft.workflow : draft.stages;
  if (workflow.length) {
    lines.push("", "예상 서비스 흐름:");
    workflow.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }

  if (draft.actors.length) {
    lines.push("", "예상 액터:");
    draft.actors.forEach((a) => lines.push(`- ${a}`));
  }

  if (draft.capabilities.length) {
    lines.push("", "예상 핵심 기능:");
    draft.capabilities.forEach((c) => lines.push(`- ${c}`));
  }

  const secondary = String(questionSecondary ?? "").trim();
  if (secondary && hasProposalFirstStructure(secondary) && !lines.some((l) => l.includes(secondary.slice(0, 24)))) {
    lines.push("", secondary);
  } else if (!/선택|수정|맞는지|확인해\s*주|다음:|추천안을\s*검토/.test(lines.join("\n"))) {
    lines.push("", "추천안을 검토해 주세요.");
  }

  return lines.join("\n").trim();
}

export function buildBootstrapProposalRegenerationUserPayload(input: {
  readonly issues: readonly BootstrapProposalQualityIssueCode[];
  readonly rejectedQuestion: string;
  readonly rejectedProposalPreview: string;
}): string {
  return [
    "[PROPOSAL_REGENERATION]",
    "이전 JSON이 proposal-first 규칙을 만족하지 않습니다. 동일 스키마로 JSON 전체를 다시 출력하세요.",
    `위반 이슈: ${input.issues.join(", ")}`,
    `거절된 question(참고): ${input.rejectedQuestion.slice(0, 300)}`,
    `거절된 proposalDraft(참고): ${input.rejectedProposalPreview.slice(0, 500)}`,
    "",
    "필수:",
    "- proposalDraft가 primary — summary + workflow(또는 stages) + actors를 프로젝트 설명에서 추론해 채울 것",
    "- question-first 금지(빈 설계 질문만 던지지 말 것)",
    "- question은 secondary: proposalDraft를 요약·검토 요청하는 짧은 CTA(선택·수정)",
    "- orchestrationBootstrap·suggestedSlots 규칙은 기존과 동일",
  ].join("\n");
}

export function proposalDraftPreviewForDiagnostics(draft: BootstrapProposalDraftWire | null | undefined): string {
  if (!draft) return "(없음)";
  return JSON.stringify({
    summary: draft.summary.slice(0, 120),
    actors: draft.actors.slice(0, 4),
    workflow: draft.workflow.slice(0, 6),
    stages: draft.stages.slice(0, 4),
    capabilities: draft.capabilities.slice(0, 4),
  });
}
