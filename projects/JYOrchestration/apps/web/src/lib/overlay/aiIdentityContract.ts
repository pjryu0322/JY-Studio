import type { MemoryScope } from "@/lib/overlay/memoryScopeContract";

/**
 * Overlay Architecture — AI Identity 계약 (역할 기반 주체 정의).
 *
 * - 기존 `ProjectMember`, `platformAiMembers`, `aiOrchestrationRole` 문자열을 **대체하지 않음**.
 * - 신규 UI·정책·메타데이터에서 “정체성 축”을 맞출 때 사용하는 **어휘·타입**이다.
 *
 * **Cursor 실행 기본 정책(문서·계약)**  
 * 코드 실행(Code Agent) 경로는 **구현 주체가 명시된 역할**(예: 플랫폼의 `prototype_build` = Cursor,
 * ENV_TEST Stage2의 executor)에 한정하는 것이 기본 방침이다. 일반 LLM 채팅 멤버만으로 Cursor 실행을
 * 열어두지 않는다. (기존 초대·DB 필드 동작은 변경하지 않음 — 향후 가드 추가 시 이 계약을 참조.)
 */
export type OverlayAiPerspectiveId =
  | "planning"
  | "analysis"
  | "architecture"
  | "design"
  | "implementation"
  | "review"
  | "security"
  | "governance";

export type OverlayAiCapabilityId =
  | "llm_chat"
  | "llm_json_object"
  | "slot_orchestration"
  | "code_agent_cursor"
  | "knowledge_retrieval"
  | "prompt_audit";

export type OverlayKnowledgeScopeId =
  | "platform_catalog"
  | "user_pack"
  | "project_pack"
  | "runtime_recommendation";

export type AiIdentityContract = Readonly<{
  /** 안정 키 (카탈로그 id, orchestration role 문자열 등 기존 식별자와 매핑) */
  roleKey: string;
  perspective: OverlayAiPerspectiveId;
  capabilities: readonly OverlayAiCapabilityId[];
  /** 실행/연동 주체 */
  provider: "openai" | "cursor" | "internal" | "unknown";
  /** 이 정체가 읽거나 쓰는 기억 범위(의미상) */
  memoryScopes: readonly MemoryScope[];
  knowledgeScopes: readonly OverlayKnowledgeScopeId[];
}>;
