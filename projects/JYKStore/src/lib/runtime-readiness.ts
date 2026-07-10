import { prisma } from "@/lib/prisma";
import { evaluateRuntimeEnv } from "@/lib/runtime-env";
import {
  JYKSTORE_SERVICE_NAME,
  JYKSTORE_SERVICE_VERSION,
} from "@/lib/runtime-metadata";

export { JYKSTORE_SERVICE_NAME, JYKSTORE_SERVICE_VERSION } from "@/lib/runtime-metadata";

export type DatabaseProbe = {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

export type DatabaseReadiness = {
  ok: boolean;
  latencyMs: number;
  errorCode?: string;
  safeMessage?: string;
};

export type RuntimeReadiness = {
  ok: boolean;
  service: typeof JYKSTORE_SERVICE_NAME;
  version: typeof JYKSTORE_SERVICE_VERSION;
  checks: {
    env: {
      ok: boolean;
      missingRequired: string[];
      errors: string[];
      warnings: string[];
    };
    database: DatabaseReadiness;
  };
  configured: {
    databaseUrl: boolean;
    apiKeySecret: boolean;
    adminEmails: boolean;
  };
};

function missingRequiredFromEnv(envCheck: ReturnType<typeof evaluateRuntimeEnv>): string[] {
  if (!envCheck.ok) {
    return envCheck.required
      .filter((item) => item.requiredInProduction && !item.configured)
      .map((item) => item.name);
  }
  return envCheck.errors
    .filter((e) => e.startsWith("Missing required env: "))
    .map((e) => e.replace("Missing required env: ", ""));
}

export async function checkDatabaseReady(db?: DatabaseProbe): Promise<DatabaseReadiness> {
  const startedAt = Date.now();
  const client = db ?? prisma;
  try {
    await client.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorCode: "DATABASE_UNAVAILABLE",
      safeMessage: "Database probe failed",
    };
  }
}

export async function getRuntimeReadiness(db?: DatabaseProbe): Promise<RuntimeReadiness> {
  const envCheck = evaluateRuntimeEnv();
  const database = await checkDatabaseReady(db);

  const missingRequired = missingRequiredFromEnv(envCheck);
  const envOk = envCheck.ok;

  const configured = {
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    apiKeySecret: Boolean(process.env.JYKSTORE_API_KEY_SECRET?.trim()),
    adminEmails: Boolean(process.env.JYKSTORE_ADMIN_EMAILS?.trim()),
  };

  const ok = envOk && database.ok;

  return {
    ok,
    service: JYKSTORE_SERVICE_NAME,
    version: JYKSTORE_SERVICE_VERSION,
    checks: {
      env: {
        ok: envOk,
        missingRequired,
        errors: envCheck.errors,
        warnings: envCheck.warnings,
      },
      database,
    },
    configured,
  };
}
