import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { generateKnowledgePackDraftMock, type KnowledgePackDraftInput, type KnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";
import { mergeKnowledgePackDraftWithMock, parseKnowledgePackDraftLlmJson } from "@/lib/knowledge-packs/knowledgePackDraftLlmMerge";

export { mergeKnowledgePackDraftWithMock, parseKnowledgePackDraftLlmJson } from "@/lib/knowledge-packs/knowledgePackDraftLlmMerge";

export const KNOWLEDGE_PACK_DRAFT_LLM_SYSTEM = `너는 JYOrchestration Knowledge Pack Management System의 지식팩 구조화 엔진이다.

목표:
- 사용자가 입력한 제품명/URL/카테고리/목적을 기반으로 AI개발자가 활용 가능한 지식팩 초안을 생성한다.
- 실제 공식 문서를 읽지 못한 경우, 사실로 단정하지 말고 "공식 문서 확인 필요"로 표시한다.
- 라이선스, 보안, API Key, Secret, 개인정보 관련 내용은 반드시 주의사항으로 포함한다.
- 응답은 지정 JSON 스키마의 단일 객체만 반환한다. Markdown 설명, 코드블록(백틱 펜스), 서론 금지.

카테고리별 초점:
- GRID: 업무용 목록/조회, 정렬/필터/페이지네이션/행 선택, 단순 HTML table 금지, 라이선스·Wrapper·React 적용 확인, Cursor 구현 지침.
- AUTH: OAuth, Redirect URI, Callback, Token, Secret 프론트 노출 금지, 사용자 정보 조회, 로그아웃/연결 끊기 구분, Simulator/Sandbox/Real 분리.
- API 또는 INTEGRATION: Base URL, Endpoint, Request/Response, Error 시나리오, Timeout/Retry, 인증/Secret 관리, Simulator 가능성.
- 그 외: 일반 지식팩 구조(요약·권장/비권장·제약·검수)를 채운다.

JSON 키(모두 문자열 값. 줄바꿈으로 항목 구분 가능한 필드는 \\n으로 구분):
summary, licenseNotes, recommendedUseCases, notRecommendedUseCases, capabilities, constraints, implementationGuidelines, cursorPromptRules, forbiddenPatterns, reviewChecklist, securityChecklist, alternatives, references, previewSpec, sourceCandidates, warnings

warnings는 문자열 배열로 추가 주의 문구를 넣을 수 있다.`;

function buildKnowledgePackDraftUserJson(input: KnowledgePackDraftInput): string {
  return JSON.stringify(
    {
      task: "knowledge_pack_draft",
      input: {
        productName: input.productName,
        productUrl: input.productUrl ?? null,
        category: input.category,
        agents: [...input.agents],
        purpose: input.purpose ?? null,
        officialDocsUrl: input.officialDocsUrl ?? null,
        apiDocsUrl: input.apiDocsUrl ?? null,
        repositoryUrl: input.repositoryUrl ?? null,
        licenseHint: input.licenseHint ?? null,
        memo: input.memo ?? null,
      },
    },
    null,
    0
  );
}

/**
 * OpenAI Chat Completions로 초안 JSON을 받아 Mock과 병합한다.
 * 키·네트워크는 호출자가 보장한다.
 */
export async function generateKnowledgePackDraftWithLlm(
  input: KnowledgePackDraftInput,
  opts: Readonly<{ apiKey: string; model: string }>
): Promise<{ ok: true; draft: KnowledgePackDraftResult } | { ok: false; error: string }> {
  const mockBase = generateKnowledgePackDraftMock(input);
  const userContent = `${buildKnowledgePackDraftUserJson(input)}

위 input만 근거로 JSON 객체를 반환하라. 공문서를 읽지 않았다면 각 필드에 "공식 문서 확인 필요"를 명시하라.`;

  const res = await postOpenAiChatCompletion({
    apiKey: opts.apiKey,
    model: opts.model,
    messages: [
      { role: "system", content: KNOWLEDGE_PACK_DRAFT_LLM_SYSTEM },
      { role: "user", content: userContent },
    ],
    temperature: 0.35,
    maxTokens: 3800,
    responseFormatJsonObject: true,
  });

  if (!res.ok) {
    return { ok: false, error: res.message };
  }

  const parsed = parseKnowledgePackDraftLlmJson(res.text);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const draft = mergeKnowledgePackDraftWithMock(mockBase, parsed.partial);
  return { ok: true, draft };
}
