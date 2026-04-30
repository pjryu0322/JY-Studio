/**
 * Prototype automation pipeline — domain types (DB migration 없이 파일 저장소).
 */

export const PROTOTYPE_RUN_STATUSES = [
  "DRAFT",
  "PROMPT_READY",
  "PLANNER_ANALYZING",
  "WORK_UNITS_READY",
  "CURSOR_REQUESTED",
  "CURSOR_RUNNING",
  "COMMIT_DETECTED",
  "PUSH_CONFIRMED",
  "AI_REVIEWING",
  "REWORK_REQUIRED",
  "PR_OPENED",
  "MERGED",
  "DEPLOY_CONFIGURING",
  "DEPLOYING",
  "PREVIEW_READY",
  "DEPLOY_FAILED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "FAILED",
  "BLOCKED",
] as const;

export type PrototypeRunStatus = (typeof PROTOTYPE_RUN_STATUSES)[number];

/** 세부 사유 코드(표시·로그용). ENV_TEST taskKind 와 무관. */
export type PrototypeRunStatusReason =
  | "MANUAL_CURSOR_EXECUTION_REQUIRED"
  | "MANUAL_REVIEW_REQUIRED"
  | "CURSOR_API_NOT_CONNECTED"
  | "CURSOR_NOT_CONNECTED"
  | "EXECUTION_SETUP_INVALID"
  | "PLANNER_INPUT_MISSING"
  | "PLANNER_CREDENTIAL_LOOKUP_FAILED"
  | "CURSOR_LAUNCH_FAILED"
  | "CURSOR_POLL_FAILED"
  | "PR_CREATE_FAILED"
  | "PR_MERGE_FAILED"
  | "WORK_UNIT_FAILED"
  | "DEPLOY_FAILED"
  | "STUB_CURSOR_ENABLED"
  | "AI_REVIEW_NOT_IMPLEMENTED"
  | "GIT_PIPELINE_NOT_IMPLEMENTED"
  | "REVIEW_DATA_MISSING"
  | "REVIEW_ENGINE_NOT_READY"
  | null;

/** 단일 WorkUnit(구현 단위) 생명주기 — Cursor→Git→검토→PR→Merge. */
export type PrototypeWorkUnitStatus =
  | "PENDING"
  | "CURSOR_RUNNING"
  | "CURSOR_DONE"
  | "GIT_PUSHED"
  | "REVIEWING"
  | "REVIEW_PASS"
  | "REVIEW_REWORK"
  | "PR_OPENED"
  | "MERGED"
  | "SKIPPED"
  | "FAILED";

export type PrototypeWorkUnitRiskLevel = "low" | "medium" | "high";
export type PrototypeWorkUnitComplexity = "low" | "medium" | "high";

export type PrototypeWorkUnitCursorPromptSource = "planner" | "regenerated" | "retry";

export type PrototypeWorkUnit = Readonly<{
  id: string;
  order: number;
  title: string;
  /** 구현 지향 설명(플래너 출력). */
  description: string;
  targetArea: string;
  implementationScope: string;
  dependencies: readonly string[];
  acceptanceCriteria: readonly string[];
  riskLevel: PrototypeWorkUnitRiskLevel;
  estimatedComplexity: PrototypeWorkUnitComplexity;
  status: PrototypeWorkUnitStatus;
  /** WorkUnit 전용 브랜치(Cursor/PR head). */
  branchName: string;
  /** Cursor에 전달하는 단일 작업 프롬프트(전역 promptSnapshot과 분리). */
  cursorPrompt: string | null;
  cursorPromptGeneratedAt: string | null;
  cursorPromptVersion: number;
  cursorPromptSource: PrototypeWorkUnitCursorPromptSource | null;
  /** Cursor 실행 시작(에이전트 요청) 시각. */
  executionStartedAt: string | null;
  /** 머지 완료 등 실행 종료 시각. */
  executionCompletedAt: string | null;
  cursorRunId: string | null;
  commitSha: string | null;
  changedFiles: readonly string[];
  prNumber: number | null;
  prUrl: string | null;
  mergeSha: string | null;
  reviewSummary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * Cursor Cloud Agent 폴링에서 얻는 최근 상태 힌트(UI 표시용).
   * - DB 마이그레이션 없이 파일 저장소에만 저장한다.
   * - Cursor API 응답 스키마가 바뀌어도 "표시" 목적이라 null 허용.
   */
  cursorAgentStatusUpper: string | null;
  cursorLastPolledAt: string | null;
  cursorLastSummary: string | null;
}>;

export type PrototypeDeploymentStatus = "PENDING" | "REQUESTED" | "RUNNING" | "DONE" | "FAILED";

export type PrototypePlannerSource = "llm" | "fallback";

export type PrototypeRun = Readonly<{
  id: string;
  projectId: string;
  selectedTemplate: string;
  /** 기획·요구 스냅샷(아카이브). Cursor 실행 프롬프트는 WorkUnit.cursorPrompt 사용. */
  promptSnapshot: string;
  /** 플래너 입력으로 저장된 맥락(Cursor 단위 프롬프트 생성용). */
  prototypeIdeationSummary: string | null;
  prototypeActorFlowSummary: string | null;
  /** JSON 문자열 배열: 기능 제목 목록 */
  prototypeFeatureDraftTitlesJson: string | null;
  /** 플래너 입력의 프로젝트 설명(Goal). DB 설명과 함께 WorkUnit 프롬프트에 사용. */
  prototypeProjectDescription: string | null;
  /** 2 이상이면 WorkUnit 미리보기·실행 확인 게이트 사용. */
  runSchemaVersion: number;
  /** false면 WorkUnit 미리보기 단계 — Cursor 자동 실행 금지. */
  workUnitsExecutionConfirmed: boolean;
  /** 마지막 플래너 소스(내부 표시·UI 힌트). */
  plannerSource: PrototypePlannerSource | null;
  /** LLM 실패 시 요약(키 등 민감정보 없음). */
  plannerError: string | null;
  status: PrototypeRunStatus;
  statusReason: PrototypeRunStatusReason;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
  plannerStatus: "PENDING" | "RUNNING" | "DONE" | "FAILED" | null;
  plannerSummary: string | null;
  workUnits: ReadonlyArray<PrototypeWorkUnit>;
  /** 현재(또는 다음) 파이프라인이 다루는 WorkUnit order(1-based). 없으면 null. */
  currentWorkUnitOrder: number | null;
  totalWorkUnits: number;

  /** 활성 WorkUnit과 동기화되는 실행 스냅샷(폴링/Git 어댑터 호환). */
  branchName: string;
  cursorRunId: string | null;
  commitSha: string | null;
  changedFiles: readonly string[];
  aiReviewDecision: "PENDING" | "PASS" | "REWORK" | "NOT_IMPLEMENTED" | null;
  aiReviewSummary: string | null;
  prUrl: string | null;
  prNumber: number | null;
  mergeSha: string | null;

  deploymentStatus: PrototypeDeploymentStatus;
  deploymentRequestedAt: string | null;
  deploymentStartedAt: string | null;
  deploymentEndedAt: string | null;
  resultUrl: string | null;
  /** repo owner/repo 기반 GitHub Pages 예상 URL */
  suggestedPreviewUrl: string | null;
  previewUrl: string | null;
  /** Pages 배포 워크플로 실행 URL(있으면). */
  pagesDeployWorkflowRunUrl: string | null;
  /** 배포 단계 실패 사유(HTTP/GitHub). */
  deployFailureDetail: string | null;
  /** Pages 워크플로를 트리거한 설정 커밋 SHA(폴링용). */
  pagesDeployTriggerCommitSha: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PrototypeRunFileEnvelope = Readonly<{
  runs: PrototypeRun[];
}>;

/** 런타임 계산용: Cursor/Git/PR/Merge/배포 자원을 순차(또는 향후 병렬)로 묶는 내부 오케스트레이션 슬롯. DB 필드 없음. */
export type PrototypeExecutionSlotType = "WORKUNIT" | "DEPLOY" | "REVIEW";

export type PrototypeExecutionSlotStatus = "IDLE" | "WAITING" | "RUNNING" | "DONE" | "FAILED";

export type PrototypeExecutionSlot = Readonly<{
  id: string;
  runId: string;
  slotType: PrototypeExecutionSlotType;
  slotOrder: number;
  status: PrototypeExecutionSlotStatus;
  workUnitId?: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}>;
