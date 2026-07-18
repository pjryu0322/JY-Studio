import { prisma } from "@/lib/prisma";
import { readEmbeddingProviderConfig } from "@/lib/embedding/embedding-provider-config";
import { isEmbeddingProviderError } from "@/lib/embedding/embedding-provider-errors";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
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

    // P5.1: local-e5 readiness requires pinned SHA + token + live worker probe.
    if (embeddingProviderConfig.provider === LOCAL_E5_EMBEDDING_PROVIDER) {
      const { isFullCommitSha } = await import("@/lib/embedding/e5-model-revision");
      if (!isFullCommitSha(embeddingProviderConfig.modelRevision)) {
        throw new Error(
          "JYKSTORE_EMBEDDING_MODEL_REVISION must be a 40-char Hugging Face commit SHA.",
        );
      }
      if (!embeddingProviderConfig.workerToken) {
        throw new Error("JYKSTORE_EMBEDDING_WORKER_TOKEN is required for local-e5 readiness.");
      }

      const { createLocalE5EmbeddingAdapter } = await import(
        "@/lib/embedding/local-e5-embedding-adapter"
      );
      const adapter = createLocalE5EmbeddingAdapter({
        workerBaseUrl: embeddingProviderConfig.workerUrl!,
        model: embeddingProviderConfig.model,
        dimension: embeddingProviderConfig.dimension,
        modelRevision: embeddingProviderConfig.modelRevision!,
        token: embeddingProviderConfig.workerToken,
      });
      const ready = await adapter.probeReady();
      if (ready.revision !== embeddingProviderConfig.modelRevision) {
        throw new Error("Worker resolved revision does not match configured revision.");
      }

      // Production Generation descriptors must match the current Worker descriptor.
      // Skip when a custom DatabaseProbe is injected (unit tests without Prisma models).
      // P5.1.1: scan ALL promoted local-e5 generations (no take:50 limit).
      if (!db) {
        const mismatch = await prisma.searchIndexGeneration.findFirst({
          where: {
            scope: "PRODUCTION",
            status: "PROMOTED",
            embeddingProvider: LOCAL_E5_EMBEDDING_PROVIDER,
            OR: [
              { embeddingModel: { not: ready.model } },
              { embeddingModelRevision: { not: ready.revision } },
              { embeddingDimension: { not: ready.dimension } },
              { distanceMetric: { not: "cosine" } },
            ],
          },
          select: { id: true },
        });
        if (mismatch) {
          throw new Error(
            `Production SearchIndexGeneration ${mismatch.id} descriptor does not match the live Worker.`,
          );
        }
      }

      embeddingProvider = {
        ok: true,
        provider: embeddingProviderConfig.provider,
        ...(readiness.warning ? { warning: readiness.warning } : {}),
      };
    }
  } catch (error) {
    embeddingProvider = {
      ok: false,
      provider: embeddingProviderConfig.provider,
      error: isEmbeddingProviderError(error)
        ? error.message
        : error instanceof Error
          ? error.message.slice(0, 240)
          : "embedding provider is not production-ready.",
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
