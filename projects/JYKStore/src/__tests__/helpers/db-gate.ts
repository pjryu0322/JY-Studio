/**
 * DB gate for integration tests.
 * - Default (local unit): skip when DATABASE_URL missing/unreachable
 * - JYKSTORE_DB_TESTS=1 (CI): fail hard — never skip
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

export function ensureDatabaseUrlFromDotEnv(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env");
  if (!existsSync(envPath)) return;
  const match = readFileSync(envPath, "utf8").match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
  if (!match?.[1]) return;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env.DATABASE_URL = value;
}

ensureDatabaseUrlFromDotEnv();

export function dbTestsForced(): boolean {
  return process.env.JYKSTORE_DB_TESTS === "1";
}

export async function requirePostgres(
  t: { skip: (msg?: string) => void },
  client?: PrismaClient,
): Promise<PrismaClient | null> {
  const forced = dbTestsForced();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    if (forced) {
      throw new Error("JYKSTORE_DB_TESTS=1 requires DATABASE_URL (skip forbidden)");
    }
    t.skip("DATABASE_URL not set");
    return null;
  }
  const db = client ?? new PrismaClient({ log: ["error"] });
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return db;
  } catch (err) {
    if (!client) await db.$disconnect().catch(() => undefined);
    if (forced) {
      throw new Error(
        `JYKSTORE_DB_TESTS=1 but PostgreSQL unreachable: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    t.skip("PostgreSQL unreachable at DATABASE_URL");
    return null;
  }
}
