export type KnowledgePackRecommendRow = Readonly<{
  knowledgePackId: string;
  name: string;
  category: string;
  score: number;
  reasons: string[];
  source: string;
}>;

export async function postKnowledgePackRecommend(input: Readonly<{
  text: string;
  projectId?: string;
  categoryHints?: readonly string[];
  limit?: number;
}>): Promise<
  | { ok: true; recommendations: KnowledgePackRecommendRow[] }
  | { ok: false; message: string }
> {
  const body: Record<string, unknown> = { text: input.text, agentRole: "AI_DEVELOPER", limit: input.limit ?? 8 };
  const pid = String(input.projectId ?? "").trim();
  if (pid) body.projectId = pid;
  const hints = (input.categoryHints ?? []).map((h) => String(h ?? "").trim()).filter(Boolean);
  if (hints.length) body.categoryHints = hints;

  let r: Response;
  try {
    r = await fetch("/api/knowledge-packs/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "네트워크 오류" };
  }

  let j: unknown;
  try {
    j = await r.json();
  } catch {
    return { ok: false, message: "응답 파싱 실패" };
  }

  const parsed = j as { ok?: boolean; recommendations?: KnowledgePackRecommendRow[]; message?: string };
  if (!parsed.ok || !Array.isArray(parsed.recommendations)) {
    return { ok: false, message: parsed.message ?? "추천 실패" };
  }
  return { ok: true, recommendations: parsed.recommendations };
}

export async function postKnowledgePackBuildPromptContext(input: Readonly<{
  knowledgePackIds: readonly string[];
  query: string;
  taskTitle?: string;
  taskDescription?: string;
  agentRole?: string;
  limit?: number;
}>): Promise<
  | { ok: true; contextText: string; diagnostics: string[] }
  | { ok: false; message: string }
> {
  let r: Response;
  try {
    r = await fetch("/api/knowledge-packs/build-prompt-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knowledgePackIds: input.knowledgePackIds,
        query: input.query,
        taskTitle: input.taskTitle,
        taskDescription: input.taskDescription,
        agentRole: input.agentRole ?? "AI_DEVELOPER",
        limit: input.limit ?? 5,
      }),
    });
  } catch {
    return { ok: false, message: "네트워크 오류" };
  }

  let j: unknown;
  try {
    j = await r.json();
  } catch {
    return { ok: false, message: "응답 파싱 실패" };
  }

  const parsed = j as { ok?: boolean; contextText?: string; diagnostics?: string[]; message?: string };
  if (!parsed.ok || typeof parsed.contextText !== "string") {
    return { ok: false, message: parsed.message ?? "컨텍스트 생성 실패" };
  }
  return {
    ok: true,
    contextText: parsed.contextText,
    diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics.map(String) : [],
  };
}
