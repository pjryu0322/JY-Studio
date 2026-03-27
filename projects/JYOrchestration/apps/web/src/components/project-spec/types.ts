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
  title: string;
  description: string | null;
  priority: string;
  dependsOn: string[];
  /** 선행 TaskDraft id 배열 (Workflow 캔버스 엣지) */
  dependsOnIds: string[];
  acceptanceCriteria: string[];
  /** Workflow 캔버스 노드 좌표(px) */
  positionX: number;
  /** Workflow 캔버스 노드 좌표(px) */
  positionY: number;
  /** Workflow 스윔레인 */
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
  sourceSpecVersionId?: string | null;
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
};

export type TaskGenerateResult = {
  count: number;
  items: TaskItem[];
};
