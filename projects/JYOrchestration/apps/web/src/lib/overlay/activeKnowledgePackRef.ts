/**
 * Overlay Architecture — 런타임에 “활성화된 지식팩”을 표현하는 참조.
 * DB 스키마 변경 없이 추천·병합·주입 경로의 메타데이터에 붙일 수 있다.
 */
export type ActiveKnowledgePackActivationStatus = "proposed" | "selected" | "merged" | "skipped";

export type ActiveKnowledgePackRef = Readonly<{
  knowledgePackId: string;
  targetRoles: readonly string[];
  activationReason: string;
  priority: number;
  status: ActiveKnowledgePackActivationStatus;
}>;
