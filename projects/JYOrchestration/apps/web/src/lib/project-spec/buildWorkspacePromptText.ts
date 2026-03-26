import type { Project } from "@/components/project-spec/types";

/**
 * 워크스페이스에 표시·저장되는 "생성된 프롬프트" 본문.
 * 프로젝트 메타 + Spec 정의 필드를 반영한다 (lifecycle status 미포함).
 */
export function buildWorkspacePromptText(project: Project): string {
  const core = project.specCoreGoals?.trim() || "미입력";
  const sin = project.specScopeIn?.trim() || "미입력";
  const sout = project.specScopeOut?.trim() || "미입력";
  const users = project.specTargetUsers?.trim() || "미입력";
  const success = project.specSuccessCriteria?.trim() || "미입력";

  return `너는 소프트웨어 아키텍트이자 요구사항 분석가다.
아래 프로젝트 정보를 기반으로 ProjectSpec 문서를 "마크다운 문서"로 작성하라.
불필요하게 장황한 설명은 제외하고, 구조화된 결과만 제공하라.

[프로젝트 정보]
- 프로젝트명: ${project.name}
- 설명: ${project.description || "설명 없음"}
- 유형: ${project.projectType}

[Spec 정의 입력]
- 핵심 목표: ${core}
- In scope: ${sin}
- Out of scope: ${sout}
- 대상 사용자: ${users}
- 성공 기준: ${success}

[출력 규칙]
- 반드시 마크다운 헤더/목록 구조로 작성
- 각 섹션은 실행 가능한 수준으로 구체적으로 작성
- 범위, 우선순위, 수용 기준은 누락 없이 작성

[필수 섹션]
1. 프로젝트 개요
2. 목표 및 범위 (In scope / Out of scope)
3. 사용자 및 핵심 유스케이스
4. 기능 요구사항 (우선순위 포함)
5. 비기능 요구사항 (성능, 보안, 운영)
6. 제약사항 및 가정
7. 성공 지표 및 수용 기준
8. 초기 마일스톤`;
}
