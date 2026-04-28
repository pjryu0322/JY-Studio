/**
 * AI Members / Stage 2 역할 대시보드용 단일 출처 정의.
 * (실행 파이프라인 DB 스키마와 별도 — UI·정책·기본 멤버 생성 메타)
 */

export type AiMemberRoleKey = "executor" | "reviewer" | "security" | "scm";

export type AiMemberProviderId = "openai";

/** Stage 2 기본 OpenAI 경량 모델(표시용; 서버는 resolveEnvTestStage2OpenAiModel) */
export const AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL = "gpt-4o-mini" as const;

export type AiMemberRoleDefinition = {
  roleKey: AiMemberRoleKey;
  displayName: string;
  description: string;
  provider: AiMemberProviderId;
  modelLabel: typeof AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL;
  enabledDefault: boolean;
  requiredForStage2: boolean;
  platformFallback: boolean;
  /** DB ProjectMember 로 표현되는지 (Executor는 Cursor·OpenAI ACK 경로 전용) */
  persistedAsProjectMember: boolean;
  /** invite / lookup 시 사용하는 오케스트레이션 키 (Prisma aiOrchestrationRole 문자열) */
  orchestrationRoleId: string | null;
  orchestrationStageId: string | null;
  projectRoleForInvite: "REVIEWER" | "EDITOR" | null;
  inviteDisplayName: string | null;
  roleBoundary: readonly string[];
  normalizedInputExample: Record<string, unknown>;
  normalizedOutputExample: Record<string, unknown>;
  judgmentCriteria: readonly string[];
};

export const AI_MEMBER_ROLE_DEFINITIONS: Record<AiMemberRoleKey, AiMemberRoleDefinition> = {
  executor: {
    roleKey: "executor",
    displayName: "Executor",
    description: "Cursor 실행을 시작하는 역할",
    provider: "openai",
    modelLabel: AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL,
    enabledDefault: true,
    requiredForStage2: true,
    platformFallback: false,
    persistedAsProjectMember: false,
    orchestrationRoleId: null,
    orchestrationStageId: null,
    projectRoleForInvite: null,
    inviteDisplayName: null,
    roleBoundary: [
      "Cursor 실행 요청 시작",
      "역할 분리 환경 검증의 시작점",
      "branch push까지 유도",
      "PR 생성·리뷰·보안·merge 판단은 하지 않음",
    ],
    normalizedInputExample: {
      type: "EXECUTE_ENV_TEST_STAGE2",
      summary: "최소 변경 생성 후 push",
      mode: "ENV_TEST_STAGE2",
    },
    normalizedOutputExample: {
      type: "EXECUTOR_STATUS",
      status: "STARTED | RUNNING | FAILED",
      reason: "짧은 설명",
    },
    judgmentCriteria: [
      "입력이 정상이고 실행 시작 가능하면 STARTED",
      "진행 중이면 RUNNING",
      "시작 실패 시 FAILED",
    ],
  },
  reviewer: {
    roleKey: "reviewer",
    displayName: "Reviewer",
    description: "변경 범위를 최소 검증하는 역할",
    provider: "openai",
    modelLabel: AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL,
    enabledDefault: true,
    requiredForStage2: false,
    platformFallback: false,
    persistedAsProjectMember: true,
    orchestrationRoleId: "reviewer",
    orchestrationStageId: "execution-review",
    projectRoleForInvite: "REVIEWER",
    inviteDisplayName: "Reviewer",
    roleBoundary: [
      "요청 의도와 실제 변경 결과의 구조 적합성만 판단",
      "코드 개선·리팩토링 제안 금지",
      "PASS/FAIL만 반환",
    ],
    normalizedInputExample: {
      type: "REVIEW_REQUEST",
      mode: "ENV_TEST_STAGE2",
      requestedIntent: "허용 범위 내 최소 변경",
      allowedPaths: ["orchestration-test/*.md"],
      changedFiles: ["…"],
      fileCount: 1,
      diffSummary: "single markdown file created",
    },
    normalizedOutputExample: {
      type: "REVIEW_RESULT",
      result: "PASS | FAIL",
      reason: "짧은 설명",
    },
    judgmentCriteria: [
      "허용 경로 내 변경인가",
      "금지 파일이 없는가",
      "변경량이 과도하지 않은가",
      "ENV_TEST 목적에 맞는 최소 변경인가",
    ],
  },
  security: {
    roleKey: "security",
    displayName: "Security",
    description: "최소 보안 위험을 점검하는 역할",
    provider: "openai",
    modelLabel: AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL,
    enabledDefault: true,
    requiredForStage2: false,
    platformFallback: false,
    persistedAsProjectMember: true,
    orchestrationRoleId: "security-reviewer",
    orchestrationStageId: "execution-review",
    projectRoleForInvite: "REVIEWER",
    inviteDisplayName: "Security",
    roleBoundary: [
      "최소 보안 위험 점검만 수행",
      "정식 보안 심사·복잡한 분석 금지",
      "PASS/FAIL만 반환",
    ],
    normalizedInputExample: {
      type: "SECURITY_REQUEST",
      mode: "ENV_TEST_STAGE2",
      changedFiles: ["…"],
      diffSummary: "single markdown file created",
      fileCount: 1,
    },
    normalizedOutputExample: {
      type: "SECURITY_RESULT",
      result: "PASS | FAIL",
      reason: "짧은 설명",
    },
    judgmentCriteria: [
      "secret / api key 노출 여부",
      "password / token 문자열 포함 여부",
      "위험 코드 패턴(eval, exec 등)",
      "비정상 대량 변경 여부",
    ],
  },
  scm: {
    roleKey: "scm",
    displayName: "SCM",
    description: "PR merge 및 검증을 담당하는 역할",
    provider: "openai",
    modelLabel: AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL,
    enabledDefault: true,
    requiredForStage2: false,
    platformFallback: true,
    persistedAsProjectMember: true,
    orchestrationRoleId: "scm-manager",
    orchestrationStageId: "scm-manager",
    projectRoleForInvite: "EDITOR",
    inviteDisplayName: "SCM",
    roleBoundary: [
      "review PASS + security PASS 조건 확인",
      "merge 실행 및 merge verify 확인",
      "충돌 해결·전략 판단 금지",
      "결과는 MERGED/BLOCKED/VERIFY_FAILED만",
    ],
    normalizedInputExample: {
      type: "SCM_REQUEST",
      mode: "ENV_TEST_STAGE2",
      prNumber: 14,
      prState: "OPEN",
      reviewResult: "PASS",
      securityResult: "PASS",
      mergeable: true,
    },
    normalizedOutputExample: {
      type: "SCM_RESULT",
      result: "MERGED | BLOCKED | VERIFY_FAILED",
      reason: "짧은 설명",
    },
    judgmentCriteria: [
      "PR 존재",
      "PR OPEN 상태",
      "review PASS 여부",
      "security PASS 여부",
      "merge 가능 여부",
      "merge verify 성공 여부",
    ],
  },
};

export const STAGE2_DASHBOARD_ROLE_ORDER: readonly AiMemberRoleKey[] = [
  "executor",
  "reviewer",
  "security",
  "scm",
] as const;

/** 기본 멤버 추가 API가 실제로 생성하는 DB 슬롯(Executor 제외) */
export type Stage2DefaultDbSlot = {
  roleKey: AiMemberRoleKey;
  orchestrationStage: string;
  aiOrchestrationRole: string;
  projectRole: "REVIEWER" | "EDITOR";
  displayName: string;
};

export const STAGE2_DEFAULT_DB_MEMBER_SLOTS: readonly Stage2DefaultDbSlot[] = [
  {
    roleKey: "reviewer",
    orchestrationStage: "execution-review",
    aiOrchestrationRole: "reviewer",
    projectRole: "REVIEWER",
    displayName: "Reviewer",
  },
  {
    roleKey: "security",
    orchestrationStage: "execution-review",
    aiOrchestrationRole: "security-reviewer",
    projectRole: "REVIEWER",
    displayName: "Security",
  },
  {
    roleKey: "scm",
    orchestrationStage: "scm-manager",
    aiOrchestrationRole: "scm-manager",
    projectRole: "EDITOR",
    displayName: "SCM",
  },
] as const;

/** UI invite 프리셋용 오케스트레이션 키 (기존 ProjectMembersSection 과 동일) */
export function orchestrationInviteKeyForRole(roleKey: AiMemberRoleKey): string | null {
  const d = AI_MEMBER_ROLE_DEFINITIONS[roleKey];
  return d.orchestrationRoleId;
}
