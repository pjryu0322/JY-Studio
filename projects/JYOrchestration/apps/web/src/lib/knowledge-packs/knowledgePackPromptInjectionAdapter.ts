import { isStaticKnowledgePackId } from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { buildMergedKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackMergedPromptContext";
import { buildKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackPromptContextBuilder";
import { retrieveKnowledgePackKeywordRetrievalResult } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

/**
 * 지식팩 검색 → 프롬프트용 컨텍스트 문자열.
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

  if (isStaticKnowledgePackId(input.knowledgePackId)) {
    const merged = await buildMergedKnowledgePackPromptContext({
      userId: input.userId,
      knowledgePackIds: [input.knowledgePackId],
      query: input.query,
      taskTitle: input.taskTitle,
      taskDescription: input.taskDescription,
      agentRole: input.agentRole ?? "AI_DEVELOPER",
      limitPerPack: Number.isFinite(limit) ? limit : 8,
      maxTotalChars: 6000,
    });
    return {
      contextText: merged.contextText,
      diagnostics: [...merged.diagnostics, `context_chars=${merged.contextText.length}`],
    };
  }

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
    maxChars: 6000,
  });

  return {
    contextText,
    diagnostics: [...retrieval.diagnostics, `context_chars=${contextText.length}`],
  };
}

export { buildMergedKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackMergedPromptContext";
