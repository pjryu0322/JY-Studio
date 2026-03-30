/**
 * Task draft 생성 시 요구사항(FR) 추출 단계(OpenAI)에 사용되는 사용자 프롬프트 템플릿.
 *
 * 저장되는 `project.taskPrompt`는 이 템플릿 문자열(플레이스홀더 포함)이며,
 * 서버에서 아래 플레이스홀더를 실제 값으로 치환해 최종 userMessage를 만듭니다.
 */

export const DEFAULT_TASK_DRAFT_GENERATION_REQUIREMENTS_PROMPT_TEMPLATE = `Project Spec에서 요구사항을 추출한다. **반드시 기능(FR)과 비기능(NFR)을 분리**한다.

[프로젝트]
- 이름: {{projectName}}
- 유형: {{projectType}}
- 설명: {{projectDescription}}

[Project Spec]
---
{{specMarkdown}}
---

[하드 필터 — 위반 시 오답]
- **tasks** 배열: **기능 요구사항(FR)만**. Cursor가 코드로 구현·검증할 수 있는 사용자/업무 동작·기능·규칙만 넣는다.
- **다음은 절대 tasks에 넣지 말 것** (전부 nonFunctionalConstraints로만):
  - type이 NON_FUNCTIONAL인 항목, 또는 nfr/비기능으로 분류되는 모든 항목
  - 성능(performance)·보안 정책만·가용성·확장성·로깅·모니터링·운영/배포 제약만
  - SLA, RTO/RPO, 감사·컴플라이언스 문구만, 인프라 관측만

[출력 JSON — 키 이름 정확히]
{
  "tasks": [
    {
      "title": "기능 요구 한 덩어리(이후 파이프라인에서 레이어별 실행 Task로 쪼개짐)",
      "description": "무엇을 구현해야 하는지 (한 번에 하나의 사용자/업무 목표)",
      "input": "입력·전제·사용 데이터",
      "output": "산출·결과",
      "acceptanceCriteria": ["검증 가능한 문장"],
      "executionKind": "api|ui|logic|data|test",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ],
  "nonFunctionalConstraints": [
    {
      "title": "비기능 제약 제목 (NOT tasks)",
      "description": "내용",
      "nfrCategory": "performance|security|availability|scalability|logging|monitoring|operational|policy|quality"
    }
  ],
  "dag": []
}

dag는 요구 추출 단계에서는 빈 배열로 두거나 생략해도 된다(실행 DAG는 Feature별 생성 단계에서 만든다).

[분류 규칙]
- tasks와 nonFunctionalConstraints에 **동일 항목을 중복 넣지 말 것**.
- FR 한 건당 tasks에 한 객체. NFR 한 건당 nonFunctionalConstraints에 한 객체.
- tasks가 비면 안 됨(Spec에 구현 가능한 기능이 없으면 최소한 핵심 사용자 시나리오 1건을 FR로 재해석).
- 반환 전 검증: tasks의 어떤 항목도 비기능 전용이 아닌지 스스로 확인.
- JSON만 출력. 마크다운·설명 문장 금지.

[하위 호환] 동일 구조를 "functionalRequirements" + "nonFunctionalConstraints" 로만 출력해도 된다 (tasks 대신 functionalRequirements 배열 사용 가능).`;

export type TaskDraftPromptTemplateVars = {
  projectName: string;
  projectDescription: string;
  projectType: string;
  specMarkdown: string;
};

export function applyTaskDraftGenerationPromptTemplate(
  template: string,
  vars: TaskDraftPromptTemplateVars
): string {
  return template
    .replaceAll("{{projectName}}", String(vars.projectName))
    .replaceAll("{{projectType}}", String(vars.projectType))
    .replaceAll("{{projectDescription}}", String(vars.projectDescription))
    .replaceAll("{{specMarkdown}}", String(vars.specMarkdown));
}

