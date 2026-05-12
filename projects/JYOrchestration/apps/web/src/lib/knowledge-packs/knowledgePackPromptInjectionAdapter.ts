import { buildKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackPromptContextBuilder";
import { retrieveKnowledgePackKeywordRetrievalResult } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

/**
 * 지식팩 검색 → 프롬프트용 컨텍스트 문자열. Cursor 실행 파이프라인에는 아직 연결하지 않는다.
 */
export async function buildKnowledgePackContextForDeveloperTask(input: {
  userId: string;
  knowledgePackId: string;
  query: string;
  taskTitle?: string;
  taskDescription?: string;
  limit?: number;
  agentRole?: string;
}): Promise<{ contextText: string; diagnostics: string[] }> {
  const limit = input.limit != null ? Number(input.limit) : 8;
  const retrieval = await retrieveKnowledgePackKeywordRetrievalResult(
    input.userId,
    input.knowledgePackId,
    input.query,
    Number.isFinite(limit) ? limit : 8
  );

  const contextText = buildKnowledgePackPromptContext({
    agentRole: input.agentRole ?? "AI_DEVELOPER",
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    retrieval,
  });

  return {
    contextText,
    diagnostics: [...retrieval.diagnostics, `context_chars=${contextText.length}`],
  };
}
