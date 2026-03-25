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

export type TaskItem = {
  id: string;
  projectId: string;
  projectSpecUploadId: string;
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
