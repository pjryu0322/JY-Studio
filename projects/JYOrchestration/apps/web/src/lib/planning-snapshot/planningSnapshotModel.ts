/** Planning Snapshot 도메인 모델 (버전 UI는 후속) */
export type PlanningSnapshotScope = Readonly<{
  readonly included: readonly string[];
  readonly excluded: readonly string[];
}>;

export type PlanningSnapshotModel = Readonly<{
  readonly projectId: string;
  readonly productName: string;
  readonly summary: string;
  readonly problems: readonly string[];
  readonly actors: readonly string[];
  readonly features: readonly string[];
  readonly scope: PlanningSnapshotScope;
  readonly successCriteria: readonly string[];
  readonly sourceMessageId: string;
  readonly createdBy: string;
}>;

export const PLANNING_SNAPSHOT_CREATED_BY = "AI Planner" as const;

export const PLANNING_SNAPSHOT_EVENT_TYPE = "planning.snapshot_created" as const;

export type PlanningSnapshotV1Wire = Readonly<{
  readonly productName: string;
  readonly summary: string;
  readonly problems: readonly string[];
  readonly actors: readonly string[];
  readonly features: readonly string[];
  readonly scope?: PlanningSnapshotScope;
  readonly successCriteria?: readonly string[];
  readonly sourceMessageId: string;
  readonly createdBy?: string;
  readonly integratedAt?: string;
  readonly eventId?: string | null;
}>;
