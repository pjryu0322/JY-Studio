import { resolveOpenAiApiKeyFromEnv, resolveOpenAiModelFromEnv } from "@/lib/ai/openAiEnv";
import { generateKnowledgePackDraftWithLlm } from "@/lib/knowledge-packs/knowledgePackDraftLlmProvider";
import { generateKnowledgePackDraftMock, type KnowledgePackDraftInput, type KnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";
import { resolveUserOpenAiApiKey } from "@/lib/messenger/resolveUserOpenAiKey";

export type KnowledgePackDraftServiceResult = KnowledgePackDraftResult & {
  readonly provider?: "OPENAI" | "MOCK";
  readonly mode?: "LLM" | "MOCK_FALLBACK";
  readonly fallbackUsed?: boolean;
  readonly diagnostics?: readonly string[];
};

function mockServiceFallback(mockBase: KnowledgePackDraftResult, diagnostics: readonly string[]): KnowledgePackDraftServiceResult {
  return {
    ...mockBase,
    provider: "MOCK",
    mode: "MOCK_FALLBACK",
    fallbackUsed: true,
    diagnostics,
  };
}

/**
 * 사용자 연동 키 우선, 없으면 서버 `OPENAI_API_KEY`(직접)로 초안용 키를 해석한다.
 * TODO: 플랫폼 정책에 따라 env 직접 사용 여부를 설정/권한으로 가드할 수 있다.
 */
export async function resolveKnowledgePackDraftOpenAiCredentials(
  userId: string
): Promise<{ apiKey: string; model: string; source: string } | null> {
  const uid = userId.trim();
  if (!uid) return null;
  const userKey = await resolveUserOpenAiApiKey(uid);
  if (userKey.key) {
    return { apiKey: userKey.key, model: resolveOpenAiModelFromEnv(), source: userKey.source };
  }
  const envKey = resolveOpenAiApiKeyFromEnv();
  if (envKey) {
    return { apiKey: envKey, model: resolveOpenAiModelFromEnv(), source: "env.OPENAI_API_KEY_DIRECT" };
  }
  return null;
}

export async function generateKnowledgePackDraft(
  input: KnowledgePackDraftInput,
  ctx: Readonly<{ userId: string }>
): Promise<KnowledgePackDraftServiceResult> {
  const mockBase = generateKnowledgePackDraftMock(input);

  const creds = await resolveKnowledgePackDraftOpenAiCredentials(ctx.userId);
  if (!creds) {
    return mockServiceFallback(mockBase, [
      "OPENAI_API_KEY 또는 사용자 OpenAI 연동 키가 없어 Mock 초안을 사용했습니다.",
    ]);
  }

  try {
    const llm = await generateKnowledgePackDraftWithLlm(input, { apiKey: creds.apiKey, model: creds.model });
    if (!llm.ok) {
      return mockServiceFallback(mockBase, [`LLM 호출 실패: ${llm.error}`, "Mock 초안으로 대체했습니다."]);
    }
    return {
      ...llm.draft,
      provider: "OPENAI",
      mode: "LLM",
      fallbackUsed: false,
      diagnostics: [`openai_source=${creds.source}`],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return mockServiceFallback(mockBase, [`LLM 예외: ${msg.slice(0, 400)}`, "Mock 초안으로 대체했습니다."]);
  }
}
