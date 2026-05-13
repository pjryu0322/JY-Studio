/**
 * Overlay Architecture — 계약 타입·어휘 재export.
 * Stage1/2·Cursor·GitHub 자동화 경로는 이 모듈을 **필수 import 하지 않는다** (overlay는 점진 주입).
 */
export type { MemoryScope } from "@/lib/overlay/memoryScopeContract";
export type {
  AiIdentityContract,
  OverlayAiCapabilityId,
  OverlayAiPerspectiveId,
  OverlayKnowledgeScopeId,
} from "@/lib/overlay/aiIdentityContract";
export type {
  PromptAssemblyMemoryRef,
  PromptAssemblyMetadataContract,
} from "@/lib/overlay/contextAssemblyContract";
export { emptyPromptAssemblyMetadata } from "@/lib/overlay/contextAssemblyContract";
export type {
  ActiveKnowledgePackActivationStatus,
  ActiveKnowledgePackRef,
} from "@/lib/overlay/activeKnowledgePackRef";
