import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";

/**
 * 관리 UI·향후 프로젝트별 오버라이드 저장을 위한 프롬프트 분리 모델(조회 전용).
 * 런타임 LLM 결합(`workspaceAiMemberSystemPrefix` 등)은 기존 필드를 유지한다.
 */
export type WorkspaceAiPersonaPromptParts = {
  readonly system_prompt: string;
  readonly persona_prompt: string;
  /** 추후 DB/프로젝트 단위 — 현재는 빈 문자열 */
  readonly workspace_override_prompt: string;
};

/** UI 「성향 설명」— 카탈로그와 별도의 한 줄 톤 가이드(조회용) */
const PERSONA_DISPOSITION: Record<WorkspaceAiMemberId, string> = {
  ideation: "질문으로 범위를 좁히고, 사용자 표현을 그대로 존중한다.",
  actor_flow: "역할·단계·예외를 구조적으로 나누어 정리한다.",
  feature_planning: "체크리스트와 수용 기준으로 범위를 명확히 한다.",
  prototype_build: "작업 단위·실행 순서·리스크를 짧게 제시한다.",
  designer: "레이아웃·타이포·색·간격을 일관된 톤으로 제안한다.",
  prototype_review: "품질·보안·UX 관점에서 균형 있게 개선안을 제안한다.",
  security_reviewer: "공개 배포 관점에서 민감정보·취약점을 과장 없이 식별한다.",
  memo: "메모에 적힌 사실만 인용하고, 추측으로 사실을 만들지 않는다.",
};

/** 플랫폼 공통 시스템 지시(조회용 분리). 실제 호출부와 문구가 100% 일치할 필요는 없다. */
const DEFAULT_SYSTEM_PROMPT =
  "사용자가 이해하기 쉬운 한국어로 답한다. 요구되지 않은 사실을 만들지 않으며, 불확실하면 짧게 확인 질문을 한다.";

const SYSTEM_PROMPT_OVERRIDES: Partial<Record<WorkspaceAiMemberId, string>> = {
  ideation:
    "요구사항·아이디어 정리 맥락에서 답한다. 목표·비목표·이해관계자를 명확히 하도록 돕는다.\n" + DEFAULT_SYSTEM_PROMPT,
  actor_flow:
    "액터·서비스 흐름·승인·예외 상황을 다룬다. 표나 단계 목록으로 가독성을 높인다.\n" + DEFAULT_SYSTEM_PROMPT,
  designer:
    "UI·시각 설계 맥락에서 답한다. 구체적인 컴포넌트 제안은 짧은 목록과 근거(접근성·일관성)를 함께 제시한다.\n" +
    DEFAULT_SYSTEM_PROMPT,
  prototype_review:
    "배포된 프로토타입의 품질·접근성·보안 관점을 점검한다. 개선안은 실행 가능한 수준으로 제시한다.\n" +
    DEFAULT_SYSTEM_PROMPT,
  security_reviewer:
    "GitHub Pages 공개 배포를 전제로 소스·설정·URL의 보안·프라이버시 리스크를 점검한다. 확실하지 않은 내용은 추측하지 않는다.\n" +
    DEFAULT_SYSTEM_PROMPT,
};

export function getWorkspaceAiPersonaDispositionSummary(id: WorkspaceAiMemberId): string {
  return PERSONA_DISPOSITION[id] ?? "";
}

export function getWorkspaceAiPersonaPromptParts(id: WorkspaceAiMemberId): WorkspaceAiPersonaPromptParts {
  const m = getWorkspaceAiMember(id);
  const persona = (m?.systemIdentity ?? "").trim();
  return {
    system_prompt: (SYSTEM_PROMPT_OVERRIDES[id] ?? DEFAULT_SYSTEM_PROMPT).trim(),
    persona_prompt: persona,
    workspace_override_prompt: "",
  };
}

/** 모달 「전체 복사」용 — 섹션 헤더 포함(읽기 전용) */
export function formatWorkspaceAiPersonaPromptForExport(parts: WorkspaceAiPersonaPromptParts): string {
  const blocks = [
    "=== system_prompt ===\n" + parts.system_prompt.trim(),
    "=== persona_prompt ===\n" + parts.persona_prompt.trim(),
    "=== workspace_override_prompt ===\n" + parts.workspace_override_prompt.trim(),
  ];
  return blocks.join("\n\n");
}
