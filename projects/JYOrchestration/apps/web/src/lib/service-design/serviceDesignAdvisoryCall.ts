import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { labelAi } from "@/lib/service-design/serviceDesignResponsePolicy";

export type ServiceDesignAdvisoryResult = {
  advisorId: string;
  advisorLabel: string;
  summary: string;
  skipped: boolean;
  error?: string;
};

export async function runOptionalAdvisoryCalls(input: {
  apiKey: string;
  userMessage: string;
  advisors: string[];
  stage: string;
  intent: string;
}): Promise<ServiceDesignAdvisoryResult[]> {
  const advisors = input.advisors.slice(0, 2);

  if (!advisors.length) return [];

  const model = resolveOpenAiModelFromEnv();

  const results: ServiceDesignAdvisoryResult[] = [];

  for (const advisorId of advisors) {
    const advisorLabel = labelAi(advisorId);

    try {
      const system = `
당신은 ${advisorLabel}입니다.
역할은 사용자에게 직접 답변하는 것이 아니라, 현재 질문에 대해 짧은 내부 자문 의견을 제공하는 것입니다.

규칙:
- 한국어로 답합니다.
- 1~3문장으로만 답합니다.
- 실행 결정은 내리지 않습니다.
- 현재 단계와 무관한 내용은 "현재 단계에서는 참고 의견만 가능"이라고 제한합니다.
`.trim();

      const user = `
현재 단계: ${input.stage}
질문 의도: ${input.intent}

사용자 질문:
${input.userMessage}

내부 자문 의견만 작성하세요.
`.trim();

      const res = await postOpenAiChatCompletion({
        apiKey: input.apiKey,
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      });

      if (!res.ok) {
        results.push({
          advisorId,
          advisorLabel,
          summary: "",
          skipped: false,
          error: res.message || res.code || "ADVISORY_FAILED",
        });
        continue;
      }

      const body = res.text?.trim() ?? "";
      if (!body) {
        results.push({
          advisorId,
          advisorLabel,
          summary: "",
          skipped: false,
          error: "ADVISORY_EMPTY",
        });
        continue;
      }

      results.push({
        advisorId,
        advisorLabel,
        summary: body.slice(0, 800),
        skipped: false,
      });
    } catch (error) {
      results.push({
        advisorId,
        advisorLabel,
        summary: "",
        skipped: false,
        error: error instanceof Error ? error.message : "ADVISORY_EXCEPTION",
      });
    }
  }

  return results;
}
