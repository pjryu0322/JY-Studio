/**
 * Shared JSON schema instructions for service-flow analyze (parser-aligned).
 */

export function buildServiceFlowAnalyzeJsonSchemaPromptBlock(): string {
  return `[updatedFlow JSON Schema — 반드시 준수]
updatedFlow는 아래 구조를 반드시 따른다.

{
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "actors": [
    {
      "id": "actor_user",
      "name": "사용자",
      "kind": "human",
      "description": "서비스에서 수행하는 책임"
    }
  ],
  "steps": [
    {
      "id": "step_upload",
      "title": "녹취 파일 업로드",
      "purpose": "사용자가 회의 녹취 파일을 등록하고 변환을 시작한다.",
      "order": 1,
      "primaryActorId": "actor_user",
      "secondaryActorIds": ["actor_system"],
      "approved": false,
      "updatedAt": "ISO string"
    }
  ]
}

필수:
- actors는 id/name/kind/description을 가진다.
- kind는 "human" 또는 "system"만 사용한다.
- steps는 id/title/purpose/order/primaryActorId/secondaryActorIds/approved/updatedAt을 가진다.
- step.purpose 필드를 사용한다. step.description을 쓰지 않는다.
- primaryActorId는 actors[].id 중 하나여야 한다.
- flow_draft / flow_step_definition / advice_to_flow_apply에서는 steps를 최소 3개 이상 생성한다.
- actor_definition에서는 steps가 비어 있어도 되지만 actors는 최소 2개 이상 생성한다.
- assistantMessage에 표시한 액터명과 단계 제목은 updatedFlow와 일치해야 한다.`;
}
