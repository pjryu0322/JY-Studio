import { stripKnowledgePackContextMarkdownWrapper } from "@/lib/knowledge-packs/knowledgePackPromptContextBuilder";

export type PrototypePreviewIdeationSlice = Readonly<{ title?: string | null; content?: string | null }>;
export type PrototypePreviewFlowSlice = Readonly<{ title: string; purpose?: string | null }>;

const QUERY_BLOB_MAX = 12_000;

/**
 * 프로토타입 미리보기 패널에서 지식팩 추천·RAG 쿼리에 쓰는 단일 텍스트 블롭.
 */
export function buildPrototypeKnowledgePackQueryBlob(input: Readonly<{
  projectName: string;
  projectDescription: string;
  ideationAssets: readonly PrototypePreviewIdeationSlice[];
  flowSteps: readonly PrototypePreviewFlowSlice[];
  featureDraftTitles?: readonly string[] | null;
}>): string {
  const ideation = input.ideationAssets
    .map((a) => `${String(a.title ?? "").trim()}: ${String(a.content ?? "").trim()}`.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, QUERY_BLOB_MAX);
  const flow = input.flowSteps.map((s) => `${s.title}: ${String(s.purpose ?? "").trim()}`).join("\n");
  const feats = (input.featureDraftTitles ?? []).map((x) => String(x ?? "").trim()).filter(Boolean).join(", ");
  return [input.projectName.trim(), input.projectDescription.trim(), ideation, flow, feats]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, QUERY_BLOB_MAX);
}

type RecommendRow = Readonly<{ knowledgePackId: string; score: number }>;

function parseRecommendRows(j: unknown): RecommendRow[] | null {
  if (!j || typeof j !== "object") return null;
  const o = j as { ok?: unknown; recommendations?: unknown };
  if (o.ok !== true || !Array.isArray(o.recommendations)) return null;
  const out: RecommendRow[] = [];
  for (const r of o.recommendations) {
    if (!r || typeof r !== "object") continue;
    const row = r as { knowledgePackId?: unknown; score?: unknown };
    const id = String(row.knowledgePackId ?? "").trim();
    if (!id) continue;
    out.push({ knowledgePackId: id, score: Number(row.score) });
  }
  return out;
}

/**
 * 브라우저에서 recommend → build-prompt-context(병합)까지 수행해, 프로토타입 프롬프트 빌더용 inner Markdown을 돌려준다.
 */
export async function fetchPrototypePreviewKnowledgePackInnerMarkdown(
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  input: Readonly<{
    projectId: string;
    queryBlob: string;
    recommendLimit?: number;
    topPickCount?: number;
  }>,
): Promise<string | undefined> {
  const queryBlob = input.queryBlob.trim();
  if (!queryBlob) return undefined;

  const recRes = await fetchImpl("/api/knowledge-packs/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId.trim(),
      text: queryBlob,
      agentRole: "AI_DEVELOPER",
      limit: input.recommendLimit ?? 6,
    }),
  });
  const recJ: unknown = await recRes.json();
  const rows = parseRecommendRows(recJ);
  if (!rows?.length) return undefined;

  const topN = Math.max(1, Math.min(5, input.topPickCount ?? 3));
  const top = rows.filter((r) => Number(r.score) > 0).slice(0, topN).map((r) => r.knowledgePackId);
  if (!top.length) return undefined;

  const ctxRes = await fetchImpl("/api/knowledge-packs/build-prompt-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      knowledgePackIds: top,
      query: queryBlob.slice(0, 4000),
      agentRole: "AI_DEVELOPER",
      limit: 5,
    }),
  });
  const ctxJ = (await ctxRes.json()) as { ok?: boolean; contextText?: string };
  if (ctxJ?.ok !== true || typeof ctxJ.contextText !== "string" || !ctxJ.contextText.trim()) {
    return undefined;
  }
  return stripKnowledgePackContextMarkdownWrapper(ctxJ.contextText).trim() || undefined;
}
