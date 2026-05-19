/**
 * Service-flow analyze — proposal validation 실패 후 lightweight LLM proposal-first fallback.
 */

import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { parseServiceFlowAnalyzeWire } from "@/lib/requirements/serviceFlowAnalyzeParse";
import {
  mergeServiceFlowUserFacingMessage,
  validateServiceFlowAnalyzeResponse,
  type ServiceFlowAnalyzeParsed,
} from "@/lib/requirements/serviceFlowAnalyzeValidation";

export type ServiceFlowProposalFallbackSynthesisResult =
  | {
      ok: true;
      data: ServiceFlowAnalyzeParsed;
      model: string;
      promptText: string;
      usedSkeleton?: boolean;
    }
  | { ok: false; code: string; message: string; promptText?: string };

const DEFAULT_QUICK_REPLIES = ["추천안 적용", "일부 수정", "다른 대안 보기"];

export function buildServiceFlowProposalFallbackSynthesisUserPrompt(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly failureIssues: readonly string[];
  readonly rejectedAssistantPreview?: string;
  readonly rejectedNextQuestion?: string | null;
  readonly rejectedUpdatedFlowPreview?: string;
}): string {
  const assetsBlock = (input.ideationAssets ?? [])
    .map((a) => {
      const type = String(a?.type ?? "").trim();
      const title = String(a?.title ?? "").trim();
      const content = String(a?.content ?? "").trim();
      if (!content) return "";
      return `- ${type || "산출물"}${title ? `: ${title}` : ""}\n${content.slice(0, 1800)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    "[service-flow proposal fallback synthesis]",
    "직전 service-flow analyze 응답이 proposal-first 검증에 실패했습니다.",
    `실패 이슈: ${input.failureIssues.join(", ") || "(미상)"}`,
    input.rejectedAssistantPreview
      ? `거절된 assistantMessage 미리보기: ${input.rejectedAssistantPreview.slice(0, 700)}`
      : "",
    input.rejectedNextQuestion
      ? `거절된 nextQuestion: ${input.rejectedNextQuestion.slice(0, 300)}`
      : "",
    input.rejectedUpdatedFlowPreview
      ? `거절된 updatedFlow 미리보기: ${input.rejectedUpdatedFlowPreview.slice(0, 2000)}`
      : "",
    "",
    `[project]
name: ${input.projectName.trim() || "(이름 없음)"}
description: ${input.projectDescription.trim().slice(0, 1600) || "(설명 없음)"}`,
    "",
    `[recent conversation]
${String(input.recentMessages ?? "").trim().slice(0, 4000) || "(없음)"}`,
    "",
    `[current flow JSON]
${JSON.stringify(input.currentFlow ?? { actors: [], steps: [] }).slice(0, 6000)}`,
    "",
    `[user message]
${input.userMessage.trim().slice(0, 800)}`,
    "",
    assetsBlock ? `[ideation assets]\n${assetsBlock}` : "",
    "",
    "JSON만 출력 (service-flow analyze와 동일 스키마):",
    `{
  "assistantMessage": "요약 + 예상 액터 불릿 + 예상 흐름 번호 + 단일 CTA",
  "updatedFlow": { "createdAt": "...", "updatedAt": "...", "actors": [], "steps": [] },
  "intent": "unclear",
  "nextQuestion": null,
  "quickReplies": ["추천안 적용", "일부 수정", "다른 대안 보기"],
  "readiness": { "score": 20, "actorsReady": true, "stepsReady": true, "mappingReady": false, "readyForNext": false }
}`,
    "",
    "규칙:",
    "- question-first 금지(첫 단계/어떤 액터/어떤 순서 질문 금지)",
    "- updatedFlow.actors >= 2, steps >= 3 — 프로젝트·산출물에서 추론",
    "- assistantMessage의 액터·단계는 updatedFlow와 일치",
    "- 서비스명·도메인 if/else 하드코딩 금지",
  ]
    .filter(Boolean)
    .join("\n");
}

/** API 키 없음·합성 실패 시 — generic proposal skeleton(도메인 단계 하드코딩 없음). */
export function buildServiceFlowDescriptionProposalSkeletonPack(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly nowIso: string;
}): ServiceFlowAnalyzeParsed {
  const name = input.projectName.trim() || "프로젝트";
  const desc = input.projectDescription.trim().replace(/\s+/g, " ").slice(0, 280);
  const summary = desc
    ? `${name} 서비스 흐름 초안을 정리했습니다.\n\n${desc}`
    : `${name} 서비스 흐름 초안을 정리했습니다.`;

  const assistantMessage = [
    summary,
    "",
    "예상 액터",
    "- 사용자",
    "- 시스템",
    "",
    "예상 흐름",
    "1. 사용자가 목표·입력을 제공한다",
    "2. 시스템이 요청을 처리한다",
    "3. 결과를 확인·조정한다",
    "",
    "다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.",
  ].join("\n");

  const flow: RequirementsServiceFlowV1 = {
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    actors: [
      { id: "actor_user", name: "사용자", kind: "human", description: "" },
      { id: "actor_system", name: "시스템", kind: "system", description: "" },
    ],
    steps: [
      {
        id: "step_1",
        title: "사용자가 목표·입력을 제공한다",
        purpose: "",
        order: 1,
        primaryActorId: "actor_user",
        secondaryActorIds: [],
        approved: false,
        updatedAt: input.nowIso,
      },
      {
        id: "step_2",
        title: "시스템이 요청을 처리한다",
        purpose: "",
        order: 2,
        primaryActorId: "actor_system",
        secondaryActorIds: [],
        approved: false,
        updatedAt: input.nowIso,
      },
      {
        id: "step_3",
        title: "결과를 확인·조정한다",
        purpose: "",
        order: 3,
        primaryActorId: "actor_user",
        secondaryActorIds: [],
        approved: false,
        updatedAt: input.nowIso,
      },
    ],
  };

  return {
    assistantMessage,
    updatedFlow: flow,
    intent: "unclear",
    nextQuestion: null,
    quickReplies: [...DEFAULT_QUICK_REPLIES],
    readiness: {
      score: 25,
      actorsReady: true,
      stepsReady: true,
      mappingReady: true,
      readyForNext: false,
    },
  };
}

export async function runServiceFlowProposalFallbackSynthesisOpenAI(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly failureIssues: readonly string[];
  readonly rejectedAssistantPreview?: string;
  readonly rejectedNextQuestion?: string | null;
  readonly rejectedUpdatedFlowPreview?: string;
}): Promise<ServiceFlowProposalFallbackSynthesisResult> {
  const nowIso = new Date().toISOString();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const skeleton = buildServiceFlowDescriptionProposalSkeletonPack({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      nowIso,
    });
    return {
      ok: true,
      data: skeleton,
      model: "skeleton",
      promptText: "[service-flow-fallback-synthesis] NO_KEY → description proposal skeleton",
      usedSkeleton: true,
    };
  }

  const model = resolveOpenAiModelFromEnv();
  const system = `${workspaceAiMemberSystemPrefix("actor_flow")}당신은 service-flow 검증 실패 복구용 **proposal-first 흐름 합성기**입니다.
사용자에게 백지 질문(question-first)을 하지 않습니다. JSON 1개만 출력합니다.
updatedFlow(actors>=2, steps>=3)와 구조화된 assistantMessage를 프로젝트·산출물에서 추론해 채우세요.`;

  const user = buildServiceFlowProposalFallbackSynthesisUserPrompt(input);
  const promptText = `[service-flow-proposal-fallback-synthesis]\n[system]\n${system}\n\n[user]\n${user}`;

  const res = await postOpenAiChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.22,
    maxTokens: 1400,
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

  const wire = parseServiceFlowAnalyzeWire(parsed, nowIso);
  if (!wire.ok) {
    return { ok: false, code: "SCHEMA", message: wire.message, promptText };
  }

  const validation = validateServiceFlowAnalyzeResponse({
    parsed: wire.data,
    userMessage: input.userMessage,
    currentFlow: input.currentFlow,
  });
  if (!validation.ok) {
    const skeleton = buildServiceFlowDescriptionProposalSkeletonPack({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      nowIso,
    });
    const skValidation = validateServiceFlowAnalyzeResponse({
      parsed: skeleton,
      userMessage: input.userMessage,
      currentFlow: input.currentFlow,
    });
    if (skValidation.ok) {
      return {
        ok: true,
        data: skeleton,
        model: "skeleton",
        promptText: `${promptText}\n\n--- fallback synthesis validation failed → skeleton ---\n${validation.issues.join(", ")}`,
        usedSkeleton: true,
      };
    }
    return {
      ok: false,
      code: "QUALITY",
      message: `fallback 검증 실패: ${validation.issues.join(", ")}`,
      promptText,
    };
  }

  const merged = mergeServiceFlowUserFacingMessage(wire.data.assistantMessage, wire.data.nextQuestion);
  if (
    !merged.trim() ||
    (detectQuestionFirstUx(merged) && !hasProposalFirstStructure(merged))
  ) {
    return { ok: false, code: "QUALITY", message: "fallback 합성 메시지가 proposal-first가 아님", promptText };
  }

  return {
    ok: true,
    data: { ...wire.data, assistantMessage: merged },
    model,
    promptText,
  };
}
