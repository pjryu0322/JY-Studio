import { workspaceAiMemberSystemPrefix } from "@/lib/ai-member/platformAiMembers";
import {
  buildImplementationTurnOrchestrationPatchFromModel,
} from "@/lib/prototype/implementationUserFeedback";
import { fallbackAnalyzeImplementationUserTurnByRule } from "@/lib/workspace-turn/implementationTurnRuleFallback";
import {
  buildImplementationTurnClarificationTimelineEntry,
  buildImplementationTurnPatchAppliedTimelineEntry,
  buildWorkspaceTurnAnalyzedTimelineEntry,
} from "@/lib/workspace-turn/workspaceTurnTimeline";
import type {
  ImplementationTurnContext,
  ImplementationTurnStatePatch,
  WorkspaceTurnConfig,
  WorkspaceTurnInput,
} from "@/lib/workspace-turn/workspaceTurnTypes";
import { validateImplementationTurnModelJson } from "@/lib/workspace-turn/workspaceTurnValidation";

const IMPLEMENTATION_RESPONSE_CONTRACT = `
너는 구현단계 SingleChat의 Primary 응답자(AI 개발자)다.
- 기획단계 질문(목표 사용자, 서비스 목적, 역할 고려 등)으로 돌아가지 않는다.
- 사용자 입력을 확정 기준 / 후보 방향 / 질문 / 실행요청 / 보안·데이터 정책으로 분류한다.
- 모호한 선호는 status=candidate, requiresClarification=true로 후보 반영하고 확인 질문을 제시한다.
- 확정형 문구("요청하신 구현 기준을 반영했습니다")는 status=confirmed_candidate이고 confidence=high일 때만 사용한다.
- Code Agent 실행은 환경 Gate 이후에만 가능하다고 분리 안내한다.
- 사용자가 SCM/환경설정/역할별 점검 결과를 요청하면, 세부정보를 되묻기보다 현재 envOk와 제공된 컨텍스트 기준으로 가능한 범위의 상태를 설명하고 환경설정/역할별 점검 보기로 안내한다.
- JSON 1개만 출력한다(마크다운/코드펜스 금지).
`.trim();

export function buildImplementationModeSystemPrompt(
  input: WorkspaceTurnInput<ImplementationTurnContext>,
): string {
  return `${IMPLEMENTATION_RESPONSE_CONTRACT}

${workspaceAiMemberSystemPrefix("prototype_build")}

화면: 프로토타입 실행(구현단계).
환경준비(envOk): ${input.envOk ? "yes" : "no"}`;
}

export function buildImplementationModeUserPrompt(
  input: WorkspaceTurnInput<ImplementationTurnContext>,
): string {
  return `프로젝트: ${input.projectName || "(이름 없음)"}
설명: ${input.projectDescription || "(설명 없음)"}

[사용자 메시지]
${input.userMessage}

출력 JSON 스키마:
{
  "intent": "implementation_requirement" | "implementation_preference" | "implementation_question" | "execution_request" | "scope_change" | "security_policy" | "data_policy" | "unknown",
  "status": "confirmed_candidate" | "candidate" | "question" | "blocked" | "none",
  "confidence": "high" | "medium" | "low",
  "responderLabel": "AI 개발자",
  "assistantMessage": "사용자에게 보여줄 본문(한국어)",
  "summary": "내부 요약 한 줄",
  "extractedRules": [{ "label": "...", "value": "...", "normalizedValue": "...", "confidence": "high|medium|low" }],
  "targetAreas": ["implementation_seed", "implementation_work_plan_draft", "review_criteria", "security_criteria", "common_detail_features", "data_policy", "screen_implementation_items"],
  "requiresClarification": true|false,
  "clarifyingQuestion": "행동형 CTA 라벨" | null,
  "nextQuestion": "추가 질문(본문과 중복 금지)" | null
}`;
}

export const implementationModeTurnConfig: WorkspaceTurnConfig<
  ImplementationTurnContext,
  ImplementationTurnStatePatch
> = {
  mode: "implementation",
  stage: "implementation",
  primaryMemberId: "prototype_build",
  primaryMemberLabel: "AI 개발자",
  advisorMemberIds: ["reviewer", "security", "scm"],
  responseContract: IMPLEMENTATION_RESPONSE_CONTRACT,
  buildSystemPrompt: buildImplementationModeSystemPrompt,
  buildUserPrompt: buildImplementationModeUserPrompt,
  validateModelJson: validateImplementationTurnModelJson,
  fallbackAnalyze: (input) =>
    fallbackAnalyzeImplementationUserTurnByRule({
      userMessage: input.userMessage,
      envOk: input.envOk,
    }),
  buildStatePatch: ({ context, model, userMessage, userMessageId, nowIso }) => {
    const orchestration = buildImplementationTurnOrchestrationPatchFromModel({
      requirementsStateJson: context.requirementsStateJson,
      text: userMessage,
      sourceMessageId: userMessageId,
      model,
      nowIso,
    });
    return { orchestration };
  },
  buildTimelineEntries: ({ model, nowIso, source }) => {
    const entries = [
      buildWorkspaceTurnAnalyzedTimelineEntry({ mode: "implementation", model, source, nowIso }),
    ];
    if (model.status === "confirmed_candidate" || model.status === "candidate") {
      entries.push(buildImplementationTurnPatchAppliedTimelineEntry({ model, nowIso }));
    }
    if (model.requiresClarification) {
      entries.push(buildImplementationTurnClarificationTimelineEntry({ model, nowIso }));
    }
    return entries;
  },
};
