import { resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import {
  parseProductDefinitionV1,
  PRODUCT_DEFINITION_NEEDS_CONFIRMATION,
  type ProductDefinitionV1,
} from "@/lib/requirements/productDefinitionV1";

function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

const SYSTEM = `당신은 JYOrchestration Product Definition 편집 AI입니다.
사용자는 Product Definition을 직접 작성하지 않습니다. 사용자 요청에 따라 기존 JSON을 수정만 합니다.

규칙:
- 대화에 없는 사실을 추정하지 않습니다. 정보가 부족하면 해당 필드 value를 "${PRODUCT_DEFINITION_NEEDS_CONFIRMATION}"로 두고 confidence를 needs_confirmation으로 둡니다.
- 사용자가 명시적으로 확정한 내용만 confidence: confirmed.
- 출력은 productDefinition JSON + assistantMessage(한국어, 사용자에게 보이는 요약)만 포함합니다.

JSON 스키마는 productDefinitionV1 (version 1) 구조를 따릅니다.`;

export async function runProductDefinitionChatOpenAI(input: {
  readonly apiKey: string;
  readonly current: ProductDefinitionV1;
  readonly userMessage: string;
  readonly recentTranscript?: string;
}): Promise<
  | { readonly ok: true; readonly definition: ProductDefinitionV1; readonly assistantMessage: string; readonly model: string }
  | { readonly ok: false; readonly code: string; readonly message: string }
> {
  const model = resolveOpenAiModelFromEnv();
  const userBlock = [
    "현재 productDefinition JSON:",
    JSON.stringify(input.current).slice(0, 14000),
    "",
    input.recentTranscript ? `최근 대화:\n${input.recentTranscript.slice(0, 4000)}` : "",
    "",
    `사용자 요청:\n${input.userMessage.trim().slice(0, 4000)}`,
    "",
    '응답 JSON: {"productDefinition":{...},"assistantMessage":"..."}',
  ].join("\n");

  const res = await postOpenAiChatCompletion({
    apiKey: input.apiKey,
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userBlock },
    ],
    temperature: 0.25,
    maxTokens: 3500,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message };
  }

  let root: Record<string, unknown>;
  try {
    root = JSON.parse(stripJsonFences(res.text)) as Record<string, unknown>;
  } catch {
    return { ok: false, code: "PARSE", message: "Product Definition 응답 JSON 파싱에 실패했습니다." };
  }

  const defRaw = root.productDefinition ?? root.definition;
  const parsed = parseProductDefinitionV1(defRaw);
  if (!parsed) {
    return { ok: false, code: "SCHEMA", message: "Product Definition JSON 검증에 실패했습니다." };
  }

  const assistantMessage = String(root.assistantMessage ?? root.message ?? "").trim().slice(0, 12000);
  if (!assistantMessage) {
    return { ok: false, code: "EMPTY", message: "AI 응답 본문이 비어 있습니다." };
  }

  return {
    ok: true,
    definition: { ...parsed, updatedAt: new Date().toISOString() },
    assistantMessage,
    model,
  };
}
