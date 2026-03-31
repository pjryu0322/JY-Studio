/**
 * `project.taskGenerationPrompt`에 저장되는 단일 호출 Task 생성용 템플릿.
 * 플레이스홀더는 서버에서 치환된다.
 */

export const DEFAULT_TASK_GENERATION_PROMPT_TEMPLATE = `Project Spec을 모두 재분해하지 말고, **[O-5] Observability — Execution Metrics** 구현에 필요한 작업만 추출한다.

[프로젝트]

* 이름: {{projectName}}
* 유형: {{projectType}}
* 설명: {{projectDescription}}

## [Project Spec]

{{specMarkdown}}

[목표]

* 이번 출력은 **[O-5] Observability — Execution Metrics** 범위에 한정한다.
* 실행 관측 화면에서 필요한 기능 구현 Task만 우선순위대로 만든다.
* 전체 프로젝트의 모든 기능을 다시 분해하지 않는다.

[하드 규칙]

* **기능 요구사항(FR)만 tasks에 포함**
* 비기능(NFR: performance, security, availability, scalability, logging, monitoring, operational 등)은 tasks에 넣지 않는다
* O-5와 직접 관련 없는 기능은 제외한다
* 각 Task는 Cursor가 구현 가능한 실행 단위여야 한다
* Task는 우선순위가 높은 순서대로 정렬한다

[O-5 범위 예시]

* 실행 진행률 표시
* 현재 실행 중 Task 표시
* Task 상태 표시 (ready/running/done/failed)
* 실행 제어 버튼 (시작/일시정지/중단)
* 실행 로그/이력 표시
* 실행 관측 화면 API 연동
* 실시간 또는 polling 기반 상태 갱신

[출력 JSON]
{
"tasks": [
{
"title": "O-5 구현 Task",
"description": "무엇을 구현해야 하는지",
"executionKind": "api|ui|logic|data|test",
"priority": "HIGH|MEDIUM|LOW"
}
]
}

[출력 규칙]

* tasks만 출력
* JSON만 출력
* 마크다운/설명 문장 금지
* 우선순위 순으로 정렬
`;

export type TaskGenerationPromptTemplateVars = {
  projectName: string;
  projectDescription: string;
  projectType: string;
  specMarkdown: string;
};

export function applyTaskGenerationPromptTemplate(
  template: string,
  vars: TaskGenerationPromptTemplateVars
): string {
  return template
    .replaceAll("{{projectName}}", String(vars.projectName))
    .replaceAll("{{projectType}}", String(vars.projectType))
    .replaceAll("{{projectDescription}}", String(vars.projectDescription))
    .replaceAll("{{specMarkdown}}", String(vars.specMarkdown));
}
