export const KP_VIRTUAL_SOURCE_ID_PREFIX = "virtual_" as const;

/** 정적 지식팩 `references`를 목록 API에 합쳐 보여줄 때 쓰는 가상 원천 id. */
export function virtualKnowledgePackSourceId(knowledgePackId: string, index: number): string {
  return `${KP_VIRTUAL_SOURCE_ID_PREFIX}${knowledgePackId}_${index}`;
}

export function isVirtualKnowledgePackSourceId(sourceId: string): boolean {
  return sourceId.trim().startsWith(KP_VIRTUAL_SOURCE_ID_PREFIX);
}

export function parseKnowledgePackSourceRouteId(param: string): string {
  return decodeURIComponent(param).trim();
}
