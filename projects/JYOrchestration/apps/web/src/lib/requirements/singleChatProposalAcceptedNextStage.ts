/**
 * Proposal 승인(APPLY) 후 — coordinator synthesis 없이 다음 단계 planner 메시지 생성.
 */

import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { safeJsonParse } from "@/lib/requirements/singleChatOrchestrationOpenAI.shared";

export type ProposalAcceptedNextStageResult =
  | { readonly ok: true; readonly assistantMessage: string; readonly suggestions: string[] | null; readonly promptText: string; readonly model: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

const NEXT_STAGE_RULES = `
당신은 SingleChat **다음 단계 planner**입니다.
사용자가 직전 proposal(초안)을 **승인(추천안 적용)** 했습니다.

[절대 금지]
- 직전과 동일한 "예상 흐름/예상 액터" proposal 전체를 다시 나열
- question-first 백지 질문 ("첫 단계는 무엇입니까?" 등)
- coordinator synthesis처럼 초안을 처음부터 다시 제시

[필수]
- 승인된 초안을 1~2문장으로 인정·요약
- **다음 단계 기획**으로 진행: 세부 요구사항, 기능 상세화, 액터 정의 확장, 데이터 흐름 설계 중 맥락에 맞는 1개 축
- 확인 질문은 **1개**만 (물음표 최대 1)
- suggestions 2~4개 (다음 작업 선택용, proposal 승인 칩 반복 금지)

출력 JSON:
{ "assistantMessage": "...", "suggestions": ["세부 요구사항 정리", "기능 상세화", "액터 정의 확장"] }
`.trim();

function shouldRejectNextStageMessage(msg: string): boolean {
  const t = String(msg ?? "").trim();
  if (!t) return true;
  if (detectQuestionFirstUx(t) && !hasProposalFirstStructure(t)) return true;
  const flowBlocks = (t.match(/예상\s*(서비스\s*)?흐름/g) ?? []).length;
  const actorBlocks = (t.match(/예상\s*액터/g) ?? []).length;
  if (flowBlocks >= 2 && actorBlocks >= 2) return true;
  return false;
}

export function buildProposalAcceptedNextStageFallback(input: {
  readonly projectName: string;
  readonly acceptedSnapshot: string;
}): string {
  const name = input.projectName.trim() || "프로젝트";
  const snap = String(input.acceptedSnapshot ?? "").trim();
  const snapLine = snap ? snap.split("\n").find((l) => l.trim().length >= 8)?.trim().slice(0, 120) : "";
  return [
    `${name} 초안을 기준으로 진행하겠습니다.`,
    snapLine ? `확정 방향: ${snapLine}` : "",
    "",
    "다음 단계로 세부 요구사항·기능 범위·액터 역할·데이터 흐름 중 어디부터 구체화할지 정하면 됩니다.",
    "",
    "다음: 우선 다룰 영역(예: 세부 요구사항 / 기능 상세 / 액터·권한 / 데이터 흐름)을 알려 주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runProposalAcceptedNextStageOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly acceptedProposalSnapshot: string;
  readonly dialogueExcerpt: string;
  readonly state: RequirementsSingleChatOrchestrationStateV1;
  readonly specialistDigest: string;
}): Promise<ProposalAcceptedNextStageResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: true,
      assistantMessage: buildProposalAcceptedNextStageFallback({
        projectName: input.projectName,
        acceptedSnapshot: input.acceptedProposalSnapshot,
      }),
      suggestions: ["세부 요구사항 정리", "기능 상세화", "액터 정의 확장", "데이터 흐름 설계"],
      promptText: "[proposal-accepted-next-stage] NO_KEY fallback",
      model: "fallback",
    };
  }

  const model = resolveOpenAiModelFromEnv();
  const slotsJson = JSON.stringify(input.state.slots, null, 0).slice(0, 12_000);
  const system = `${workspaceAiMemberSystemPrefix("ideation")}\n${NEXT_STAGE_RULES}`;
  const user = `[프로젝트] ${input.projectName.trim()}
[설명] ${input.projectDescription.trim().slice(0, 900)}

[승인된 proposal snapshot]
${input.acceptedProposalSnapshot.trim().slice(0, 5000)}

[대화 발췌]
${input.dialogueExcerpt.trim().slice(0, 5000)}

[내부 specialist 요약]
${input.specialistDigest.trim().slice(0, 3000) || "(없음)"}

[슬롯 스냅샷]
${slotsJson}`;

  const promptText = `[proposal-accepted-next-stage]\n[system]\n${system}\n\n[user]\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.28,
    maxTokens: 480,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message.slice(0, 400) };
  }

  const parsed = safeJsonParse(res.text ?? "") as Record<string, unknown> | null;
  const msg = String(parsed?.assistantMessage ?? "").trim();
  if (!msg || shouldRejectNextStageMessage(msg)) {
    return {
      ok: true,
      assistantMessage: buildProposalAcceptedNextStageFallback({
        projectName: input.projectName,
        acceptedSnapshot: input.acceptedProposalSnapshot,
      }),
      suggestions: ["세부 요구사항 정리", "기능 상세화", "액터 정의 확장"],
      promptText: `${promptText}\n\n--- rejected repeat-proposal → fallback ---`,
      model,
    };
  }

  const suggestions = Array.isArray(parsed?.suggestions)
    ? (parsed!.suggestions as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 5)
    : ["세부 요구사항 정리", "기능 상세화", "액터 정의 확장"];

  return { ok: true, assistantMessage: msg, suggestions: suggestions.length ? suggestions : null, promptText, model };
}
