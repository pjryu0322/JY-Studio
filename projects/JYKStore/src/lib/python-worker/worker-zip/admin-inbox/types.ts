import type { prisma } from "@/lib/prisma";
import type { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";

export type AdminWorkerZipRequestListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  /** ISO timestamp when Admin 접수 completed; null while still 접수 대기. */
  acceptedAt: string | null;
  /**
   * 품질점검(품질점검 리프레시) 결과가 마지막으로 확정된 시각 — ISO.
   * 미실행이면 null.
   */
  qualityCheckedAt: string | null;
  /**
   * 품질점검상태: NOT_CHECKED / IN_PROGRESS / PASS / WARNING / FAIL
   * (ReleaseGateRun 기준 — 없으면 다른 품질 리포트 존재 여부로 IN_PROGRESS 추정)
   */
  qualityStatus: string;
  originalFileName: string | null;
  /** True once an Admin has 접수(accepted) the request (접수완료). */
  accepted: boolean;
  /**
   * Queue phase for Admin UI:
   * - REQUESTED: 접수 대기
   * - ACCEPTED: 접수완료 (생성 실행 가능)
   * - COMPLETED: 생성 완료 (품질 점검 등 후속 작업, 아직 DRAFT)
   */
  phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
  /** KnowledgePack.status — always DRAFT for this list today. */
  packStatus: string;
  providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
  serviceValidationPhase: "NONE" | "PASSED";
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

export type AdminWorkerZipDraftItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  acceptedAt: string | null;
  originalFileName: string | null;
  accepted: boolean;
  phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
  packStatus: string;
};

/** Marker map shape accepted by the inbox list (superset fields allowed). */
export type ListAdminWorkerZipRequestsInput = {
  prismaClient?: typeof prisma;
  env?: NodeJS.ProcessEnv;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  resolveWorkflowMarkers?: (
    packIds: string[],
  ) => Promise<
    Map<
      string,
      {
        providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
        serviceValidationPhase: "NONE" | "PASSED";
      }
    >
  >;
};

export type PackVersionRef = { id: string; version: string };

export type WorkerZipRequestRunRow = {
  packId: string;
  createdAt: Date;
  startedAt: Date | null;
  updatedAt: Date | null;
  status: string;
  pack: {
    status: string;
    name: string;
    categoryId: string | null;
    category: { name: string } | null;
    providerProfile: { displayName: string } | null;
    versions: PackVersionRef[];
  } | null;
};

export type WorkerZipCompletedImportRunRow = {
  packId: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  pack: {
    status: string;
    name: string;
    categoryId: string | null;
    category: { name: string } | null;
    providerProfile: { displayName: string } | null;
    versions: PackVersionRef[];
  } | null;
};

export type LegacyWorkerZipRequestRow = {
  packId: string;
  createdAt: Date;
  startedAt: Date | null;
  updatedAt: Date | null;
  status: string;
};
