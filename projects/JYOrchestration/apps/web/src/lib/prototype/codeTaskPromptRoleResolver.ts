export type CodeTaskRoleKind =
  | "app_shell"
  | "screen_input"
  | "screen_result"
  | "screen_admin"
  | "feature_start"
  | "feature_input"
  | "feature_processing"
  | "feature_result"
  | "common_loading"
  | "common_error"
  | "common_empty"
  | "common_retry"
  | "common_permission"
  | "common_draft"
  | "mock_data"
  | "generic";

export type CodeTaskTemplateContext = Readonly<{
  readonly templateId?: string;
  readonly templateNameKo?: string;
}>;

const ROLE_DEFINITIONS: ReadonlyArray<
  Readonly<{
    readonly kind: CodeTaskRoleKind;
    readonly patterns: readonly RegExp[];
    readonly role: string;
  }>
> = [
  {
    kind: "app_shell",
    patterns: [/shell|앱\s*shell|화면\s*프레임|공통\s*화면\s*프레임|frame/i],
    role: "선택된 템플릿의 전체 IA, 공통 레이아웃, 컨테이너, 주요 패널 구조를 제공한다.",
  },
  {
    kind: "screen_input",
    patterns: [/입력\s*화면/i],
    role: "사용자가 녹취 파일을 업로드/선택하고 분석 작업을 시작할 수 있는 입력 진입점을 제공한다.",
  },
  {
    kind: "screen_result",
    patterns: [/결과\s*화면/i],
    role: "회의 요약본, 결정사항, 할 일, 스크립트 결과를 확인하는 결과 패널/화면을 제공한다.",
  },
  {
    kind: "screen_admin",
    patterns: [/관리\s*화면/i],
    role: "회의 분석 결과나 처리 상태를 관리·확인할 수 있는 보조 화면/관리 영역을 제공한다.",
  },
  {
    kind: "common_loading",
    patterns: [/로딩\s*상태|loading\s*state/i],
    role: "업로드, STT 변환, 화자 분리, 초안 생성 등 비동기 처리 중 진행 상태를 일관되게 표시한다.",
  },
  {
    kind: "common_error",
    patterns: [/오류\s*메시지|error\s*message/i],
    role: "파일 업로드 실패, 변환 실패, 데이터 조회 실패 등 오류 상황을 사용자에게 명확히 안내한다.",
  },
  {
    kind: "common_empty",
    patterns: [/빈\s*결과|empty\s*state|no\s*result/i],
    role: "파일/스크립트/요약 결과가 아직 없거나 검색 결과가 없을 때 안내와 다음 행동을 제공한다.",
  },
  {
    kind: "common_retry",
    patterns: [/재시도/i],
    role: "실패한 업로드·변환·분석 작업을 사용자가 다시 실행할 수 있는 공통 재시도 흐름을 제공한다.",
  },
  {
    kind: "common_permission",
    patterns: [/권한\s*없음|permission|access\s*denied/i],
    role: "접근 권한이 없거나 사용 불가한 기능에 대해 명확한 안내와 대체 행동을 제공한다.",
  },
  {
    kind: "common_draft",
    patterns: [/임시\s*저장|draft\s*save|autosave/i],
    role: "입력 중인 회의 정보나 편집 중인 회의록 초안이 손실되지 않도록 저장 상태를 제공한다.",
  },
  {
    kind: "feature_start",
    patterns: [/시작\s*기능|분석\s*시작\s*기능|^시작\b/i],
    role: "사용자가 회의 분석 작업을 시작하는 진입 액션을 제공하고, 파일 선택/업로드 이후 분석 흐름으로 상태를 전환한다.",
  },
  {
    kind: "feature_input",
    patterns: [/업무\s*입력/i],
    role: "회의 파일, 참여자, 분석 옵션 등 사용자가 제공해야 하는 입력 정보를 수집하고 작업 공간 상태와 연결한다.",
  },
  {
    kind: "feature_processing",
    patterns: [/처리\s*중\s*기능|처리\s*중/i],
    role: "업로드, STT 변환, 화자 분리, 회의록 초안 생성 등 비동기 처리 진행 상태를 사용자에게 표시한다.",
  },
  {
    kind: "feature_result",
    patterns: [/결과\s*확인/i],
    role: "생성된 요약본과 화자별 스크립트를 사용자가 확인하고 후속 작업을 판단할 수 있는 흐름을 제공한다.",
  },
  {
    kind: "mock_data",
    patterns: [/mock\s*데이터\s*구조|mock\s*data\s*구조|데이터\/mock\s*구현/i],
    role: "화면과 상태 흐름을 검증할 수 있도록 회의 파일, 참여자, 스크립트, 요약, 진행 상태 샘플 데이터를 정의한다.",
  },
];

function uniqWarnings(items: readonly string[]): string[] {
  return [...new Set(items.map((x) => x.trim()).filter(Boolean))];
}

function combinedHaystack(input: {
  readonly codeTaskTitle: string;
  readonly codeTaskDescription?: string;
  readonly parentTaskTitle?: string;
  readonly parentTaskDescription?: string;
}): string {
  return [
    input.codeTaskTitle,
    input.codeTaskDescription ?? "",
    input.parentTaskTitle ?? "",
    input.parentTaskDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function resolveCodeTaskSpecificRole(input: {
  readonly codeTaskTitle: string;
  readonly codeTaskDescription?: string;
  readonly parentTaskTitle?: string;
  readonly parentTaskDescription?: string;
  readonly requirements?: readonly string[];
  readonly changeType?: string;
  readonly templateContext?: CodeTaskTemplateContext | null;
}): Readonly<{
  readonly role: string;
  readonly roleKind: CodeTaskRoleKind;
  readonly warnings: readonly string[];
}> {
  const hay = combinedHaystack(input);
  const warnings: string[] = [];

  for (const def of ROLE_DEFINITIONS) {
    if (def.patterns.some((p) => p.test(hay))) {
      const roleWarnings =
        def.kind === "screen_admin" ? uniqWarnings([...warnings, "optional_screen_scope"]) : warnings;
      return { role: def.role, roleKind: def.kind, warnings: roleWarnings };
    }
  }

  if (input.changeType === "screen" || /화면\s*구현/i.test(hay)) {
    warnings.push("generic_role");
    return {
      role: "기획 범위에 맞는 화면 UI와 상태 흐름을 제공한다.",
      roleKind: "generic",
      warnings,
    };
  }

  warnings.push("generic_role");
  return {
    role: sanitizeRoleFallback(input.codeTaskTitle, input.codeTaskDescription),
    roleKind: "generic",
    warnings,
  };
}

function sanitizeRoleFallback(title: string, description?: string): string {
  const t = title.trim();
  const d = description?.trim();
  if (d && d.length < 120 && !d.includes("하위 작업:")) return d;
  if (t) return `${t}에 맞는 UI·상태·연동을 제공한다.`;
  return "기획 범위에 맞는 기능을 구현한다.";
}

export function roleKindToDefaultRelated(input: {
  readonly roleKind: CodeTaskRoleKind;
}): Readonly<{
  readonly features: readonly string[];
  readonly screens: readonly string[];
  readonly states: readonly string[];
}> {
  switch (input.roleKind) {
    case "common_retry":
      return { features: ["재시도"], screens: ["작업 공간", "결과 패널"], states: ["error", "failed", "retrying"] };
    case "common_error":
      return { features: ["오류 메시지"], screens: ["작업 공간", "결과 패널"], states: ["error", "failed"] };
    case "common_loading":
      return {
        features: ["로딩 상태"],
        screens: ["작업 공간", "결과 패널"],
        states: ["loading", "uploading", "stt_processing"],
      };
    case "common_empty":
      return { features: ["빈 결과"], screens: ["결과 패널"], states: ["empty", "no_result"] };
    case "common_permission":
      return {
        features: ["권한 없음 안내"],
        screens: ["작업 공간", "결과 패널"],
        states: ["forbidden", "unauthorized"],
      };
    case "feature_start":
      return {
        features: ["분석 시작", "회의 파일"],
        screens: ["작업 공간", "회의 파일"],
        states: ["idle", "ready", "uploading"],
      };
    case "feature_input":
      return {
        features: ["회의 파일", "참여자", "분석 옵션"],
        screens: ["회의 파일", "작업 공간"],
        states: ["idle", "validating", "ready"],
      };
    case "feature_processing":
      return {
        features: ["STT", "화자 분리", "초안 생성"],
        screens: ["작업 공간", "결과 패널"],
        states: ["uploading", "stt_processing", "speaker_waiting", "draft_pending"],
      };
    case "feature_result":
      return {
        features: ["요약본", "스크립트", "결정사항", "할 일"],
        screens: ["결과 패널"],
        states: ["success", "empty", "loading", "error"],
      };
    case "common_draft":
      return { features: ["임시 저장"], screens: ["작업 공간"], states: ["draft", "saving", "saved"] };
    case "screen_input":
      return {
        features: ["회의 파일", "업로드", "분석 시작"],
        screens: ["회의 파일", "작업 공간"],
        states: ["idle", "uploading", "ready"],
      };
    case "screen_result":
      return {
        features: ["요약본", "스크립트", "결정사항", "할 일"],
        screens: ["결과 패널"],
        states: ["success", "empty", "loading", "error"],
      };
    case "screen_admin":
      return { features: ["관리", "상태 확인"], screens: ["관리 화면"], states: ["idle", "loading"] };
    case "app_shell":
      return {
        features: ["회의 파일", "작업 공간", "결과 패널", "초안 생성 타임라인"],
        screens: ["회의 분석 워크스페이스"],
        states: ["uploading", "stt_processing", "speaker_waiting", "draft_pending"],
      };
    case "mock_data":
      return {
        features: ["Mock 데이터", "회의 파일", "스크립트", "요약"],
        screens: ["작업 공간", "결과 패널"],
        states: ["idle", "success"],
      };
    default:
      return { features: [], screens: [], states: [] };
  }
}
