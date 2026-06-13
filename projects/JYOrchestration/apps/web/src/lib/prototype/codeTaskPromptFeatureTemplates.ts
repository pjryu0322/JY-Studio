import type { CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";

export type CodeTaskFeaturePromptKind =
  | "loading_state"
  | "error_message"
  | "empty_state"
  | "retry"
  | "permission_denied"
  | "draft_save"
  | "screen_input"
  | "screen_result"
  | "screen_admin"
  | "feature_start"
  | "feature_input"
  | "feature_processing"
  | "feature_result"
  | "screen"
  | "app_shell"
  | "api"
  | "mock_data"
  | "preview_ux_wiring"
  | "generic_component";

export function featurePromptKindFromRoleKind(
  roleKind: CodeTaskRoleKind,
): CodeTaskFeaturePromptKind | null {
  const map: Partial<Record<CodeTaskRoleKind, CodeTaskFeaturePromptKind>> = {
    screen_input: "screen_input",
    screen_result: "screen_result",
    screen_admin: "screen_admin",
    feature_start: "feature_start",
    feature_input: "feature_input",
    feature_processing: "feature_processing",
    feature_result: "feature_result",
    common_loading: "loading_state",
    common_error: "error_message",
    common_empty: "empty_state",
    common_retry: "retry",
    common_permission: "permission_denied",
    common_draft: "draft_save",
    mock_data: "mock_data",
    app_shell: "app_shell",
  };
  return map[roleKind] ?? null;
}

export type CodeTaskFeaturePromptTemplate = Readonly<{
  readonly kind: CodeTaskFeaturePromptKind;
  readonly implementationGoal: readonly string[];
  readonly implementationRequirements: readonly string[];
  readonly verificationChecklist: readonly string[];
}>;

function haystack(input: {
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly string[];
}): string {
  return [input.title, input.description, ...input.requirements].join(" ").toLowerCase();
}

export function matchCodeTaskFeaturePromptKind(input: {
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly changeType: string;
  readonly parentTitle?: string;
}): CodeTaskFeaturePromptKind {
  const text = haystack({
    title: [input.title, input.parentTitle ?? ""].join(" "),
    description: input.description,
    requirements: input.requirements,
  });
  if (/입력\s*화면/i.test(text)) return "screen_input";
  if (/결과\s*화면/i.test(text)) return "screen_result";
  if (/관리\s*화면/i.test(text)) return "screen_admin";
  if (/시작\s*기능|^시작\b|분석\s*시작\s*기능/i.test(text)) return "feature_start";
  if (/업무\s*입력/i.test(text)) return "feature_input";
  if (/처리\s*중/i.test(text)) return "feature_processing";
  if (/결과\s*확인/i.test(text)) return "feature_result";
  if (/로딩|loading|스피너|skeleton/i.test(text)) return "loading_state";
  if (/재시도|retry/i.test(text)) return "retry";
  if (/오류|error|에러|실패.*메시지|오류\s*메시지/i.test(text)) return "error_message";
  if (/빈\s*결과|empty|no\s*result|결과\s*없/i.test(text)) return "empty_state";
  if (/권한|permission|access\s*denied|접근\s*제한/i.test(text)) return "permission_denied";
  if (/임시\s*저장|draft|autosave|자동\s*저장/i.test(text)) return "draft_save";
  if (input.changeType === "api" || /api|endpoint|route/i.test(text)) return "api";
  if (/샘플\s*데이터|예시\s*데이터|sample\s*data|mock\s*데이터|mock\s*data\s*구조|데이터\/mock|fixture\s*helper/i.test(text)) {
    return "mock_data";
  }
  if (input.changeType === "screen" || /화면\s*구현|화면/i.test(text)) return "screen";
  return "generic_component";
}

function matchKind(input: {
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly changeType: string;
}): CodeTaskFeaturePromptKind {
  return matchCodeTaskFeaturePromptKind(input);
}

const TEMPLATES: Record<CodeTaskFeaturePromptKind, Omit<CodeTaskFeaturePromptTemplate, "kind">> = {
  loading_state: {
    implementationGoal: [
      "데이터 로딩 또는 비동기 처리 중 사용자에게 명확한 진행 상태를 표시한다.",
    ],
    implementationRequirements: [
      "LoadingState, Spinner, Skeleton 또는 유사 컴포넌트 구현",
      "loading flag 기반 표시/숨김 처리",
      "정상 완료 후 로딩 상태가 사라지도록 props로 표현",
      "접근성: aria-busy 또는 status role 검토",
    ],
    verificationChecklist: [
      "loading prop 또는 상태 값에 따라 로딩 UI와 완료 상태 UI를 구분해 렌더링할 수 있다.",
      "실제 화면 연결은 integration Task에서 수행한다.",
    ],
  },
  error_message: {
    implementationGoal: [
      "API 실패, 폼 검증 실패, 데이터 로딩 실패 등에서 재사용 가능한 오류 메시지 UI를 구현한다.",
    ],
    implementationRequirements: [
      "ErrorMessage 또는 ErrorState 공통 컴포넌트 구현",
      "message, description, variant, retry action 지원",
      "role=\"alert\" 또는 aria-live 적용",
      "정상/오류/재시도 흐름을 props로 구분",
    ],
    verificationChecklist: [
      "message, description, variant, retry action prop에 따라 오류 안내와 재시도 액션을 렌더링할 수 있다.",
      "실제 화면 연결은 integration Task에서 수행한다.",
    ],
  },
  empty_state: {
    implementationGoal: [
      "데이터가 없거나 검색 결과가 없을 때 사용자에게 명확한 안내와 다음 행동을 제공한다.",
    ],
    implementationRequirements: [
      "EmptyState 또는 NoResultState 공통 컴포넌트 구현",
      "title, description, optional action 지원",
      "오류 상태와 빈 상태가 props로 구분되어야 함",
    ],
    verificationChecklist: [
      "title, description, optional action prop에 따라 빈 결과 안내를 렌더링할 수 있다.",
      "데이터 존재 여부 판단과 실제 화면 연결은 integration Task에서 수행한다.",
    ],
  },
  retry: {
    implementationGoal: [
      "실패한 작업을 사용자가 다시 실행할 수 있는 공통 재시도 UI/상태 흐름을 구현한다.",
    ],
    implementationRequirements: [
      "RetryButton, RetryAction 또는 유사 공통 컴포넌트 구현",
      "onRetry handler 지원",
      "재시도 중 중복 클릭 방지",
      "retrying/loading 상태를 props로 표현",
      "오류 메시지 또는 로딩 실패 상태와 함께 재사용 가능한 구조",
    ],
    verificationChecklist: [
      "onRetry callback과 retrying/loading prop에 따라 재시도 UI를 렌더링할 수 있다.",
      "실제 화면 연결은 integration Task에서 수행한다.",
    ],
  },
  permission_denied: {
    implementationGoal: [
      "권한이 없거나 접근이 제한된 경우 사용자에게 명확한 안내를 제공한다.",
    ],
    implementationRequirements: [
      "PermissionDenied 또는 AccessDenied 공통 컴포넌트 구현",
      "안내 메시지, 설명, optional action 지원",
      "권한 조건을 props로 표현 가능한 구조",
    ],
    verificationChecklist: [
      "권한 없음 안내 메시지, 설명, optional action prop을 렌더링할 수 있다.",
      "권한 조건 판단과 실제 화면 연결은 integration Task에서 수행한다.",
    ],
  },
  draft_save: {
    implementationGoal: [
      "사용자가 입력/작성 중인 내용을 잃지 않도록 임시 저장 상태 흐름을 구현한다.",
    ],
    implementationRequirements: [
      "draft state 또는 temporary save helper 구현",
      "저장 중/saved/error 상태를 props로 구분",
      "사용자에게 저장 상태를 표현할 수 있는 구조",
      "브라우저 저장소 사용 시 key scope를 명확히 함",
    ],
    verificationChecklist: [
      "저장 중/saved/error prop에 따라 임시 저장 상태 UI를 렌더링할 수 있다.",
      "실제 화면 연결은 integration Task에서 수행한다.",
    ],
  },
  api: {
    implementationGoal: ["대상 기능을 위한 API 또는 client service 연동을 구현한다."],
    implementationRequirements: [
      "API route, client service, request/response type 중 필요한 부분 구현",
      "오류 처리와 loading 상태 연결",
      "기존 화면/상태 흐름과 연동",
      "입력 검증 또는 기본 guard 추가",
    ],
    verificationChecklist: [
      "정상 요청/응답 확인",
      "실패 응답 처리 확인",
      "연동 화면 회귀 없음 확인",
    ],
  },
  preview_ux_wiring: {
    implementationGoal: [
      "actual Preview가 실제 회의 분석 워크스페이스 첫 사용 화면처럼 보이도록 UX를 마감한다.",
      "src/data/sampleData.ts를 좌/중/우 패널에 자연스럽게 연결한다.",
    ],
    implementationRequirements: [
      "Preview에서 placeholder-only 화면을 기본값으로 두지 않는다.",
      "샘플데이터가 있으면 실제 서비스 초기 화면처럼 렌더링한다.",
      "placeholder-only 문구를 제거한다.",
      "좌측: 회의 파일 카드(파일명·길이·상태), 참여자 카드(이름·역할)를 분리해 표시한다. 파일명과 참여자가 동일하게 보이지 않게 한다.",
      "중앙: 처리 단계(업로드/STT/화자분리/초안) 상태와 transcript 대화 로그(시간·화자·발화)를 카드/타임라인 형태로 표시한다. bullet만 길게 나열하지 않는다.",
      "우측: 요약·핵심 성과·결정·할 일·초안 타임라인 섹션 제목과 여백을 정리한다. 빈 배열은 빈 bullet 대신 안내 문구를 쓴다.",
      "상단 액션 버튼은 현재 샘플 데이터 상태와 어울리게(예: 업로드 완료, STT 변환 완료) 표현한다.",
      "패널 간 여백, 제목, 상태 뱃지, 카드 구성을 적용한다.",
      "샘플데이터 연결은 화면 Task 또는 wiring CodeTask(CODE-WIRING-PREVIEW-001)에서 구현한다. 플랫폼 Runtime regex 패치에 의존하지 않는다.",
      "App Shell·WorkspaceShell 구조를 재작성하지 않는다.",
      "data provider 구조를 유지해 이후 API 연동으로 교체 가능하게 한다.",
    ],
    verificationChecklist: [
      "placeholder 문구가 기본 화면에 남지 않는다.",
      "빈 bullet·[]·undefined·null·중복 파일명 표시가 없다.",
      "좌/중/우 패널 역할이 명확하다.",
      "좁은 화면에서 가로 겹침이 없다.",
      "build/lint 통과",
    ],
  },
  mock_data: {
    implementationGoal: [
      "Preview와 후속 Integration을 위한 중앙 샘플 데이터·타입 파일을 생성한다.",
      "회의 파일, 참여자, 스크립트, 요약, 결정사항, 할 일, 초안 타임라인 샘플을 준비한다.",
    ],
    implementationRequirements: [
      "src/types/meeting.ts에 MeetingFile, Participant, TranscriptSegment, MeetingSummary, MeetingDecision, MeetingActionItem, DraftTimelineEvent 타입을 정의한다.",
      "src/data/sampleData.ts에 sampleMeetingFiles, sampleParticipants, sampleTranscriptSegments, sampleMeetingSummary, sampleDecisions, sampleActionItems, sampleDraftTimeline을 export한다.",
      "sampleData.ts의 meeting 타입 import는 반드시 `from '../types/meeting'`(= src/types/meeting.ts)만 사용한다. src/data/types/meeting.ts 등 다른 경로에 타입 파일을 두지 않는다.",
      "이번 CodeTask에서는 src/data/sampleData.ts와 src/types/meeting.ts만 생성·보완한다. WorkspaceShell·LeftPanel·CenterPanel·RightPanel·common 컴포넌트는 수정하지 않는다.",
      "Preview 화면 연결은 이번 Task에서 직접 수정하지 않는다. 패널 연결이 필요하면 작업 결과 보고의 requiresIntegrationChange에 연결 파일, 사유, 예상 연결 위치를 기록한다.",
      "패널별 mock 중복이 발견되면 직접 수정하지 말고 requiresIntegrationChange에 기록한다.",
      "실제 API 연동으로 교체 가능한 구조를 유지한다.",
      "Preview 실사용감을 위해 참여자 name·role, 스크립트 timestamp, 요약 overview·highlights를 빈 값 없이 채운다.",
    ],
    verificationChecklist: [
      "src/types/meeting.ts가 존재하는지 확인",
      "src/data/sampleData.ts가 존재하는지 확인",
      "sampleMeetingFiles export 존재 확인",
      "sampleParticipants export 존재 확인",
      "sampleTranscriptSegments export 존재 확인",
      "sampleMeetingSummary export 존재 확인",
      "sampleDecisions export 존재 확인",
      "sampleActionItems export 존재 확인",
      "sampleDraftTimeline export 존재 확인",
      "TypeScript import/export 오류 없음 확인",
      "패널 연결이 필요한 경우 requiresIntegrationChange에 기록했는지 확인",
    ],
  },
  feature_start: {
    implementationGoal: [
      "사용자가 회의 분석 작업을 시작하는 진입 액션과 상태 전환을 제공한다.",
    ],
    implementationRequirements: [
      "시작/분석 실행 액션을 props/callback 기반 flow API 또는 컴포넌트로 제공한다.",
      "입력 준비 상태에서 처리 중 상태로 전환될 수 있는 상태 모델을 제공한다.",
      "파일 미선택/입력 부족 등 예외 상태를 props로 표현한다.",
    ],
    verificationChecklist: [
      "시작 액션을 표현할 수 있는 flow API 또는 컴포넌트가 독립적으로 import/export 가능하다.",
      "시작 요청, 입력 부족, 업로드 전환 상태를 props/callback 기반으로 표현할 수 있다.",
    ],
  },
  feature_input: {
    implementationGoal: ["회의 분석에 필요한 입력 정보를 수집하고 작업 공간 상태와 연결한다."],
    implementationRequirements: [
      "회의 파일, 참여자, 분석 옵션 등 입력 상태를 flow API 또는 컴포넌트로 표현한다.",
      "입력 부족/잘못된 입력 상태를 props로 표현한다.",
      "분석 시작 흐름으로 전달할 수 있는 callback 구조를 제공한다.",
    ],
    verificationChecklist: [
      "회의 파일, 참여자, 분석 옵션 입력 상태를 표현할 수 있는 flow API 또는 컴포넌트가 독립적으로 import/export 가능하다.",
      "분석 시작 흐름으로 전달할 수 있는 callback 구조를 제공한다.",
    ],
  },
  feature_processing: {
    implementationGoal: ["비동기 변환·분석 처리 진행 상태를 사용자에게 표시한다."],
    implementationRequirements: [
      "업로드/STT/화자 분리/초안 생성의 진행 단계를 표시한다.",
      "진행률 또는 단계 상태를 칩, 메시지, 타임라인 중 적절한 UI로 표현한다.",
      "처리 중에는 사용자가 현재 상태를 이해할 수 있어야 한다.",
      "완료/실패 상태로 전환될 수 있어야 한다.",
    ],
    verificationChecklist: [
      "업로드/STT/화자 분리/초안 생성 단계 상태를 표현할 수 있는 flow API 또는 컴포넌트가 독립적으로 import/export 가능하다.",
      "완료/실패 상태 전환은 props/callback 또는 상태 모델로 표현 가능해야 한다.",
    ],
  },
  feature_result: {
    implementationGoal: ["생성된 요약·스크립트를 확인하고 후속 행동을 판단할 수 있는 흐름을 제공한다."],
    implementationRequirements: [
      "요약본, 결정사항, 할 일, 화자별 스크립트를 확인할 수 있어야 한다.",
      "결과 없음/로딩/오류 상태를 처리할 수 있어야 한다.",
      "사용자가 결과를 검토하거나 다음 행동을 판단할 수 있는 UI 구조를 제공한다.",
    ],
    verificationChecklist: [
      "요약본, 결정사항, 할 일, 화자별 스크립트 결과 상태를 표현할 수 있는 flow API 또는 컴포넌트가 독립적으로 import/export 가능하다.",
      "결과 없음/로딩/오류 상태는 props/callback 또는 상태 모델로 표현 가능해야 한다.",
    ],
  },
  app_shell: {
    implementationGoal: [
      "선택된 템플릿의 전체 IA, 공통 레이아웃, 컨테이너, 주요 패널 구조를 제공한다.",
    ],
    implementationRequirements: [
      "반응형 3열 workspace shell/container를 구현한다.",
      "좌열, 중앙, 우열 패널을 명확한 컴포넌트 단위로 분리한다.",
      "좌열에는 회의 파일/참여자 영역을 배치한다.",
      "중앙에는 작업 공간과 하단 입력줄을 배치한다.",
      "우열에는 결과 패널, 요약본/스크립트 탭, 초안 생성 타임라인을 배치한다.",
      "프레임 상단에는 변환 단계 칩 또는 진행 상태 영역을 배치한다.",
      "모바일에서는 주요 패널이 세로 스택 또는 탭 구조로 전환될 수 있어야 한다.",
      "공통 frame 안에서 입력/결과/상태 컴포넌트를 렌더링할 수 있게 한다.",
    ],
    verificationChecklist: [
      "좌열/중앙/우열 패널이 렌더링된다.",
      "입력 화면과 결과 화면이 동일한 shell/container 안에서 배치될 수 있다.",
      "모바일 또는 좁은 화면에서 주요 패널이 깨지지 않는다.",
      "변환 단계 칩 또는 진행 상태 영역이 표시된다.",
    ],
  },
  screen_input: {
    implementationGoal: ["사용자가 파일을 선택·업로드하고 분석을 시작할 수 있는 입력 화면을 구현한다."],
    implementationRequirements: [
      "회의 파일 업로드/선택 진입점을 props 기반 화면 컴포넌트로 제공한다.",
      "파일명, 재생 길이, 변환 상태 등 선택 파일 정보를 카드/리스트로 표현한다.",
      "참여자 이름·역할·상태를 구분해 표시할 수 있는 UI 구조를 포함한다.",
      "placeholder-only 화면을 만들지 않는다.",
    ],
    verificationChecklist: [
      "회의 파일 카드, 참여자 목록, 업로드/선택 상태를 실제 화면처럼 표현한다.",
    ],
  },
  screen_result: {
    implementationGoal: ["요약·스크립트 등 분석 결과를 확인하는 결과 화면을 구현한다."],
    implementationRequirements: [
      "요약본/스크립트 결과 확인 영역을 카드/탭 구조로 제공한다.",
      "핵심 안건, 결정사항, 할 일 카드 구조를 제공한다.",
      "화자별 스크립트 표시 구조를 제공한다.",
      "undefined/null/빈 문자열 노출을 방어한다.",
    ],
    verificationChecklist: [
      "요약, 핵심 안건, 결정사항, 할 일, 스크립트, 초안 생성 타임라인을 실제 결과 화면처럼 표현한다.",
    ],
  },
  screen_admin: {
    implementationGoal: ["분석 결과·처리 상태를 관리·확인할 수 있는 관리 화면을 구현한다."],
    implementationRequirements: [
      "회의 분석 결과 또는 처리 상태를 관리/확인할 수 있는 카드/목록 영역을 제공한다.",
      "재처리, 확인, 상태 변경 같은 보조 행동을 props/callback으로 표현한다.",
      "optional screen이더라도 빈 placeholder만 생성하지 않는다.",
    ],
    verificationChecklist: [
      "처리 상태, 결과 상태, 재처리/확인 등 보조 행동을 실제 관리 화면처럼 표현한다.",
    ],
  },
  screen: {
    implementationGoal: ["기획 범위에 맞는 화면 UI와 상태 흐름을 구현한다."],
    implementationRequirements: [
      "화면 컴포넌트 및 필요한 상태 모듈 구현",
      "정상/예외/로딩 상태 처리",
      "기존 라우팅·레이아웃과 연동",
    ],
    verificationChecklist: ["화면 진입 및 주요 플로우 확인", "예외 상태 확인", "기존 화면 회귀 없음 확인"],
  },
  generic_component: {
    implementationGoal: ["해당 기능을 위한 UI/logic component를 대상 프로젝트 구조에 맞게 구현한다."],
    implementationRequirements: [
      "재사용 가능한 컴포넌트 또는 helper 구현",
      "상태 흐름과 예외 처리 포함",
      "기존 화면/모듈 중 최소 1곳에 연동",
      "불필요한 대규모 구조 변경 금지",
    ],
    verificationChecklist: [
      "기능 진입점에서 동작 확인",
      "정상/예외 상태 확인",
      "기존 화면 회귀 없음 확인",
    ],
  },
};

export function resolveCodeTaskFeaturePromptTemplate(input: {
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly changeType: string;
  readonly parentTitle?: string;
  readonly roleKind?: CodeTaskRoleKind;
}): CodeTaskFeaturePromptTemplate {
  if (/preview\s*ux|샘플데이터\s*실제\s*화면\s*연결/i.test(input.title)) {
    const base = TEMPLATES.preview_ux_wiring;
    return { kind: "preview_ux_wiring", ...base };
  }
  const fromRole = input.roleKind ? featurePromptKindFromRoleKind(input.roleKind) : null;
  const kind = fromRole ?? matchCodeTaskFeaturePromptKind(input);
  const base = TEMPLATES[kind];
  return { kind, ...base };
}
