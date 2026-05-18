import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prisma `TaskExecutionRun`에 컬럼이 추가되었으나 DB가 뒤처진 경우 P2022.
 * 한국어 PostgreSQL 메시지는 meta.column 이 `칼럼`처럼 보일 수 있다.
 */
const TASK_EXECUTION_RUN_ADD_COLUMNS_IF_NOT_EXISTS: readonly string[] = [
  // 20260402180000_task_execution_run_completed_at
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)`,
  // 20260403120000_task_execution_run_merge_fields
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "mergeCommitSha" TEXT`,
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "mergedAt" TIMESTAMP(3)`,
  // 20260403140000_task_execution_run_env_test_branch_deleted
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestRemoteBranchDeletedAt" TIMESTAMP(3)`,
  // 20260403150000_task_execution_run_env_test_merge_blocked_reason
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestMergeBlockedReason" TEXT`,
  // 20260403160000_task_execution_run_env_test_merge_started_at
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestMergeStartedAt" TIMESTAMP(3)`,
  // AI Team Execution Runtime (teamExecutionStatus)
  `ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "teamExecutionStatus" TEXT`,
];

let columnsReadyCache = false;

export async function ensureTaskExecutionRunColumnsInDb(): Promise<void> {
  for (const sql of TASK_EXECUTION_RUN_ADD_COLUMNS_IF_NOT_EXISTS) {
    await prisma.$executeRawUnsafe(sql);
  }
}

/** 성공 시 프로세스 내 1회만 ALTER (이후는 no-op 캐시). */
export async function ensureTaskExecutionRunColumnsReady(): Promise<void> {
  if (columnsReadyCache) return;
  await ensureTaskExecutionRunColumnsInDb();
  columnsReadyCache = true;
}

function isTaskExecutionRunP2022(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

export async function withTaskExecutionRunSchemaHealRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!isTaskExecutionRunP2022(e)) throw e;
    columnsReadyCache = false;
    await ensureTaskExecutionRunColumnsInDb();
    columnsReadyCache = true;
    return await run();
  }
}
