import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { orderedSlotsForFeaturePlanningUi } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningSlotsLlmContext } from "@/lib/featurePlanning/buildFeaturePlanningSlotsContext";

export type FeaturePlanningRecommendedCategoryV1 = {
  readonly name: string;
  readonly reason: string;
};

export type FeaturePlanningFirstMessageLlmOutputV1 = {
  readonly firstMessage: string;
  readonly recommendedCategories: readonly FeaturePlanningRecommendedCategoryV1[];
  readonly nextFocus: "CATEGORY_SELECTION";
};

export const FEATURE_PLANNING_DEFAULT_CATEGORY_NAMES = [
  "핵심 기능",
  "메뉴 구조",
  "화면 목록",
  "화면별 기능",
  "데이터 구조",
  "관리자 기능",
  "공통 컴포넌트",
  "프로토타입 Task",
] as const;

export function buildFeaturePlanningFirstMessageSystemPrompt(): string {
  const defaults = FEATURE_PLANNING_DEFAULT_CATEGORY_NAMES.join("\n- ");
  return `당신은 JYOrchestration의 AI 기획자입니다. 지금은 기능정리 **첫 인사 한 번**을 만듭니다.

당신은 설명문 작성자가 아니라, **초안을 제시하고 질문으로 대화를 시작**하는 진행자입니다.

[반드시 지킬 것]

1. JSON만 출력합니다.
2. **firstMessage**는 짧게. 반드시 아래 형식:

[초안]
1. (기능 이름 — 실제 서비스에 맞는 짧은 후보 3~7개, 한 줄에 하나만)
2. …

[질문]
한 문장 질문(사용자가 짧게 답할 수 있게)

3. **기능정리 단계입니다**, **다음과 같은 영역이 있습니다** 같은 메타·서론 금지.
4. 영역 **이름만** 나열하고 끝내지 마세요. 반드시 **기능 이름 수준의 초안** + **질문**입니다.
5. 역할(누가 사용자인지 등)을 다시 묻지 마세요. 이전 단계에서 확정되었습니다.
6. firstMessage 안에 **recommendedCategories 목록을 다시 붙이지 마세요**(중복 금지).

[recommendedCategories]

- 5~10개. **name**은 정리 **영역** 이름(예: 핵심 기능, 메뉴 구조 …). 도메인에 맞게 바꿔도 됩니다.
- **reason**은 한 줄(이 프로젝트에 왜 필요한지).
- 약한 맥락이면 아래를 참고해 시작할 수 있습니다:
- ${defaults}

nextFocus는 항상 CATEGORY_SELECTION.

출력 형태:
{
  "firstMessage": "string",
  "recommendedCategories": [ { "name": "string", "reason": "string" } ],
  "nextFocus": "CATEGORY_SELECTION"
}`;
}

function slotsSummaryForPrompt(artifact: FeaturePlanningSlotsArtifactV1, maxChars: number): string {
  const ordered = orderedSlotsForFeaturePlanningUi(artifact);
  const lines = ordered.map((s) => {
    const itemHints = s.items
      .slice(0, 3)
      .map((it) => {
        const n = it.name.trim();
        if (!n) return "";
        const rt = it.roleTags?.length ? ` [${it.roleTags.join("/")}]` : "";
        return `${n}${rt}`;
      })
      .filter(Boolean)
      .join(", ");
    const tail = s.items.length > 3 ? ` …외 ${s.items.length - 3}개` : "";
    return `- [${s.slotType}] ${s.slotName}: ${itemHints || "(항목 없음)"}${tail}`;
  });
  const body = lines.join("\n");
  return body.length <= maxChars ? body : `${body.slice(0, maxChars)}\n…(truncated)`;
}

export function buildFeaturePlanningFirstMessageUserPrompt(
  ctx: FeaturePlanningSlotsLlmContext,
  artifact: FeaturePlanningSlotsArtifactV1
): string {
  return `프로젝트명:
${ctx.projectName}

프로젝트 설명:
${ctx.projectDescription}

아이디어 구체화 결과:
${ctx.ideationDeliverablesText}

액터 및 서비스 흐름 정의 결과:
${ctx.actorServiceFlowText}

이전 단계에서 확정된 액터 이름(참조 전용):
${ctx.confirmedActorRoleNames.length ? ctx.confirmedActorRoleNames.map((n) => `- ${n}`).join("\n") : "(없음)"}

대화·요약 맥락:
${ctx.conversationSummaryText}

[기능 정리 영역·항목 힌트 — firstMessage에 영역 제목만 복붙하지 말고, 핵심 기능 [초안]에 **항목 이름**으로 녹여낼 것]
${slotsSummaryForPrompt(artifact, 6000)}

위를 반영해 JSON만 출력하세요.`;
}
