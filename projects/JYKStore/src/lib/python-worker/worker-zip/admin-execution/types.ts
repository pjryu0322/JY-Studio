import { prisma } from "@/lib/prisma";
import {
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import type { WorkerZipPackResolver } from "../pack-resolvers";
import type { runProviderWorkerZipImport } from "../import-run";

export type RunAdminWorkerZipGenerationInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  requirePgvector?: boolean;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  /** @deprecated P1.1 uses Working Copy streaming; retained only for older call sites. */
  getRequestBytes?: typeof getWorkerZipRequestBytes;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  runImport?: typeof runProviderWorkerZipImport;
  resolvePack?: WorkerZipPackResolver;
  /**
   * Test hook: bypass revision lookup / Working Copy object I/O.
   * Production callers must omit this.
   */
  testOverrides?: {
    sourceRevision?: {
      id: string;
      clientId?: string | null;
      packId: string;
      versionId: string;
      revisionNo?: number;
      storageKey: string;
      checksumSha256: string;
      sizeBytes: number;
      originalFileName?: string | null;
      submittedById?: string | null;
      reason?: string | null;
      status?: "UPLOADED" | "PROCESSING" | "READY" | "REJECTED" | "SUPERSEDED";
      supersedesRevisionId?: string | null;
      createdAt?: Date;
      readyAt?: Date | null;
      supersededAt?: Date | null;
    };
    adminExcludePaths?: string[];
    skipWorkingCopyPersistence?: boolean;
  };
};

export type ResolvedAdminGenerationPack = {
  pack: { packId: string };
  version: { id: string };
};

export type OpenRequestMarker = {
  id: string;
  sourceRevisionId: string | null;
  versionId: string | null;
  status: string;
};
