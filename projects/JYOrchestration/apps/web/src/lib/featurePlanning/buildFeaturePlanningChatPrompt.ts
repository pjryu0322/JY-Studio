import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { artifactForFeaturePlanningLlmPrompt } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { planningTopicInstructionKo, planningTopicLabelKo } from "@/lib/featurePlanning/featurePlanningTopic";

export type FeaturePlanningChatPlanningContextV1 = {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly ideationSummary: string;
  readonly actorFlowSummary: string;
  readonly conversationSummary: string;
};

export function buildFeaturePlanningChatSystemPrompt(): string {
  return `당신은 JYOrchestration의 AI 기획자입니다.

현재 단계는 "기능정리"입니다.

당신의 목표는 사용자와 대화하며 서비스 기능 구조를 확정하는 것입니다.

당신은 설명문 작성자가 아니라 대화를 진행하는 기획자(진행 촉진·공동 설계)입니다.

[행동 규칙]

1. 긴 설명문·개요·이론을 쓰지 마세요.
2. 먼저 **현재 진행 단계**에 맞는 **실제 초안**을 숫자 목록으로 제시하세요(항목 3~7개, 이름만 짧게).
3. 한 번에 하나의 주제만 다룹니다(단계는 사용자 입력에 따라 LLM이 planningTopic으로 갱신).
4. **aiMessage**에는 반드시 아래 형식을 쓰세요(짧게):

[초안]
1. …
2. …

[질문]
한 문장 질문?

5. **기능정리 단계입니다** 같은 메타 문구로 시작하지 마세요.
6. 카테고리 이름만 나열하고 끝내지 마세요. 항상 초안 + 질문입니다.
7. 한국어. 실무 기획자처럼 명확하게.
8. 이전 단계 **역할**은 다시 묻지 마세요. 필요하면 항목에 roleTags만 반영하세요.

[JSON — 반드시 함께 출력]

기능 구조 데이터는 반드시 아래 JSON으로 갱신하세요(본문 aiMessage와 별개).

{
  "updatedSlots": [ ...입력과 동일한 slot 형태... ],
  "recommendedOrder": ["SLOT-001", "..."],
  "prototypeReadiness": { "status": "READY|NEEDS_REVIEW|INSUFFICIENT", "missingItems": [], "notes": "" },
  "aiMessage": "위 [초안]/[질문] 형식 문자열",
  "planningTopic": "FEATURES|MENU|SCREENS|SCREEN_DETAILS|DATA|TASKS",
  "changeSummary": ["..."],
  "nextQuestions": ["선택: 비우거나 한 개만. aiMessage에 [질문]이 있으면 빈 배열 가능"],
  "newFeatureCandidates": ["..."],
  "filledSlotsSummary": ["..."]
}

- **planningTopic**: 현재 집중 주제. 사용자가 이전 단계를 명확히 마쳤다고 판단되면 **다음** 단계 값으로 바꿉니다(예: 핵심 기능 합의 후 MENU). 불확실하면 기존 값 유지(생략 시 서버가 유지).
- **nextQuestions**: aiMessage에 [질문]을 넣었으면 [] 로 두어도 됩니다.

내부 용어「슬롯」은 사용자에게 쓰지 마세요.`;
}

export function buildFeaturePlanningChatUserPrompt(input: {
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly chatTranscript: string;
  readonly userMessage: string;
  readonly currentTopic: FeaturePlanningTopicV1;
  readonly planningContext: FeaturePlanningChatPlanningContextV1;
}): string {
  const forPrompt = artifactForFeaturePlanningLlmPrompt(input.artifact);
  const artifactJson = JSON.stringify(
    {
      version: forPrompt.version,
      slots: forPrompt.slots,
      recommendedOrder: forPrompt.recommendedOrder,
      prototypeReadiness: forPrompt.prototypeReadiness,
      priorStepActorRoles: input.artifact.priorStepActorRoles ?? [],
      planningTopic: input.artifact.planningTopic ?? input.currentTopic,
    },
    null,
    0
  );

  const topicLine = `${input.currentTopic} (${planningTopicLabelKo(input.currentTopic)})`;
  const topicRule = planningTopicInstructionKo(input.currentTopic);

  return `프로젝트명:
${input.planningContext.projectName}

프로젝트 설명:
${input.planningContext.projectDescription}

아이디어 구체화 결과:
${input.planningContext.ideationSummary}

액터 및 서비스 흐름 정의 결과:
${input.planningContext.actorFlowSummary}

기존 요약·맥락:
${input.planningContext.conversationSummary}

기능정리 대화 로그(최근):
${input.chatTranscript.slice(0, 12000)}

현재 진행 단계(currentTopic):
${topicLine}

[이 단계에서의 집중 규칙]
${topicRule}

사용자 최신 입력:
${input.userMessage.trim()}

[기능 정리 JSON — 갱신용]
${artifactJson.slice(0, 28000)}

위를 반영해 **하나의 JSON 객체**만 출력하세요. aiMessage 필드에 [초안]/[질문] 형식을 넣습니다.`;
}
