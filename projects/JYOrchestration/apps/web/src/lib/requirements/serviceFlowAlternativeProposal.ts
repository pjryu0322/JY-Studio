/**
 * Service-flow "다른 대안 보기" — alternative proposal generation orchestration.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { runServiceFlowAnalyzeOpenAI } from "@/lib/project/requirementsAiFacilitatorOpenAI";
import { augmentUserMessageForLlm } from "@/lib/requirements/singleChatQuickAction";
import { finalizeServiceFlowAssistantForResponse } from "@/lib/requirements/serviceFlowAssistantPresentation";
import type { ServiceFlowAnalyzeParsed } from "@/lib/requirements/serviceFlowAnalyzeValidation";
import {
  ALTERNATIVE_BASELINE_FAILURE_QUICK_REPLIES,
  buildAlternativeBaselineFailureUserMessage,
  resolveAlternativeBaseline,
  type AlternativeBaselineSource,
} from "@/lib/requirements/serviceFlowAlternativeBaseline";
import {
  computeProposalFlowDeltaScore,
  fingerprintHashFromFlow,
  isAlternativeProposalInsufficientDelta,
  markFlowAsAlternativeProposalVariant,
  type ProposalVariantMode,
} from "@/lib/requirements/serviceFlowProposalVariant";
import {
  ALTERNATIVE_CANVAS_QUICK_REPLIES,
  buildAlternativeCompactAssistantMessage,
  buildAlternativeProposalPayload,
  type AlternativeProposalPayloadWire,
} from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

export type ServiceFlowAlternativeTurnResult =
  | {
      readonly ok: true;
      readonly data: ServiceFlowAnalyzeParsed & { updatedFlow: RequirementsServiceFlowV1 };
      readonly model: string | null;
      readonly promptText?: string;
      readonly proposalFallbackApplied?: boolean;
      readonly proposalVariantMode: ProposalVariantMode;
      readonly proposalFingerprint: string;
      readonly proposalDeltaScore: number;
      readonly alternativeGenerationReason?: string;
      readonly alternativeBaselineSource: AlternativeBaselineSource;
      readonly alternativeBaselineRecovered: boolean;
      readonly alternativeProposalPayload: AlternativeProposalPayloadWire;
      readonly routingDecision: string;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly failureReason: string;
      readonly alternativeBaselineSource?: AlternativeBaselineSource;
      readonly alternativeBaselineRecovered: boolean;
      readonly userFacingMessage: string;
      readonly quickReplies: readonly string[];
      readonly promptText?: string;
      readonly routingDecision: string;
    };

function buildAlternativeAnalyzeAugment(input: {
  readonly previousFlow: RequirementsServiceFlowV1;
  readonly regeneration?: boolean;
}): string {
  const prevJson = JSON.stringify({
    actors: input.previousFlow.actors?.map((a) => a.name),
    steps: [...(input.previousFlow.steps ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((s) => s.title),
  }).slice(0, 2000);

  const regen = input.regeneration
    ? `\n[재생성] 직전 출력은 직전 초안과 구조적으로 너무 유사합니다(alternative_generation_insufficient_delta). actor·단계·협업 관점을 **더 다르게** 바꾸세요.`
    : "";

  return `[Alternative proposal generation — 필수]
사용자는 "다른 대안 보기"를 선택했습니다. 아래 직전 초안과 **다른 방향**의 service-flow proposal을 새로 제안하세요.
- 다른 관점·운영 방식·actor 구조·workflow depth·협업 구조 중 2가지 이상 변경
- 직전과 동일한 단계 제목·액터 나열만 반복 금지
- updatedFlow에 actors/steps를 반드시 채울 것(상세 구조는 canvas가 렌더링)
- assistantMessage는 2~3줄 요약만(예상 흐름·액터 전체 나열 금지, 채팅에 proposal dump 금지)
- 첫 문단에 "기존 초안과 다른 방향" 맥락 + 무엇이 달라졌는지 1~2문장
- nextQuestion은 null

[직전 초안 구조]
${prevJson}${regen}`;
}

export async function runServiceFlowAlternativeProposalTurn(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly userMessage: string;
  readonly quickActionLabel: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages: string;
  readonly latestAiQuestion: string;
  readonly priorScreenHandoff?: string;
  readonly participatingAgentsPromptBlock?: string;
}): Promise<ServiceFlowAlternativeTurnResult> {
  const baseline = resolveAlternativeBaseline({
    currentFlow: input.currentFlow,
    recentMessages: input.recentMessages,
    ideationAssets: input.ideationAssets,
    priorScreenHandoff: input.priorScreenHandoff,
  });

  const hadFlowSteps = (input.currentFlow?.steps?.length ?? 0) >= 1;
  const alternativeBaselineRecovered = Boolean(baseline && !hadFlowSteps);

  if (!baseline) {
    return {
      ok: false,
      code: "NO_BASELINE",
      message: "비교할 기존 흐름이 없습니다.",
      failureReason: "NO_BASELINE_AFTER_RECOVERY",
      alternativeBaselineRecovered: false,
      userFacingMessage: buildAlternativeBaselineFailureUserMessage(),
      quickReplies: [...ALTERNATIVE_BASELINE_FAILURE_QUICK_REPLIES],
      routingDecision: "alternative_proposal_generation_failed",
    };
  }

  const previousFlow = baseline.flow;
  const alternativeBaselineSource = baseline.source;

  const baseUser = augmentUserMessageForLlm(
    input.userMessage,
    input.quickActionLabel,
    "ALTERNATIVE",
  );

  let alternativeGenerationReason: string | undefined;
  let lastResult: Awaited<ReturnType<typeof runServiceFlowAnalyzeOpenAI>> | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const augment = buildAlternativeAnalyzeAugment({
      previousFlow,
      regeneration: attempt > 0,
    });
    const llmUserMessage = `${baseUser}\n\n${augment}`;

    const result = await runServiceFlowAnalyzeOpenAI({
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      ideationAssets: input.ideationAssets,
      userMessage: llmUserMessage,
      currentFlow: previousFlow,
      recentMessages: input.recentMessages,
      latestAiQuestion: input.latestAiQuestion,
      priorScreenHandoff: input.priorScreenHandoff,
      participatingAgentsPromptBlock: input.participatingAgentsPromptBlock,
    });

    lastResult = result;
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        failureReason: result.code,
        alternativeBaselineSource,
        alternativeBaselineRecovered,
        userFacingMessage: buildAlternativeBaselineFailureUserMessage(),
        quickReplies: [...ALTERNATIVE_BASELINE_FAILURE_QUICK_REPLIES],
        promptText: result.promptText,
        routingDecision: "alternative_proposal_generation_failed",
      };
    }

    const deltaScore = computeProposalFlowDeltaScore(previousFlow, result.data.updatedFlow);
    if (!isAlternativeProposalInsufficientDelta({ previousFlow, candidateFlow: result.data.updatedFlow })) {
      const quickReplies = [...ALTERNATIVE_CANVAS_QUICK_REPLIES];
      const alternativeProposalPayload = buildAlternativeProposalPayload({
        baselineFlow: previousFlow,
        alternativeFlow: result.data.updatedFlow,
        llmAssistantMessage: result.data.assistantMessage,
      });
      const compactSummary = buildAlternativeCompactAssistantMessage(alternativeProposalPayload);

      const assistantMessage = finalizeServiceFlowAssistantForResponse({
        assistantMessage: compactSummary,
        nextQuestion: null,
        quickReplies,
        proposalVariantMode: "ALTERNATIVE",
      });

      const updatedFlow = {
        ...markFlowAsAlternativeProposalVariant(result.data.updatedFlow, {
          previousFlow,
          deltaScore,
        }),
        alternativeProposalPayload,
      };

      return {
        ok: true,
        data: {
          ...result.data,
          assistantMessage,
          nextQuestion: null,
          quickReplies: [...quickReplies],
          updatedFlow,
        },
        alternativeProposalPayload,
        model: result.model,
        promptText: result.promptText,
        proposalFallbackApplied: result.proposalFallbackApplied,
        proposalVariantMode: "ALTERNATIVE",
        proposalFingerprint: fingerprintHashFromFlow(updatedFlow),
        proposalDeltaScore: deltaScore,
        ...(alternativeGenerationReason ? { alternativeGenerationReason } : {}),
        alternativeBaselineSource,
        alternativeBaselineRecovered,
        routingDecision: "alternative_proposal_generation",
      };
    }

    alternativeGenerationReason = "alternative_generation_insufficient_delta";
  }

  const last = lastResult?.ok ? lastResult : null;
  if (last?.ok) {
    const deltaScore = computeProposalFlowDeltaScore(previousFlow, last.data.updatedFlow);
    const quickReplies = [...ALTERNATIVE_CANVAS_QUICK_REPLIES];
    const alternativeProposalPayload = buildAlternativeProposalPayload({
      baselineFlow: previousFlow,
      alternativeFlow: last.data.updatedFlow,
      llmAssistantMessage: last.data.assistantMessage,
    });
    const compactSummary = buildAlternativeCompactAssistantMessage(alternativeProposalPayload);
    const assistantMessage = finalizeServiceFlowAssistantForResponse({
      assistantMessage: compactSummary,
      nextQuestion: null,
      quickReplies,
      proposalVariantMode: "ALTERNATIVE",
    });
    const updatedFlow = {
      ...markFlowAsAlternativeProposalVariant(last.data.updatedFlow, {
        previousFlow,
        deltaScore,
      }),
      alternativeProposalPayload,
    };
    return {
      ok: true,
      data: {
        ...last.data,
        assistantMessage,
        nextQuestion: null,
        quickReplies: [...quickReplies],
        updatedFlow,
      },
      alternativeProposalPayload,
      model: last.model,
      promptText: last.promptText,
      proposalFallbackApplied: last.proposalFallbackApplied,
      proposalVariantMode: "ALTERNATIVE",
      proposalFingerprint: fingerprintHashFromFlow(updatedFlow),
      proposalDeltaScore: deltaScore,
      alternativeGenerationReason: "alternative_generation_insufficient_delta",
      alternativeBaselineSource,
      alternativeBaselineRecovered,
      routingDecision: "alternative_proposal_generation",
    };
  }

  return {
    ok: false,
    code: lastResult && !lastResult.ok ? lastResult.code : "QUALITY",
    message:
      lastResult && !lastResult.ok ?
        lastResult.message
      : "대안 proposal 생성에 실패했습니다.",
    failureReason: lastResult && !lastResult.ok ? lastResult.code : "QUALITY",
    alternativeBaselineSource,
    alternativeBaselineRecovered,
    userFacingMessage: buildAlternativeBaselineFailureUserMessage(),
    quickReplies: [...ALTERNATIVE_BASELINE_FAILURE_QUICK_REPLIES],
    promptText: lastResult && !lastResult.ok ? lastResult.promptText : undefined,
    routingDecision: "alternative_proposal_generation_failed",
  };
}
