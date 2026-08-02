import { prisma } from "@/lib/prisma";
import {
  acknowledgeWorkerZipRequestRejection,
  clearWorkerZipRequestRejection,
  deleteWorkerZipRequest,
  getWorkerZipRequestMetadata,
  markWorkerZipRequestRejected,
  storeWorkerZipRequest,
  type WorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import type { WorkerZipPackResolver } from "../pack-resolvers";

export type ProviderWorkerZipRequestStatus =
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ProviderWorkerZipRequestState = {
  packId: string;
  versionId: string;
  requestStatus: ProviderWorkerZipRequestStatus;
  request: WorkerZipRequestMetadata | null;
  lastRun: { status: string; finishedAt: string | null; summary: string | null } | null;
  reviewMemo: string | null;
};

export type SubmitProviderWorkerZipRequestInput = {
  userId: string;
  clientId: string;
  packId: string;
  bytes: Uint8Array;
  originalFileName: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  storeRequest?: typeof storeWorkerZipRequest;
};

export type WithdrawProviderWorkerZipRequestInput = {
  userId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  deleteRequest?: typeof deleteWorkerZipRequest;
};

export type AcceptAdminWorkerZipRequestInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
};

export type RejectAdminWorkerZipRequestInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  reason: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  markRejected?: typeof markWorkerZipRequestRejected;
};

export type CancelAdminWorkerZipRejectionInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  clearRejection?: typeof clearWorkerZipRequestRejection;
};

export type AcknowledgeProviderWorkerZipRejectionInput = {
  userId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  acknowledgeRejection?: typeof acknowledgeWorkerZipRequestRejection;
};

export type GetProviderWorkerZipRequestStateInput = {
  userId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
};
