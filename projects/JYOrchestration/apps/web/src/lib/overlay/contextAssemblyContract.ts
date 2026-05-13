import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";

/**
 * Overlay Architecture — 프롬프트 조립 추적용 메타데이터 계약.
 * 기존 `build*` / `postOpenAiChatCompletion` 호출을 바꾸지 않고, 상위에서 **선택적으로** 채울 수 있다.
 */
export type PromptAssemblyMemoryRef = Readonly<{
  scope: MemoryScope;
  /** 예: projectId, slot key, roomId, storage key 등 — 형식 고정 없음 */
  ref: string;
}>;

export type PromptAssemblyMetadataContract = Readonly<{
  usedRole?: string | null;
  usedMemoryRefs: readonly PromptAssemblyMemoryRef[];
  usedKnowledgePacks: readonly string[];
  usedStage?: string | null;
  tokenBudgetHint?: string | null;
}>;

/** 빈 계약 객체를 만들 때 사용 (스프레드·patch 용). */
export function emptyPromptAssemblyMetadata(): PromptAssemblyMetadataContract {
  return {
    usedRole: null,
    usedMemoryRefs: [],
    usedKnowledgePacks: [],
    usedStage: null,
    tokenBudgetHint: null,
  };
}
