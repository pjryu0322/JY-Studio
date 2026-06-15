export type ImplementationWorkingQueueStatus =
  | "pending"
  | "approved"
  | "running"
  | "completed"
  | "rejected"
  | "deferred";

export type ImplementationWorkingQueueAffectedArea =
  | "ui"
  | "flow"
  | "feature"
  | "data"
  | "style"
  | "bug"
  | "unknown";

export type ImplementationWorkingQueueRiskLevel = "low" | "medium" | "high";

export type ImplementationWorkingQueuePreviewRect = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>;

export type ImplementationWorkingQueueItem = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly sourceMessageId?: string;
  readonly sourceCaptureId?: string;
  readonly regionCaptureId?: string;
  readonly previewUrl?: string;
  readonly rect?: ImplementationWorkingQueuePreviewRect;
  readonly targetUi?: string;
  readonly desiredBehavior?: string;
  readonly rawUserMessage: string;
  readonly title: string;
  readonly description: string;
  readonly affectedArea: ImplementationWorkingQueueAffectedArea;
  readonly status: ImplementationWorkingQueueStatus;
  readonly riskLevel: ImplementationWorkingQueueRiskLevel;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly fixCodeTaskIds?: readonly string[];
}>;

export type ImplementationWorkingQueueV1 = Readonly<{
  readonly version: "implementation_working_queue_v1";
  readonly projectId: string;
  readonly items: readonly ImplementationWorkingQueueItem[];
  readonly updatedAt: string;
}>;

export type ImplementationDeveloperMemoryDraft = Readonly<{
  readonly projectId: string;
  readonly currentFocus?: string;
  readonly latestPreviewUrl?: string;
  readonly knownRisks: readonly string[];
  readonly pendingQueueItemIds: readonly string[];
  readonly updatedAt: string;
}>;
