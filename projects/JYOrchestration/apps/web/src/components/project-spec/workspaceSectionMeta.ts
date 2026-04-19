/**
 * Workspace UI — F-1-3-* 라벨 단일 출처.
 * `fullLabel`은 배지(LabelTag)에만 사용하고, `title`은 섹션 제목에만 사용합니다.
 */
export const WORKSPACE_SECTION_META = {
  workspaceRoot: {
    fullLabel: "[F-1-3] Workspace — execution planning (AI-assisted)",
    title: "생성 준비 워크스페이스",
  },
  projectContext: {
    fullLabel: "[F-1-3-1] Workspace — Project Context",
    title: "생성 준비 입력",
  },
  basicFields: {
    fullLabel: "[F-1-3-1a] Workspace — Basic Project Fields",
    title: "기본 입력",
  },
  draftActions: {
    fullLabel: "[F-1-3-1b] Workspace — AI Draft Actions",
    title: "AI 생성 준비 초안",
  },
  draftCandidates: {
    fullLabel: "[F-1-3-1c] Workspace — AI Draft Candidates",
    title: "문서 후보 비교 · 작업 편집기",
  },
  specFromSavedPlan: {
    fullLabel: "[F-1-3-2] Workspace — AI plan document from saved execution plan",
    title: "저장된 계획으로 준비 문서 생성",
  },
  aiResponsesCompare: {
    fullLabel: "[F-1-3-3] Workspace — AI responses & compare",
    title: "AI 응답",
  },
  confirmedSpecVersions: {
    fullLabel: "[F-1-3-4] Workspace — Confirmed execution plan versions",
    title: "확정된 준비 문서",
  },
  taskDrafts: {
    fullLabel: "[F-1-3-5] Workspace — Task drafts (plan-linked)",
    title: "작업 정리 · 실행 연결",
  },
  executionSetup: {
    fullLabel: "[F-1-3-6] 실행 환경 — 연결·정책·검증",
    title: "프로토타입 생성 환경 설정",
  },
  gitIntegration: {
    fullLabel: "[P-6-4] Project — 실행 환경",
    title: "프로토타입 생성 환경",
  },
} as const;

export type WorkspaceSectionKey = keyof typeof WORKSPACE_SECTION_META;
