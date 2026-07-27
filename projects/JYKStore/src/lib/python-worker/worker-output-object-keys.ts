/**
 * Object Storage keys for ZIP Worker runs.
 * Python Worker never uploads; Store/TS Worker uses these keys.
 */

function sanitizePrefix(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

function assertSafeId(name: string, value: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid id for worker-run object key (${name})`);
  }
}

export type WorkerRunObjectKeyContext = {
  prefix: string;
  packId: string;
  packVersionId: string;
  pipelineRunId: string;
};

function runRoot(ctx: WorkerRunObjectKeyContext): string {
  assertSafeId("packId", ctx.packId);
  assertSafeId("packVersionId", ctx.packVersionId);
  assertSafeId("pipelineRunId", ctx.pipelineRunId);
  const prefix = sanitizePrefix(ctx.prefix || "payloads");
  return `${prefix}/packs/${ctx.packId}/versions/${ctx.packVersionId}/runs/${ctx.pipelineRunId}`;
}

/** packs/.../runs/{runId}/source/original.zip */
export function buildWorkerRunSourceZipObjectKey(ctx: WorkerRunObjectKeyContext): string {
  return `${runRoot(ctx)}/source/original.zip`;
}

export type WorkerRequestObjectKeyContext = {
  prefix: string;
  packId: string;
  packVersionId: string;
};

/**
 * P7.3: stable per-version key for the Provider-submitted "생성 요청" ZIP.
 *
 * Unlike the per-run source key, this is NOT tied to a pipelineRunId: the Provider
 * stores (and may replace) one requested ZIP per version, and the Admin later runs
 * the Worker against it. Re-uploading overwrites the same object.
 *
 * P1 correction-engine: new submissions also write an immutable revision key via
 * `buildWorkerSourceRevisionZipObjectKey`. The stable key remains a compatibility
 * mirror for legacy readers and lazy backfill.
 */
export function buildWorkerRequestSourceZipObjectKey(
  ctx: WorkerRequestObjectKeyContext,
): string {
  assertSafeId("packId", ctx.packId);
  assertSafeId("packVersionId", ctx.packVersionId);
  const prefix = sanitizePrefix(ctx.prefix || "payloads");
  return `${prefix}/packs/${ctx.packId}/versions/${ctx.packVersionId}/worker-request/source.zip`;
}

export type WorkerSourceRevisionObjectKeyContext = {
  prefix: string;
  packId: string;
  packVersionId: string;
  sourceRevisionId: string;
};

/** Immutable per-revision ZIP key: .../source-revisions/{revisionId}/source.zip */
export function buildWorkerSourceRevisionZipObjectKey(
  ctx: WorkerSourceRevisionObjectKeyContext,
): string {
  assertSafeId("packId", ctx.packId);
  assertSafeId("packVersionId", ctx.packVersionId);
  assertSafeId("sourceRevisionId", ctx.sourceRevisionId);
  const prefix = sanitizePrefix(ctx.prefix || "payloads");
  return `${prefix}/packs/${ctx.packId}/versions/${ctx.packVersionId}/source-revisions/${ctx.sourceRevisionId}/source.zip`;
}

/**
 * Relative path under worker-output/ (posix, no leading slash).
 * e.g. "chunks.json", "parser_artifacts/foo.json"
 */
export function buildWorkerRunOutputObjectKey(
  ctx: WorkerRunObjectKeyContext,
  relativePath: string,
): string {
  const rel = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "");
  if (!rel || rel.includes("..")) {
    throw new Error("Invalid worker-output relative path");
  }
  return `${runRoot(ctx)}/worker-output/${rel}`;
}

export function buildWorkerRunRagExportObjectKey(ctx: WorkerRunObjectKeyContext): string {
  return `${runRoot(ctx)}/exports/rag-export.zip`;
}

export const WORKER_OUTPUT_OBJECT_FILES = [
  "inventory.json",
  "normalized_documents.json",
  "normalized_documents.md",
  "chunks.json",
  "embeddings.json",
  "source_trace.json",
  "validation_report.json",
] as const;

export type WorkerOutputStoredFilePlan = {
  relativePath: string;
  objectKey: string;
  required: boolean;
};

/** Plan Object Storage uploads for a validated worker output directory. */
export function planWorkerOutputObjectKeys(
  ctx: WorkerRunObjectKeyContext,
  options?: { includeMarkdown?: boolean; parserArtifactPaths?: string[] },
): WorkerOutputStoredFilePlan[] {
  const includeMarkdown = options?.includeMarkdown !== false;
  const plans: WorkerOutputStoredFilePlan[] = [
    {
      relativePath: "inventory.json",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "inventory.json"),
      required: true,
    },
    {
      relativePath: "normalized_documents.json",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "normalized_documents.json"),
      required: true,
    },
    {
      relativePath: "chunks.json",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "chunks.json"),
      required: true,
    },
    {
      relativePath: "embeddings.json",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "embeddings.json"),
      required: true,
    },
    {
      relativePath: "source_trace.json",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "source_trace.json"),
      required: true,
    },
    {
      relativePath: "validation_report.json",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "validation_report.json"),
      required: true,
    },
  ];
  if (includeMarkdown) {
    plans.push({
      relativePath: "normalized_documents.md",
      objectKey: buildWorkerRunOutputObjectKey(ctx, "normalized_documents.md"),
      required: false,
    });
  }
  for (const art of options?.parserArtifactPaths ?? []) {
    const rel = art.replace(/\\/g, "/").replace(/^\/+/, "");
    const under = rel.startsWith("parser_artifacts/")
      ? rel
      : `parser_artifacts/${rel}`;
    plans.push({
      relativePath: under,
      objectKey: buildWorkerRunOutputObjectKey(ctx, under),
      required: false,
    });
  }
  return plans;
}
