export type CodeTaskFeaturePromptKind =
  | "loading_state"
  | "error_message"
  | "empty_state"
  | "retry"
  | "permission_denied"
  | "draft_save"
  | "screen"
  | "api"
  | "mock_data"
  | "generic_component";

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

function matchKind(input: {
  readonly title: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly changeType: string;
}): CodeTaskFeaturePromptKind {
  const text = haystack(input);
  if (/로딩|loading|스피너|skeleton/i.test(text)) return "loading_state";
  if (/재시도|retry/i.test(text)) return "retry";
  if (/오류|error|에러|실패.*메시지/i.test(text)) return "error_message";
  if (/빈\s*결과|empty|no\s*result|결과\s*없/i.test(text)) return "empty_state";
  if (/권한|permission|access\s*denied|접근\s*제한/i.test(text)) return "permission_denied";
  if (/임시\s*저장|draft|autosave|자동\s*저장/i.test(text)) return "draft_save";
  if (input.changeType === "api" || /api|endpoint|route/i.test(text)) return "api";
  if (/mock|더미|fixture|샘플\s*데이터/i.test(text)) return "mock_data";
  if (input.changeType === "screen" || /화면|screen|page/i.test(text)) return "screen";
  return "generic_component";
}

const TEMPLATES: Record<CodeTaskFeaturePromptKind, Omit<CodeTaskFeaturePromptTemplate, "kind">> = {
  loading_state: {
    implementationGoal: [
      "데이터 로딩 또는 비동기 처리 중 사용자에게 명확한 진행 상태를 표시한다.",
    ],
    implementationRequirements: [
      "LoadingState, Spinner, Skeleton 또는 유사 컴포넌트 구현",
      "loading flag 기반 표시/숨김 처리",
      "기존 화면 중 최소 1곳에 연동",
      "정상 완료 후 로딩 상태가 사라져야 함",
      "접근성: aria-busy 또는 status role 검토",
    ],
    verificationChecklist: [
      "로딩 중 UI 표시 확인",
      "완료 후 정상 화면 복귀 확인",
      "기존 정상 화면 회귀 없음 확인",
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
      "기존 화면/상태 흐름 중 최소 1곳에 연동",
      "정상/오류/재시도 흐름 구분",
    ],
    verificationChecklist: [
      "오류 상태가 화면에 표시되는지 확인",
      "retry action이 있을 때 버튼 표시 확인",
      "정상 상태 회귀 없음 확인",
    ],
  },
  empty_state: {
    implementationGoal: [
      "데이터가 없거나 검색 결과가 없을 때 사용자에게 명확한 안내와 다음 행동을 제공한다.",
    ],
    implementationRequirements: [
      "EmptyState 또는 NoResultState 공통 컴포넌트 구현",
      "title, description, optional action 지원",
      "기존 목록/검색/결과 화면 중 최소 1곳에 연동",
      "오류 상태와 빈 상태가 구분되어야 함",
    ],
    verificationChecklist: [
      "데이터 없음 상태에서 EmptyState 표시",
      "action이 있으면 동작 확인",
      "데이터가 있을 때 기존 목록 표시 유지",
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
      "retrying/loading 상태 표시",
      "오류 메시지 또는 로딩 실패 상태와 함께 재사용 가능",
      "기존 오류/빈 결과/로딩 실패 상태 중 최소 1곳에 연동",
    ],
    verificationChecklist: [
      "재시도 버튼 표시 확인",
      "onRetry 호출 확인",
      "재시도 중 버튼 disabled 또는 중복 클릭 방지 확인",
      "정상 상태 회귀 없음 확인",
    ],
  },
  permission_denied: {
    implementationGoal: [
      "권한이 없거나 접근이 제한된 경우 사용자에게 명확한 안내를 제공한다.",
    ],
    implementationRequirements: [
      "PermissionDenied 또는 AccessDenied 공통 컴포넌트 구현",
      "안내 메시지, 설명, optional action 지원",
      "권한 조건 또는 placeholder 상태와 연동 가능한 구조",
      "기존 화면 중 최소 1곳에 적용 가능해야 함",
    ],
    verificationChecklist: [
      "권한 없음 상태에서 안내 표시",
      "권한 있음 상태에서 정상 화면 유지",
    ],
  },
  draft_save: {
    implementationGoal: [
      "사용자가 입력/작성 중인 내용을 잃지 않도록 임시 저장 상태 흐름을 구현한다.",
    ],
    implementationRequirements: [
      "draft state 또는 temporary save helper 구현",
      "저장 중/saved/error 상태 구분",
      "사용자에게 저장 상태 표시",
      "기존 입력 흐름 중 최소 1곳에 연동",
      "브라우저 저장소 사용 시 key scope를 명확히 함",
    ],
    verificationChecklist: [
      "입력 후 임시 저장 상태 표시",
      "새로고침/재진입 정책이 있다면 복원 확인",
      "저장 실패 상태 표시 확인",
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
  mock_data: {
    implementationGoal: ["개발·검증에 필요한 mock/fixture 데이터 또는 stub을 구현한다."],
    implementationRequirements: [
      "mock data 또는 fixture helper 구현",
      "실제 API와 교체 가능한 구조",
      "기존 화면/상태 흐름과 연동",
    ],
    verificationChecklist: ["mock 데이터로 화면/흐름 동작 확인", "정상 데이터 전환 시 회귀 없음 확인"],
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
}): CodeTaskFeaturePromptTemplate {
  const kind = matchKind(input);
  const base = TEMPLATES[kind];
  return { kind, ...base };
}
