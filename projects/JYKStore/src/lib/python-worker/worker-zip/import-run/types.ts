import type { PipelineStatus } from "@prisma/client";
import type { prisma } from "@/lib/prisma";
import type { WorkerExclusionSummary } from "@/lib/python-worker/worker-output-contract";
import type { runWorkerZipImportPipeline } from "@/lib/python-worker/worker-zip-pipeline-service";
import type { synthesizeWorkerZipSearchGeneration } from "@/lib/python-worker/worker-zip-generation-bridge";
import type { WorkerZipLogicalStage } from "@/lib/python-worker/worker-zip-pipeline-stages";
import type { resetWorkerZipSuccessorStateAfterGeneration } from "@/lib/python-worker/worker-zip-successor-reset";
import type { WorkerZipImportUserError } from "../errors";
import type { WorkerZipGenerationTransitions } from "../generation-transitions";
import type { WorkerZipPackResolver } from "../pack-resolvers";

export type ProviderWorkerZipImportResult = {
  ok: boolean;
  pipelineRunId: string;
  searchIndexGenerationId?: string;
  logicalStage: WorkerZipLogicalStage;
  pipelineStatus: PipelineStatus;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  pgvectorReflected: boolean;
  /** P7.4: read-only roll-up of files the Worker auto-excluded (advisory). */
  exclusionSummary?: WorkerExclusionSummary;
  warnings: { code: string; message: string }[];
  nextStep: "SEARCH_DATA_VALIDATION" | "RETRY";
  generationReady: boolean;
  error?: WorkerZipImportUserError;
};

export type RunProviderWorkerZipImportInput = {
  userId: string;
  clientId: string;
  packId: string;
  /** Local temp path where the route already spilled the uploaded ZIP. */
  inputZipPath: string;
  /** Admin 사전정리 제외 경로 — forwarded to the Worker pipeline. */
  adminExcludePaths?: readonly string[];
  /** P1: immutable source revision that produced this ZIP run. */
  sourceRevisionId?: string | null;
  /** P1.1: Working Copy that owns this execution's SourceDocuments. */
  workingCopyId?: string | null;
  requirePgvector?: boolean;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  /** Injectable for tests. */
  runPipeline?: typeof runWorkerZipImportPipeline;
  synthesizeGeneration?: typeof synthesizeWorkerZipSearchGeneration;
  transitions?: WorkerZipGenerationTransitions;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  /**
   * P7.3: how the caller's authority over the pack is resolved. Defaults to the
   * provider-profile ownership check. The Admin execute path injects
   * {@link resolveAdminDraftPack} so an operator can run the Worker on a DRAFT
   * request without owning the provider profile.
   */
  resolvePack?: WorkerZipPackResolver;
  /**
   * After READY: clear prior quality / confirm successor state for this version.
   * Injectable for tests.
   */
  resetSuccessorState?: typeof resetWorkerZipSuccessorStateAfterGeneration;
  /**
   * After READY + successor reset: automatic quality refresh (P4.2).
   * Injectable for tests.
   */
  refreshQuality?: typeof import("@/lib/python-worker/worker-zip-quality-refresh-service").refreshWorkerZipReviewReadiness;
  /** Inventory item id by relative path — stamped onto Worker chunks for provenance. */
  inventoryItemIdByPath?: Record<string, string>;
  /** Inventory id for provenance import gate. */
  inventoryId?: string | null;
};

export type PreparedWorkerZipImport = {
  client: typeof prisma;
  pack: { packId: string; name: string };
  version: { id: string; version: string; language: string | null };
  pipelineRunId: string;
  generationId: string;
  generationCreated: { value: boolean };
  transitions: WorkerZipGenerationTransitions;
  resetSuccessorState: typeof resetWorkerZipSuccessorStateAfterGeneration;
  refreshQuality: NonNullable<RunProviderWorkerZipImportInput["refreshQuality"]>;
  runPipeline: typeof runWorkerZipImportPipeline;
  pipelineArgs: Parameters<typeof runWorkerZipImportPipeline>[0];
};
