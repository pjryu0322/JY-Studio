import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { getMessageTargets } from "@/lib/requirements/requirementsTargets";

export type RequirementsPromptView = {
  systemPrompt: string;
  projectContext: {
    name: string;
    description: string;
    stage: "Requirements";
  };
  target: {
    targetId: string;
    targetName: string;
  };
  conversationExcerpt: string;
  finalComposedPrompt: string;
};

export const REQUIREMENTS_SYSTEM_PROMPT_READABLE = `당신은 소프트웨어 프로젝트의 요구사항 정리를 돕는 AI 기획자입니다.
역할: 범위·모호함·누락·역할·기능/비기능 요구를 짧게 질문하고, 확인 가능한 요구사항으로 수렴시키세요.
규칙:
- 한국어로 답합니다.
- 1회 응답은 8문장 이내, 불필요한 서론·마크다운 제목 없이 대화체로 작성합니다.
- "어떤 프로젝트인가요?"처럼 프로젝트를 모르는 질문은 금지합니다.`;

export function buildConversationExcerpt(messages: readonly RequirementsMessage[], maxChars = 6000): string {
  const lines = messages.slice(-30).map((m) => {
    const who =
      m.speakerType === "USER"
        ? `사용자(${m.speakerName || "나"})`
        : m.speakerType === "AI"
          ? `AI(${m.speakerName || "AI"})`
          : m.speakerType === "HUMAN"
            ? `멤버(${m.speakerName || "멤버"})`
            : "시스템";
    const tgs = getMessageTargets(m);
    const target = tgs.length ? ` → ${tgs.map((t) => `@${t.name}`).join(", ")}` : m.targetName ? ` → @${m.targetName}` : "";
    return `${who}${target}: ${m.content}`.trim();
  });
  return lines.join("\n").slice(-maxChars);
}

export function buildRequirementsPromptView(input: {
  projectName: string;
  projectDescription: string;
  targetId: string;
  targetName: string;
  messages: readonly RequirementsMessage[];
  userMessage: string;
}): RequirementsPromptView {
  const conversationExcerpt = buildConversationExcerpt(input.messages);
  const finalComposedPrompt = `다음 정보를 알고 있다고 가정하고 답하세요. "어떤 프로젝트인가요?"처럼 프로젝트를 모르는 질문은 금지합니다.

[프로젝트]
- 이름: ${input.projectName.trim() || "(이름 없음)"}
- 설명: ${input.projectDescription.trim() || "(설명 없음)"}

[현재 단계]
- Requirements(요구사항)

[최근 대화 발췌]
${conversationExcerpt || "(이전 메시지 없음)"}

[이번 사용자 메시지]
${input.userMessage.trim()}`;

  return {
    systemPrompt: REQUIREMENTS_SYSTEM_PROMPT_READABLE,
    projectContext: {
      name: input.projectName,
      description: input.projectDescription,
      stage: "Requirements",
    },
    target: {
      targetId: input.targetId,
      targetName: input.targetName,
    },
    conversationExcerpt,
    finalComposedPrompt,
  };
}

