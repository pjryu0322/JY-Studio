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
