import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";

export function formatTemplateLayoutSnippetForRole(input: {
  readonly roleKind: CodeTaskRoleKind;
  readonly templateId?: string;
}): string | null {
  const isMeeting = input.templateId === "meeting-workspace" || !input.templateId;

  switch (input.roleKind) {
    case "app_shell":
      if (!isMeeting) return "선택된 템플릿의 전체 IA·레이아웃·주요 구역 구조를 유지한다.";
      return [
        "전체 IA/레이아웃: 반응형 3열(좌·중·우) 워크스페이스.",
        "좌열 「회의 파일」·「참여자」, 중앙 「작업 공간」, 우열 「결과 패널」.",
        "프레임 상단 변환 단계 칩, 우열 하단 「초안 생성 타임라인」.",
      ].join("\n");
    case "screen_admin":
      return "관련 템플릿 영역: 설정·관리·상태 확인이 필요한 보조 영역.";
    case "screen_input":
    case "feature_input":
      return [
        "- 좌열 「회의 파일」 블록",
        "- 중앙 「작업 공간」 하단 입력줄",
        "- + 버튼 작업 추가 흐름",
      ].join("\n");
    case "screen_result":
    case "feature_result":
      return [
        "- 우열 「결과 패널」",
        "- 「요약본」/「스크립트」 탭",
        "- 「핵심 안건」, 「결정사항」, 「할 일」 카드",
        "- 「초안 생성 타임라인」",
      ].join("\n");
    case "feature_start":
      return [
        "- 좌열 「회의 파일」 선택/업로드",
        "- 중앙 「작업 공간」 시작 진입",
        "- 프레임 상단 변환 단계 칩",
      ].join("\n");
    case "feature_processing":
    case "common_loading":
      return [
        "- 중앙 작업 공간 내 STT/변환 진행 메시지",
        "- 프레임 상단 변환 단계 칩",
        "- 우열 하단 초안 생성 타임라인 상태",
      ].join("\n");
    case "common_error":
    case "common_empty":
    case "common_retry":
    case "common_permission":
    case "common_draft":
      return [
        "- 중앙 작업 공간 상태 메시지 영역",
        "- 결과 패널 상태 영역",
        "- 상태별 액션 버튼 영역",
      ].join("\n");
    default:
      return null;
  }
}
