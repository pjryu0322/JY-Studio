import { prisma } from "@/lib/prisma";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { assertEmbeddingProviderProductionReady } from "@/lib/embedding/embedding-provider-registry";
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
    payloadStorage: {
      ok: boolean;
      configured: boolean;
      bucketOk: boolean;
      errors: string[];
    };
    /** P5: embedding provider production-safety (blocks local-hash in production). */
    embeddingProvider: {
      ok: boolean;
      provider: string;
      warning?: string;
      error?: string;
    };
  };
  configured: {
    databaseUrl: boolean;
    apiKeySecret: boolean;
    adminEmails: boolean;
    payloadObjectStorage: boolean;
    anonymousDownloadSecretConfigured: boolean;
    trustedProxyConfigured: boolean;
    publicPayloadDownloadIdentityReady: boolean;
  };
};

function isTruthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

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
  const { probePayloadObjectStorage } = await import("@/lib/distribution/s3-payload-storage");
  const payloadStorage = await probePayloadObjectStorage();

  const embeddingProviderConfig = readEmbeddingProviderConfig();
  let embeddingProvider: RuntimeReadiness["checks"]["embeddingProvider"];
  try {
    const readiness = assertEmbeddingProviderProductionReady(embeddingProviderConfig);
    embeddingProvider = {
      ok: readiness.ok,
      provider: embeddingProviderConfig.provider,
      ...(readiness.warning ? { warning: readiness.warning } : {}),
    };
  } catch (error) {
    embeddingProvider = {
      ok: false,
      provider: embeddingProviderConfig.provider,
      error: isEmbeddingProviderError(error) ? error.message : "embedding provider is not production-ready.",
    };
  }

  const missingRequired = missingRequiredFromEnv(envCheck);
  const envOk = envCheck.ok;

  const configured = {
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    apiKeySecret: Boolean(process.env.JYKSTORE_API_KEY_SECRET?.trim()),
    adminEmails: Boolean(process.env.JYKSTORE_ADMIN_EMAILS?.trim()),
    payloadObjectStorage: payloadStorage.configured,
    anonymousDownloadSecretConfigured: Boolean(process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim()),
    trustedProxyConfigured: isTruthy(process.env.JYKSTORE_TRUST_PROXY),
    publicPayloadDownloadIdentityReady:
      Boolean(process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim()) &&
      isTruthy(process.env.JYKSTORE_TRUST_PROXY),
  };

  const ok = envOk && database.ok && payloadStorage.ok && embeddingProvider.ok;

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
      payloadStorage: {
        ok: payloadStorage.ok,
        configured: payloadStorage.configured,
        bucketOk: payloadStorage.bucketOk,
        errors: payloadStorage.errors,
      },
      embeddingProvider,
    },
    configured,
  };
}
