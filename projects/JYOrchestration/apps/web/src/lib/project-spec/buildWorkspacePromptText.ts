import type { Project } from "@/components/project-spec/types";

/** 모델별로 Spec 초안의 초점을 달리해 비교 가치를 높인다 */
function modelSpecLens(modelId: string | null | undefined): string {
  const m = (modelId ?? "").trim();
  if (m === "gpt-4o") {
    return "이번 호출 초점: API·데이터 모델·컴포넌트 경계·트랜잭션·장애·관측성을 구체적으로.";
  }
  if (m === "gpt-4.1") {
    return "이번 호출 초점: 사용자 가치·유스케이스 우선순위·릴리즈 순서·비기능이 사용자에게 미치는 영향.";
  }
  if (m === "gpt-4o-mini") {
    return "이번 호출 초점: MVP 경로·리스크·검증 순서를 간결·실행 중심으로.";
  }
  return "이번 호출 초점: 균형 잡힌 제품 수준 스펙.";
}

/**
 * DB에 저장된 실행 계획만을 본문 근거로 Project Spec 마크다운을 생성하도록 하는 사용자 메시지.
 * 클라이언트 임의 텍스트(prompt/content)는 사용하지 않는다.
 */
export function buildSpecPrompt(input: {
  title: string;
  description: string | null;
  planMarkdown: string;
  modelId?: string | null;
}): string {
  const plan = input.planMarkdown.trim();
  const lens = modelSpecLens(input.modelId);

  return `역할: 시니어 소프트웨어 아키텍트이자 요구사항 엔지니어.
아래 [저장된 실행 계획]만을 근거로 **실행 가능한 Project Spec**을 마크다운으로 작성하라. 서술형 에세이가 아니라 구현·검증·운영에 바로 쓰이는 구조화 문서여야 한다.

[프로젝트 기본]
- 제목: ${input.title.trim()}
- 설명: ${(input.description ?? "").trim() || "(없음)"}

[저장된 실행 계획 — 유일한 본문 입력]
${plan}

[생성 관점]
- ${lens}

[필수 마크다운 구조 — 헤더 제목은 한국어로 유지, 하위 형식은 반드시 준수]

## 1. Project Overview
(2~5문단, 배경·목적·성공 정의)

## 2. Scope
### In Scope
- (불릿, 구체적 산출물/기능 단위)

### Out of Scope
- (불릿, 명시적 제외)

## 3. Use Cases
| ID | Actor | Goal | Main flow |
|----|-------|------|-----------|
| UC-01 | ... | ... | ... |

## 4. Functional Requirements
각 항목은 표 또는 동일 정보를 담은 불릿 블록으로 작성:
| ID | Description | Priority (P0/P1/P2) | Dependency | Acceptance criteria |
|----|-------------|---------------------|------------|---------------------|
| FR-01 | ... | P0 | (선택) | (검증 가능한 문장) |

## 5. Non-Functional Requirements
### Performance
- (정량 목표 또는 측정 방법)

### Security
- (인증·권한·데이터 보호)

### Scalability
- (병목·확장 전략)

### Availability
- (SLO/복구)

### Logging / Audit
- (로그·감사 요건)

## 6. System Architecture
### Components
- (책임·경계)

### API
- (주요 엔드포인트/계약 수준)

### Storage
- (데이터 저장·보존)

### Client / Server
- (배포·통신)

## 7. Constraints & Assumptions
- (제약·가정·외부 의존)

[출력 규칙]
- 위 섹션 번호·이름을 그대로 사용할 것.
- 자유 텍스트 덩어리만 있는 답변 금지. 표·불릿·ID로 파싱 가능하게.
- 한국어. 마크다운 본문만. 전체를 코드펜스로 감싸지 말 것. 서론 한 줄 없이 본문부터.`;
}

/**
 * @throws Error EXECUTION_PLAN_REQUIRED when executionPlanMarkdown is empty
 */
export function buildWorkspacePromptText(project: Project, modelId?: string | null): string {
  const plan = project.executionPlanMarkdown?.trim();
  if (!plan) {
    throw new Error("EXECUTION_PLAN_REQUIRED");
  }
  return buildSpecPrompt({
    title: project.name,
    description: project.description ?? null,
    planMarkdown: plan,
    modelId,
  });
}
