import { buildMergedKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackMergedPromptContext";
import { recommendKnowledgePacks } from "@/lib/knowledge-packs/knowledgePackRecommendationService";
import { stripKnowledgePackContextMarkdownWrapper } from "@/lib/knowledge-packs/knowledgePackPromptContextBuilder";

const AGENT = "AI_DEVELOPER" as const;
const MODE = "STATIC_OR_KEYWORD" as const;
const RECOMMEND_LIMIT = 8;
const TOP_PICKS = 3;
const MERGE_QUERY_MAX = 4000;
const MERGE_PER_PACK = 5;
const MERGE_MAX_CHARS = 7500;

export type KnowledgePackInjectionTimelinePayload = Readonly<{
  agentRole: string;
  recommendedKnowledgePackIds: readonly string[];
  usedKnowledgePackIds: readonly string[];
  contextChars: number;
  mode: string;
  diagnostics: readonly string[];
}>;

export type WorkUnitKnowledgePackResolution =
  | { readonly outcome: "merged"; readonly innerMarkdown: string; readonly timeline: KnowledgePackInjectionTimelinePayload }
  | { readonly outcome: "no_match"; readonly timeline: KnowledgePackInjectionTimelinePayload }
  | { readonly outcome: "skipped" }
  | { readonly outcome: "failure"; readonly message: string };

/**
 * WorkUnit Cursor 프롬프트용: 추천 상위 지식팩을 병합한 뒤, 프롬프트 빌더에 넣을 **내부** Markdown(바깥 `## Knowledge Pack Context` 제목 없음)을 만든다.
 */
export async function resolveWorkUnitKnowledgePackInjection(input: Readonly<{
  userId: string;
  projectId: string;
  textBlob: string;
  taskTitle: string;
  taskDescription?: string | null;
}>): Promise<WorkUnitKnowledgePackResolution> {
  const uid = input.userId.trim();
  if (!uid || !input.textBlob.trim()) {
    return { outcome: "skipped" };
  }

  try {
    const { recommendations, diagnostics: recDiag } = await recommendKnowledgePacks({
      userId: uid,
      projectId: input.projectId,
      text: input.textBlob,
      agentRole: AGENT,
      limit: RECOMMEND_LIMIT,
    });

    const recIds = recommendations.slice(0, 5).map((r) => r.knowledgePackId);
    const topIds = recommendations.filter((r) => r.score > 0).slice(0, TOP_PICKS).map((r) => r.knowledgePackId);

    if (!topIds.length) {
      return {
        outcome: "no_match",
        timeline: {
          agentRole: AGENT,
          recommendedKnowledgePackIds: recIds,
          usedKnowledgePackIds: [],
          contextChars: 0,
          mode: MODE,
          diagnostics: [...recDiag, "no_positive_score_pick"],
        },
      };
    }

    const merged = await buildMergedKnowledgePackPromptContext({
      userId: uid,
      knowledgePackIds: topIds,
      query: input.textBlob.slice(0, MERGE_QUERY_MAX),
      taskTitle: input.taskTitle,
      taskDescription: input.taskDescription ?? undefined,
      agentRole: AGENT,
      limitPerPack: MERGE_PER_PACK,
      maxTotalChars: MERGE_MAX_CHARS,
    });

    const timeline: KnowledgePackInjectionTimelinePayload = {
      agentRole: AGENT,
      recommendedKnowledgePackIds: recIds,
      usedKnowledgePackIds: merged.usedKnowledgePackIds,
      contextChars: merged.contextText.length,
      mode: MODE,
      diagnostics: [...recDiag, ...merged.diagnostics],
    };

    const inner = merged.contextText.trim()
      ? stripKnowledgePackContextMarkdownWrapper(merged.contextText).trim()
      : "";
    if (inner) {
      return { outcome: "merged", innerMarkdown: inner, timeline };
    }

    return { outcome: "no_match", timeline };
  } catch (e) {
    return { outcome: "failure", message: String(e) };
  }
}
