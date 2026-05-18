import type { KnowledgePack, KnowledgePackSource, KnowledgePackSourceType } from "@/lib/knowledge-packs/types";

/** 참고 링크 라벨·URL로 원천자료 유형을 대략 분류한다 (RAG 전 단계). */
export function inferSourceTypeFromReference(label: string, url: string): KnowledgePackSourceType {
  const combined = `${label} ${url}`.toLowerCase();
  if (combined.includes("license")) return "LICENSE";
  if (combined.includes("api")) return "API_REFERENCE";
  if (combined.includes("github")) return "CODE_SAMPLE";
  if (combined.includes("docs") || combined.includes("document")) return "MANUAL";
  return "URL";
}

/** `references`를 `KnowledgePackSource` 후보 목록으로 변환한다. */
export function referencesToKnowledgePackSources(pack: KnowledgePack): readonly KnowledgePackSource[] {
  return pack.references.map((ref, idx) => ({
    id: `${pack.id}.source.${idx + 1}`,
    knowledgePackId: pack.id,
    sourceType: inferSourceTypeFromReference(ref.label, ref.url),
    title: ref.label,
    url: ref.url,
    isOfficial: true,
    ragEnabled: true,
  }));
}

/** 화면용: DB 등에서 `sources`가 있으면 사용, 없으면 references 기반 유도. */
export function resolveKnowledgePackSourcesForDisplay(pack: KnowledgePack): readonly KnowledgePackSource[] {
  if (pack.sources?.length) return pack.sources;
  return referencesToKnowledgePackSources(pack);
}
