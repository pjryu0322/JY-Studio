import { PackStatus } from "@prisma/client";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import type { prisma } from "@/lib/prisma";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import type {
  LegacyWorkerZipRequestRow,
  WorkerZipCompletedImportRunRow,
  WorkerZipRequestRunRow,
} from "./types";

const packSelect = {
  status: true,
  name: true,
  categoryId: true,
  category: { select: { name: true } },
  providerProfile: { select: { displayName: true } },
  versions: {
    orderBy: latestKnowledgePackVersionOrderBy,
    take: 1,
    select: { id: true, version: true },
  },
} as const;

type PrismaClient = typeof prisma;

export async function queryOpenWorkerZipRequestRuns(
  client: PrismaClient,
): Promise<WorkerZipRequestRunRow[]> {
  return client.pipelineRun.findMany({
    where: {
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS, "PASS"] },
      pack: { status: PackStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      updatedAt: true,
      status: true,
      pack: { select: packSelect },
    },
  });
}

export async function queryCompletedWorkerZipImportRuns(
  client: PrismaClient,
  excludePackIds: string[],
): Promise<WorkerZipCompletedImportRunRow[]> {
  return client.pipelineRun.findMany({
    where: {
      triggerType: "WORKER_ZIP_IMPORT",
      status: "PASS",
      pack: { status: PackStatus.DRAFT },
      ...(excludePackIds.length > 0 ? { packId: { notIn: excludePackIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      pack: { select: packSelect },
    },
  });
}

export async function queryLegacyWorkerZipRequestRuns(
  client: PrismaClient,
  packIds: string[],
): Promise<LegacyWorkerZipRequestRow[]> {
  if (packIds.length === 0) return [];
  return client.pipelineRun.findMany({
    where: {
      packId: { in: packIds },
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
    },
    orderBy: { createdAt: "asc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      updatedAt: true,
      status: true,
    },
  });
}
