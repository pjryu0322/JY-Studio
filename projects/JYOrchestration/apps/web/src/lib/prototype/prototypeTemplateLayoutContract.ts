import { PROTOTYPE_TEMPLATES, type PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";

/**
 * JY Orchestration 템플릿 미리보기와 동일한 **정보 구조**를 Cursor/플래너에 강제하기 위한 계약 문구.
 * (스타일·색은 프로젝트에 맞게 달라져도 되지만, 패널 역할·기본 한글 제목은 유지)
 */
export function formatPrototypeTemplateLayoutContract(selectedTemplate: string): string {
  const raw = String(selectedTemplate ?? "").trim();
  const id = raw as PrototypeTemplateType;
  if (id === "meeting-workspace") return MEETING_WORKSPACE_CONTRACT;

  const t = PROTOTYPE_TEMPLATES.find((x) => x.id === raw);
  if (!t) {
    return raw
      ? `알 수 없는 템플릿 id: ${raw}. 가능한 경우 dashboard 레이아웃에 가깝게 구성하세요.`
      : "템플릿이 지정되지 않았습니다.";
  }

  return [
    `템플릿: ${t.nameKo} (${t.nameEn})`,
    `의도: ${t.description}`,
    "유지할 정보 구조:",
    `- 내비게이션·상단 메뉴 또는 큰 구역으로 다음 라벨을 반영: ${t.navigationItems.join(" · ")}`,
    `- 요약/지표 카드 영역 테마: ${t.summaryCards.join(" · ")}`,
    `- 본문 주 영역: ${t.primarySections.join(" · ")}`,
    "- 데스크톱에서 위 영역이 한눈에 구분되게. 모바일에서는 접기/드로어로 재배치 가능.",
    "- 한글 라벨 우선. 목 데이터만.",
  ].join("\n");
}

const MEETING_WORKSPACE_CONTRACT = `
회의 분석 워크스페이스(meeting-workspace) — JY Orchestration **템플릿 미리보기와 동일한 IA**를 유지합니다.

전체: 반응형 3열 SaaS. 데스크톱에서 그리드 비율은 대략 1 : 1.5 : 1 (좌 · 중 · 우).

좌열 패널 (하나의 세로 스택):
- 첫 블록 제목은 정확히 **「회의 파일」**: 파일명, 재생 길이, 상태 칩(완료/변환 중/대기 등) 목록.
- 구분선 아래 두 번째 블록 제목은 **「참여자」**: 참여자/화자 칩.
- 좌열에 **세로 7단계 작업 체크리스트(작업 상태 목록)** 를 두지 마세요. 미리보기에 없습니다. 단계 진행은 (1) 프레임 헤더의 작은 칩들 또는 (2) 우열 하단의 가로 타임라인 스트립으로만 표현합니다.

중앙 패널:
- 패널 제목은 **「작업 공간」**.
- 상단에 선택된 파일을 나타내는 짧은 안내 칩(예: "선택됨: …") 가능.
- 본문: 스크롤 가능한 대화/타임라인. 역할 라벨(예: 어시스턴트/사용자) + 말풍선. STT·변환 진행률 등은 이 영역 안의 메시지로 표현.
- 하단 고정 입력줄: **+** 버튼, 플레이스홀더 입력, **「전송」** 버튼. (+ 클릭 시 "작업 추가" 모달에 "녹취파일 업로드"·"회의록 보기" 등 선택지를 두는 패턴이 미리보기와 맞습니다.)

우열 패널:
- 패널 제목은 **「결과 패널」**.
- 상단 탭 두 개: **「요약본」** | **「스크립트」**.
- 요약본 탭: 섹션 제목을 정확히 **「핵심 안건」**, **「결정사항」**, **「할 일」** 세 카드(각 불릿 목록).
- 스크립트 탭: 상단 소제목 **「스크립트(화자별 예시)」** 아래 화자명 + 말풍선 블록.
- 탭 본문 아래(패널 하단): **「초안 생성 타임라인」** 가로 스트립 — "업로드 → STT → 화자 → 초안" 형태와 한 줄 상태(예: STT 63% · 화자 분리 대기).

프레임 상단 헤더(카드 제목 아래 우측 등): 변환 단계를 작은 칩으로 — 예: "변환", "STT 진행", "화자 대기", "초안 대기" (문구는 프로젝트에 맞게 다듬되 **칩 형태** 유지).

백엔드 없음, 정적 목 데이터, 한글 UI.
`.trim();
