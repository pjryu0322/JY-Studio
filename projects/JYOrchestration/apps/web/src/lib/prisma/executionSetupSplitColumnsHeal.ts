import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Prisma `ExecutionSetup` ↔ Postgres `execution_setups` uses camelCase column names
 * (same as "projectId", "gitRepoUrl"). Applies every ADD COLUMN from known migrations
 * so partially-migrated DBs stop throwing P2022.
 */
const EXECUTION_SETUP_ADD_COLUMNS_IF_NOT_EXISTS: readonly string[] = [
  // 20260328103000_execution_setup_revalidation
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "needsRevalidation" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "lastValidationError" TEXT`,
  // 20260328230000_relay_execution_policy_and_run_audit
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "gitRepoProvider" TEXT NOT NULL DEFAULT 'github'`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnRepeatedFailure" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnOutOfScopeChange" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "requireApprovalForSensitiveTasks" BOOLEAN NOT NULL DEFAULT false`,
  // 20260329120000_execution_loop_engine
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "autoAdvanceToNextTask" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "maxAutoRetriesPerTask" INTEGER NOT NULL DEFAULT 2`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnTestFailure" BOOLEAN NOT NULL DEFAULT true`,
  // 20260329180000_real_execution_layer
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidationCommands" JSONB`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "allowedPathGlobs" JSONB`,
  // 20260331200000_execution_setup_split_validation (camelCase — Prisma default)
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoConnectionOk" BOOLEAN`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidatedAt" TIMESTAMP(3)`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidationError" TEXT`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorConnectionOk" BOOLEAN`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorValidatedAt" TIMESTAMP(3)`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorValidationError" TEXT`,
  // 20260428120000_execution_setup_cursor_api_split
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiConnectionOk" BOOLEAN`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiValidatedAt" TIMESTAMP(3)`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiValidationError" TEXT`,
  // 20260402120000_execution_setup_github_token
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAccessToken" TEXT`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAccessTokenMasked" TEXT`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthConnectionOk" BOOLEAN`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthValidatedAt" TIMESTAMP(3)`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthValidationError" TEXT`,
  `ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubCapabilityValidation" JSONB`,
];

/** Wrong snake_case columns from an earlier mistaken script — merge into camelCase then drop. */
async function mergeAndDropSnakeSplitColumns(): Promise<void> {
  const snake = await prisma.$queryRaw<Array<{ attname: string }>>`
    SELECT a.attname
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'execution_setups'
      AND a.attname = 'repo_connection_ok'
      AND a.attnum > 0
      AND NOT a.attisdropped
  `;
  if (snake.length === 0) return;

  await prisma.$executeRawUnsafe(`
    UPDATE "execution_setups"
    SET
      "repoConnectionOk" = COALESCE("repoConnectionOk", "repo_connection_ok"),
      "repoValidatedAt" = COALESCE("repoValidatedAt", "repo_validated_at"),
      "repoValidationError" = COALESCE("repoValidationError", "repo_validation_error"),
      "executorConnectionOk" = COALESCE("executorConnectionOk", "executor_connection_ok"),
      "executorValidatedAt" = COALESCE("executorValidatedAt", "executor_validated_at"),
      "executorValidationError" = COALESCE("executorValidationError", "executor_validation_error")
  `);
  for (const sql of [
    `ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "repo_connection_ok"`,
    `ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "repo_validated_at"`,
    `ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "repo_validation_error"`,
    `ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "executor_connection_ok"`,
    `ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "executor_validated_at"`,
    `ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "executor_validation_error"`,
  ]) {
    await prisma.$executeRawUnsafe(sql);
  }
}

export async function ensureExecutionSetupSplitColumnsInDb(): Promise<void> {
  for (const sql of EXECUTION_SETUP_ADD_COLUMNS_IF_NOT_EXISTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  await mergeAndDropSnakeSplitColumns();
  await prisma.$executeRawUnsafe(`
    UPDATE "execution_setups"
    SET "repoConnectionOk" = true, "executorConnectionOk" = true
    WHERE "status" = 'validated'
      AND "repoConnectionOk" IS NULL
      AND "executorConnectionOk" IS NULL
  `);
}

/** P2022: missing DB column. Korean PG messages confuse Prisma meta; modelName may be missing. */
function isMissingColumnP2022(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022";
}

/**
 * Heal execution_setups schema then retry. Uses broad P2022 match because locale/meta is unreliable.
 */
export async function withExecutionSetupSchemaHealRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!isMissingColumnP2022(e)) throw e;
    await ensureExecutionSetupSplitColumnsInDb();
    return await run();
  }
}
