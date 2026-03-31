export type Project = {
  id: string;
  name: string;
  description: string | null;
  ownerUserId?: string;
  projectType: string;
  repoUrl?: string | null;
  defaultBranch?: string | null;
  status: string;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  /** 승인만: NO_APPROVAL | MANUAL_APPROVAL (레거시 AUTO_APPLY = NO_APPROVAL). push와 독립. */
  gitApprovalMode?: string;
  /** push만: AUTO_PUSH | MANUAL_PUSH. 승인과 독립. */
  gitPushMode?: string;
  /** Spec 정의 워크스페이스 필드 */
  specCoreGoals?: string | null;
  specScopeIn?: string | null;
  specScopeOut?: string | null;
  specTargetUsers?: string | null;
  specSuccessCriteria?: string | null;
  /** F-1-3-1c 저장된 실행 계획(전체 마크다운). Spec AI 입력의 유일한 본문 */
  executionPlanMarkdown?: string | null;
  selectedPlanCandidateId?: string | null;
  confirmedSpecMarkdown?: string | null;
  confirmedSpecResponseId?: string | null;
  confirmedSpecAt?: string | null;
  /** 현재 활성 확정 Spec 버전 ID (project_spec_versions) */
  currentSpecVersionId?: string | null;
  /** Task 생성(요구사항 추출) 사용자 프롬프트 템플릿 (null이면 기본값 사용) */
  taskPrompt?: string | null;
  /** 단일 호출 Task 생성용 템플릿 (null이면 기본값) */
  taskGenerationPrompt?: string | null;
};

/** 확정 Project Spec 버전 행 (append-only) */
export type ProjectSpecVersionRecord = {
  id: string;
  projectId: string;
  version: number;
  markdown: string;
  sourceType: string;
  createdAt: string;
};

/** API: ProjectSpecPrompt 엔터티 (DB: ProjectSpecWorkspacePrompt) */
export type ProjectSpecPromptRecord = {
  id: string;
  projectId: string;
  version: number;
  promptText: string;
  createdAt: string;
};

/** Spec 후보 품질 (F-1-3-3) */
export type SpecCandidateScoreRecord = {
  completeness: number;
  structure: number;
  executionReadiness: number;
  total: number;
};

export type SpecCandidateMetaRecord = {
  sections: string[];
  requirementCount: number;
  hasArchitecture: boolean;
};

/** API: ProjectSpecResponse 엔터티 (DB: ProjectSpecWorkspaceResponse) */
export type ProjectSpecResponseRecord = {
  id: string;
  projectId: string;
  promptId: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseMarkdown: string;
  status: string;
  createdAt: string;
  specCandidateScore?: SpecCandidateScoreRecord | null;
  specCandidateMeta?: SpecCandidateMetaRecord | null;
};

export type SpecPromptConfigRecord = {
  id: string;
  projectId: string;
  templatePrompt: string;
  preset: string;
  lastEditedAt: string;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  code?: string;
  data?: T;
};

export type UploadResult = {
  id: string;
  projectId: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  sourceType: string;
  parseStatus: string;
  parsedAt: string | null;
  hasParsedJson: boolean;
  status: string;
  createdAt: string;
  contentStored: boolean;
};

export type UploadStatus = "idle" | "success" | "error";

export type UploadHistoryItem = {
  id: string;
  projectId: string;
  originalFileName: string;
  fileSize: number;
  fileType: string;
  sourceType: string;
  parseStatus: string;
  parsedAt: string | null;
  hasParsedJson: boolean;
  status: string;
  createdAt: string;
  contentStored: boolean;
};

export type ParseResult = {
  id: string;
  parseStatus: string | null;
  parsedAt: string | null;
  hasParsedJson: boolean;
};

/** Task list에 포함되는 최소 감사 이력 (AUTO-RUN 등 UI 판별용). */
export type TaskHistoryLiteItem = {
  eventType: string;
  detailJson?: unknown;
};

/** API: Spec 기반 Task 초안 */
export type TaskDraftDto = {
  id: string;
  projectId: string;
  specVersionId: string;
  specVersionNumber: number;
  /** requirement | design | feature | task */
  nodeType?: "requirement" | "design" | "feature" | "task";
  title: string;
  description: string | null;
  parentId?: string | null;
  childrenIds?: string[];
  priority: string;
  dependsOn: string[];
  /** 선행 TaskDraft id 배열 (Workflow 캔버스 엣지) */
  dependsOnIds: string[];
  acceptanceCriteria: string[];
  /** 실행 Task 입력(무엇을 받는지) */
  taskInput?: string | null;
  /** 실행 Task 출력(무엇을 내는지) */
  taskOutput?: string | null;
  estimatedSize?: string | null;
  /** api | logic | ui | infra | test */
  executionKind?: string | null;
  /** Workflow 캔버스 노드 좌표(px) */
  positionX: number;
  /** Workflow 캔버스 노드 좌표(px) */
  positionY: number;
  /** Workflow 스윔레인 (Requirement | Design | Development) */
  stage: string;
  /** 생성 주체: AI | USER */
  createdByType: string;
  status: string;
  sourceModel: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDraftSyncResultDto = {
  ok: boolean;
  createdCount?: number;
  supersededCount?: number;
  message?: string;
};

export type TaskItem = {
  id: string;
  projectId: string;
  projectSpecUploadId: string | null;
  /** 확정 Spec 버전 — 실행 런 workflow 계보 */
  sourceSpecVersionId?: string | null;
  /** 이전 스펙 TaskSet 보관 시각 */
  archivedAt?: string | null;
  name: string;
  description: string | null;
  status: string;
  order: number;
  parentTaskId: string | null;
  taskKind: string;
  changeReason: string | null;
  createdAt: string;
  updatedAt: string;
  histories?: TaskHistoryLiteItem[];
  /** 실행 루프 DAG 선행 Task id */
  dependsOnTaskIds?: string[] | null;
  acceptanceCriteria?: string[] | null;
  executionWorkflowStatus?: string | null;
  loopRetryCount?: number;
  lastLoopRunAt?: string | null;
  lastEvalResult?: string | null;
  lastEvalSummary?: string | null;
  lastOrchestrationBranch?: string | null;
  lastOrchestrationCommitStatus?: string | null;
  lastOrchestrationPushStatus?: string | null;
  lastOrchestrationCommitSha?: string | null;
  lastOrchestrationChangedFileCount?: number | null;
};

export type TaskGenerateResult = {
  count: number;
  items: TaskItem[];
};
