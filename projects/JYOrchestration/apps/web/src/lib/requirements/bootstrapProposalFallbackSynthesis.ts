/**
 * Ideation bootstrap — proposal validation 실패 후 lightweight LLM proposal-first fallback.
 */

import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import {
  hasProposalFirstStructure,
  detectQuestionFirstUx,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import {
  parseBootstrapProposalDraftFromJson,
  synthesizeBootstrapUserMessageFromProposalDraft,
  validateBootstrapProposalDraft,
  type BootstrapProposalDraftWire,
} from "@/lib/requirements/requirementsBootstrapProposalDraft";
import { normalizeLlmInterviewSuggestions } from "@/lib/requirements/interviewSuggestionChips";

export type BootstrapProposalFallbackSynthesisResult =
  | {
      ok: true;
      proposalDraft: BootstrapProposalDraftWire;
      question: string;
      suggestions: string[];
      allowCustomInput: boolean;
      model: string;
      promptText: string;
    }
  | { ok: false; code: string; message: string; promptText?: string };

function parseFallbackJson(parsed: unknown): {
  proposalDraft: BootstrapProposalDraftWire | null;
  suggestions: string[];
  allowCustomInput: boolean;
} {
  if (!parsed || typeof parsed !== "object") {
    return { proposalDraft: null, suggestions: [], allowCustomInput: true };
  }
  const o = parsed as Record<string, unknown>;
  const proposalDraft = parseBootstrapProposalDraftFromJson(o.proposalDraft ?? o);
  const suggestions = normalizeLlmInterviewSuggestions(
    Array.isArray(o.suggestions) ? o.suggestions.map((x) => String(x ?? "")) : [],
  ).slice(0, 3);
  const allowCustomInput = o.allowCustomInput !== false;
  return { proposalDraft, suggestions, allowCustomInput };
}

export function buildBootstrapProposalFallbackSynthesisUserPrompt(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
  readonly failureIssues: readonly string[];
  readonly rejectedProposalPreview?: string;
  readonly rejectedQuestion?: string;
}): string {
  return [
    "[bootstrap proposal fallback synthesis]",
    "직전 strict bootstrap 응답이 proposal-first 검증에 실패했습니다.",
    `실패 이슈: ${input.failureIssues.join(", ") || "(미상)"}`,
    input.rejectedProposalPreview
      ? `거절된 proposalDraft 미리보기: ${input.rejectedProposalPreview.slice(0, 500)}`
      : "",
    input.rejectedQuestion ? `거절된 question 미리보기: ${input.rejectedQuestion.slice(0, 300)}` : "",
    "",
    `[project]
name: ${input.projectName.trim() || "(이름 없음)"}
type: ${String(input.projectType ?? "").trim() || "(유형 미지정)"}
description: ${input.projectDescription.trim().slice(0, 1400) || "(설명 없음)"}`,
    "",
    "JSON만 출력:",
    `{
  "proposalDraft": {
    "summary": "프로젝트 맥락 한 줄",
    "actors": ["역할1", "역할2"],
    "workflow": ["단계1", "단계2", "단계3"],
    "stages": [],
    "capabilities": []
  },
  "suggestions": ["추천안 적용", "일부 수정", "다른 대안 보기"],
  "allowCustomInput": true
}`,
    "",
    "규칙:",
    "- question-first 금지(첫 단계는 무엇/어떤 순서 질문 금지)",
    "- workflow 최소 3단계, actors 최소 2 — 프로젝트 설명에서 추론",
    "- 서비스명·도메인 하드코딩 if/else 금지",
    "- proposalDraft만 생성(question 필드는 출력하지 말 것)",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runBootstrapProposalFallbackSynthesisOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly projectType?: string | null;
  readonly failureIssues: readonly string[];
  readonly rejectedProposalPreview?: string;
  readonly rejectedQuestion?: string;
}): Promise<BootstrapProposalFallbackSynthesisResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, code: "NO_KEY", message: "OPENAI_API_KEY 없음" };
  }
  const model = resolveOpenAiModelFromEnv();
  const system = `${workspaceAiMemberSystemPrefix("ideation")}당신은 bootstrap 실패 복구용 **proposal-first 초안 합성기**입니다.
사용자에게 직접 질문하지 않습니다. JSON 1개만 출력합니다.
proposalDraft(summary, actors, workflow)를 프로젝트 설명에서 추론해 채우세요.`;

  const user = buildBootstrapProposalFallbackSynthesisUserPrompt(input);
  const promptText = `[bootstrap-proposal-fallback-synthesis]\n[system]\n${system}\n\n[user]\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.22,
    maxTokens: 520,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message.slice(0, 400), promptText };
  }
  const text = res.text;
  if (!text) {
    return { ok: false, code: "EMPTY", message: "fallback synthesis 응답 비어 있음", promptText };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, code: "PARSE", message: "fallback synthesis JSON 파싱 실패", promptText };
  }

  const pack = parseFallbackJson(parsed);
  if (!pack.proposalDraft) {
    return { ok: false, code: "SCHEMA", message: "proposalDraft 없음", promptText };
  }

  const validation = validateBootstrapProposalDraft({
    proposalDraft: pack.proposalDraft,
    question: "",
  });
  if (!validation.ok) {
    return {
      ok: false,
      code: "QUALITY",
      message: `fallback proposalDraft 검증 실패: ${validation.issues.join(", ")}`,
      promptText,
    };
  }

  const question = synthesizeBootstrapUserMessageFromProposalDraft(pack.proposalDraft, null);
  if (!question.trim() || (detectQuestionFirstUx(question) && !hasProposalFirstStructure(question))) {
    return { ok: false, code: "QUALITY", message: "fallback 합성 메시지가 proposal-first가 아님", promptText };
  }

  return {
    ok: true,
    proposalDraft: pack.proposalDraft,
    question,
    suggestions: pack.suggestions,
    allowCustomInput: pack.allowCustomInput,
    model,
    promptText,
  };
}
