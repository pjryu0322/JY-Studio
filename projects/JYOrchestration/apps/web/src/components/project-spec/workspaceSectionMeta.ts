/**
 * Workspace UI — F-1-3-* 라벨 단일 출처.
 * `fullLabel`은 배지(LabelTag)에만 사용하고, `title`은 섹션 제목에만 사용합니다.
 */
export const WORKSPACE_SECTION_META = {
  workspaceRoot: {
    fullLabel: "[F-1-3] Workspace — Project Spec definition (AI-first)",
    title: "Project Spec 정의 워크스페이스",
  },
  projectContext: {
    fullLabel: "[F-1-3-1] Workspace — Project Context",
    title: "실행 계획 입력",
  },
  basicFields: {
    fullLabel: "[F-1-3-1a] Workspace — Basic Project Fields",
    title: "기본 입력",
  },
  draftActions: {
    fullLabel: "[F-1-3-1b] Workspace — AI Draft Actions",
    title: "AI 실행 계획 초안",
  },
  draftCandidates: {
    fullLabel: "[F-1-3-1c] Workspace — AI Draft Candidates",
    title: "문서 후보 비교 · 작업 편집기",
  },
  specFromSavedPlan: {
    fullLabel: "[F-1-3-2] Workspace — Project Spec from saved plan",
    title: "저장된 계획으로 Project Spec 생성",
  },
  aiResponsesCompare: {
    fullLabel: "[F-1-3-3] Workspace — AI responses & compare",
    title: "AI 응답",
  },
  confirmedSpecVersions: {
    fullLabel: "[F-1-3-4] Workspace — Confirmed spec & versions",
    title: "확정된 Project Spec",
  },
  taskDrafts: {
    fullLabel: "[F-1-3-5] Workspace — Task drafts (Spec-linked)",
    title: "실행 워크플로",
  },
  executionSetup: {
    fullLabel: "[F-1-3-6] Git 연동 — 실행 환경 설정",
    title: "실행 환경 설정",
  },
  gitIntegration: {
    fullLabel: "[P-6-4] Project — Git 저장소 연동",
    title: "Git 연동",
  },
} as const;

export type WorkspaceSectionKey = keyof typeof WORKSPACE_SECTION_META;
