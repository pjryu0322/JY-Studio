import type { ExecutionSetupDto } from "@/components/project-spec/api";

export const GLOB_PLACEHOLDER = "src/**\napp/**\ntests/**";

export type PolicyRow = {
  key: keyof Pick<
    ExecutionSetupDto,
    | "autoCommit"
    | "autoPush"
    | "autoPr"
    | "requireApprovalBeforeApply"
    | "requireTestsBeforePush"
    | "dryRunAllowed"
    | "autoAdvanceToNextTask"
    | "stopOnTestFailure"
    | "stopOnRepeatedFailure"
    | "stopOnOutOfScopeChange"
    | "requireApprovalForSensitiveTasks"
  >;
  label: string;
  help: string;
};

export const POLICY_AUTO: PolicyRow[] = [
  {
    key: "autoCommit",
    label: "자동 커밋",
    help: "원격 에이전트가 변경 후 커밋할지 여부입니다.",
  },
  { key: "autoPush", label: "자동 푸시", help: "커밋 후 원격 저장소로 푸시할지 정합니다." },
  { key: "autoPr", label: "자동 PR 생성", help: "푸시 후 PR 생성까지 자동으로 이어갈지 정합니다." },
];

export const POLICY_GATES: PolicyRow[] = [
  {
    key: "requireTestsBeforePush",
    label: "푸시 전 테스트 필수",
    help: "테스트·검증을 통과하기 전에는 푸시하지 않습니다.",
  },
  {
    key: "stopOnRepeatedFailure",
    label: "동일 오류 반복 시 중단",
    help: "같은 오류가 연속으로 나면 재시도를 멈추고 사람이 개입할 수 있게 합니다.",
  },
  {
    key: "stopOnOutOfScopeChange",
    label: "허용 경로 위반 시 중단",
    help: "허용 글로브 밖 파일이나 비정상적으로 많은 변경이 감지되면 중단합니다.",
  },
  {
    key: "stopOnTestFailure",
    label: "테스트·빌드 실패 징후 시 중단",
    help: "요약·평가에서 테스트나 빌드 실패 힌트가 보이면 즉시 실패 처리합니다.",
  },
];

export const POLICY_APPROVAL: PolicyRow[] = [
  {
    key: "requireApprovalBeforeApply",
    label: "반영 전 승인 필요",
    help: "코드 반영(커밋·푸시 등) 전에 사람의 승인을 받습니다.",
  },
  {
    key: "requireApprovalForSensitiveTasks",
    label: "인증·비밀정보 관련 작업은 사람 승인 필요",
    help: "토큰·비밀번호·인증 등 민감한 작업은 자동으로 진행하지 않습니다.",
  },
];

export const POLICY_EXTRA: PolicyRow[] = [
  { key: "dryRunAllowed", label: "드라이런 허용", help: "실제 반영 없이 시뮬레이션·검토만 하는 흐름을 허용합니다." },
  {
    key: "autoAdvanceToNextTask",
    label: "검토 통과 시 다음 작업 자동 진행",
    help: "현재 작업이 통과하면 다음 준비된 작업으로 자동 이어집니다.",
  },
];
