/**
 * Overlay Architecture — Memory Scope 계약 (의미 레이어).
 * DB·저장소 스키마를 바꾸지 않고, 기존 persistence에 부여하는 **해석**이다.
 *
 * | 저장/표현 | Overlay 의미 |
 * |-----------|----------------|
 * | `Project.requirementsStateJson` (singleChat 등) | project |
 * | `ChatMessage` 등 대화 로그 | conversation record → session 인접 |
 * | `MessengerPromptTimelineLog` | prompt audit (감사) |
 * | `localStorage` / `sessionStorage` (프로토타입·biz exec 등) | working |
 *
 * `platform` / `role` 은 향후 정책·RBAC·플랫폼 시드와 매핑할 때 사용.
 */
export type MemoryScope = "platform" | "project" | "role" | "session" | "working";
