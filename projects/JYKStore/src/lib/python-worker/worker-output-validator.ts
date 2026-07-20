import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  WORKER_NON_CHUNKABLE_CLASSIFICATIONS,
  WORKER_OUTPUT_REQUIRED_FILES,
  type WorkerChunk,
  type WorkerEmbedding,
  type WorkerInventoryEntry,
  type WorkerNormalizedDocument,
  type WorkerOutputBundle,
  type WorkerOutputValidationIssue,
  type WorkerOutputValidationResult,
  type WorkerSourceTrace,
  type WorkerValidationReport,
} from "@/lib/python-worker/worker-output-contract";

function issue(
  code: string,
  message: string,
  pathHint?: string,
): WorkerOutputValidationIssue {
  return pathHint ? { code, message, path: pathHint } : { code, message };
}

function parseJsonFile(filePath: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const raw = readFileSync(filePath, "utf8");
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function requireString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function loadRequiredJson(
  outputDir: string,
  fileName: string,
  errors: WorkerOutputValidationIssue[],
): unknown | null {
  const filePath = path.join(outputDir, fileName);
  if (!existsSync(filePath)) {
    errors.push(issue("MISSING_FILE", `Required worker output missing: ${fileName}`, fileName));
    return null;
  }
  const parsed = parseJsonFile(filePath);
  if (!parsed.ok) {
    errors.push(
      issue("INVALID_JSON", `Invalid JSON in ${fileName}: ${parsed.error}`, fileName),
    );
    return null;
  }
  return parsed.value;
}

function normalizeInventory(raw: unknown, errors: WorkerOutputValidationIssue[]): WorkerInventoryEntry[] {
  if (!Array.isArray(raw)) {
    errors.push(issue("INVENTORY_SHAPE", "inventory.json must be an array", "inventory.json"));
    return [];
  }
  const entries: WorkerInventoryEntry[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push(issue("INVENTORY_ENTRY", `inventory[${i}] must be an object`, "inventory.json"));
      continue;
    }
    const sourcePath = requireString(obj, "sourcePath");
    const classification = requireString(obj, "classification");
    if (!sourcePath || !classification) {
      errors.push(
        issue(
          "INVENTORY_ENTRY",
          `inventory[${i}] requires sourcePath and classification`,
          "inventory.json",
        ),
      );
      continue;
    }
    entries.push({
      ...obj,
      sourcePath,
      classification,
      sha256: typeof obj.sha256 === "string" ? obj.sha256 : undefined,
      parser: typeof obj.parser === "string" ? obj.parser : null,
    });
  }
  return entries;
}

function normalizeDocuments(
  raw: unknown,
  errors: WorkerOutputValidationIssue[],
): WorkerNormalizedDocument[] {
  if (!Array.isArray(raw)) {
    errors.push(
      issue(
        "NORMALIZED_DOCS_SHAPE",
        "normalized_documents.json must be an array",
        "normalized_documents.json",
      ),
    );
    return [];
  }
  const docs: WorkerNormalizedDocument[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push(
        issue(
          "NORMALIZED_DOC_ENTRY",
          `normalized_documents[${i}] must be an object`,
          "normalized_documents.json",
        ),
      );
      continue;
    }
    const sourcePath = requireString(obj, "sourcePath");
    if (!sourcePath) {
      errors.push(
        issue(
          "NORMALIZED_DOC_ENTRY",
          `normalized_documents[${i}] requires sourcePath`,
          "normalized_documents.json",
        ),
      );
      continue;
    }
    docs.push({
      ...obj,
      sourcePath,
      documentId: typeof obj.documentId === "string" ? obj.documentId : undefined,
      sourceType: typeof obj.sourceType === "string" ? obj.sourceType : undefined,
      title: typeof obj.title === "string" ? obj.title : undefined,
      metadata: asObject(obj.metadata) ?? undefined,
    });
  }
  return docs;
}

function normalizeChunks(raw: unknown, errors: WorkerOutputValidationIssue[]): WorkerChunk[] {
  if (!Array.isArray(raw)) {
    errors.push(issue("CHUNKS_SHAPE", "chunks.json must be an array", "chunks.json"));
    return [];
  }
  const chunks: WorkerChunk[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push(issue("CHUNK_ENTRY", `chunks[${i}] must be an object`, "chunks.json"));
      continue;
    }
    const chunkId = requireString(obj, "chunkId");
    const content = typeof obj.content === "string" ? obj.content : null;
    const sourcePath = requireString(obj, "sourcePath");
    const traceId = requireString(obj, "traceId");
    if (!chunkId || content === null || !sourcePath || !traceId) {
      errors.push(
        issue(
          "CHUNK_ENTRY",
          `chunks[${i}] requires chunkId, content, sourcePath, and traceId`,
          "chunks.json",
        ),
      );
      continue;
    }
    chunks.push({
      ...obj,
      chunkId,
      content,
      sourcePath,
      traceId,
    });
  }
  return chunks;
}

function normalizeTraces(raw: unknown, errors: WorkerOutputValidationIssue[]): WorkerSourceTrace[] {
  if (!Array.isArray(raw)) {
    errors.push(
      issue("SOURCE_TRACE_SHAPE", "source_trace.json must be an array", "source_trace.json"),
    );
    return [];
  }
  const traces: WorkerSourceTrace[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push(
        issue("SOURCE_TRACE_ENTRY", `source_trace[${i}] must be an object`, "source_trace.json"),
      );
      continue;
    }
    const traceId = requireString(obj, "traceId");
    const sourcePath = requireString(obj, "sourcePath");
    const sourceHash = requireString(obj, "sourceHash");
    const parser = requireString(obj, "parser");
    const parserVersion = requireString(obj, "parserVersion");
    if (!traceId || !sourcePath || !sourceHash || !parser || !parserVersion) {
      errors.push(
        issue(
          "SOURCE_TRACE_ENTRY",
          `source_trace[${i}] requires traceId, sourcePath, sourceHash, parser, parserVersion`,
          "source_trace.json",
        ),
      );
      continue;
    }
    traces.push({
      ...obj,
      traceId,
      sourcePath,
      sourceHash,
      parser,
      parserVersion,
      chunkId: typeof obj.chunkId === "string" ? obj.chunkId : undefined,
    });
  }
  return traces;
}

function normalizeEmbeddings(
  raw: unknown,
  errors: WorkerOutputValidationIssue[],
): WorkerEmbedding[] {
  if (!Array.isArray(raw)) {
    errors.push(issue("EMBEDDINGS_SHAPE", "embeddings.json must be an array", "embeddings.json"));
    return [];
  }
  const embeddings: WorkerEmbedding[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const obj = asObject(raw[i]);
    if (!obj) {
      errors.push(issue("EMBEDDING_ENTRY", `embeddings[${i}] must be an object`, "embeddings.json"));
      continue;
    }
    const chunkId = requireString(obj, "chunkId");
    const provider = requireString(obj, "provider");
    const model = requireString(obj, "model");
    const contentHash = requireString(obj, "contentHash");
    const dimension = obj.dimension;
    const vector = obj.vector;
    const dimensionOk =
      typeof dimension === "number" &&
      Number.isFinite(dimension) &&
      Number.isInteger(dimension) &&
      dimension > 0;
    const vectorOk = Array.isArray(vector) && vector.every((n) => typeof n === "number");
    if (!chunkId || !provider || !model || !contentHash || !dimensionOk || !vectorOk) {
      errors.push(
        issue(
          "EMBEDDING_ENTRY",
          `embeddings[${i}] requires chunkId, provider, model, contentHash, positive-integer dimension, and number[] vector`,
          "embeddings.json",
        ),
      );
      continue;
    }
    embeddings.push({
      ...obj,
      chunkId,
      provider,
      model,
      contentHash,
      dimension,
      vector: vector as number[],
      embeddingTextHash:
        typeof obj.embeddingTextHash === "string" ? obj.embeddingTextHash : undefined,
      modelRevision: typeof obj.modelRevision === "string" ? obj.modelRevision : null,
      createdAt: typeof obj.createdAt === "string" ? obj.createdAt : undefined,
    });
  }
  return embeddings;
}

function normalizeValidationReport(
  raw: unknown,
  errors: WorkerOutputValidationIssue[],
): WorkerValidationReport | null {
  const obj = asObject(raw);
  if (!obj) {
    errors.push(
      issue(
        "VALIDATION_REPORT_SHAPE",
        "validation_report.json must be an object",
        "validation_report.json",
      ),
    );
    return null;
  }
  const reportErrors = obj.errors;
  if (!Array.isArray(reportErrors)) {
    errors.push(
      issue(
        "VALIDATION_REPORT_ERRORS",
        "validation_report.errors must be an array",
        "validation_report.json",
      ),
    );
    return null;
  }
  if (!reportErrors.every((e) => typeof e === "string")) {
    errors.push(
      issue(
        "VALIDATION_REPORT_ERRORS",
        "validation_report.errors must be string[]",
        "validation_report.json",
      ),
    );
    return null;
  }
  return {
    ...obj,
    errors: reportErrors as string[],
    warnings: Array.isArray(obj.warnings)
      ? (obj.warnings.filter((w) => typeof w === "string") as string[])
      : undefined,
    status: typeof obj.status === "string" ? obj.status : undefined,
  };
}

function crossValidate(
  bundle: WorkerOutputBundle,
  errors: WorkerOutputValidationIssue[],
  warnings: WorkerOutputValidationIssue[],
): void {
  if (bundle.validationReport.errors.length > 0) {
    for (const msg of bundle.validationReport.errors) {
      errors.push(
        issue(
          "VALIDATION_REPORT_HAS_ERRORS",
          `Worker validation_report.errors: ${msg}`,
          "validation_report.json",
        ),
      );
    }
  }

  const inventoryByPath = new Map(
    bundle.inventory.map((e) => [e.sourcePath.replace(/\\/g, "/"), e]),
  );
  const inventoryPaths = new Set(inventoryByPath.keys());
  const traceById = new Map(bundle.sourceTraces.map((t) => [t.traceId, t]));
  const docPaths = new Set(
    bundle.normalizedDocuments.map((d) => d.sourcePath.replace(/\\/g, "/")),
  );

  for (const doc of bundle.normalizedDocuments) {
    const sp = doc.sourcePath.replace(/\\/g, "/");
    if (!inventoryPaths.has(sp)) {
      errors.push(
        issue(
          "DOC_SOURCE_NOT_IN_INVENTORY",
          `normalized document sourcePath not in inventory: ${doc.sourcePath}`,
          "normalized_documents.json",
        ),
      );
    }
  }

  const nonChunkable = new Set<string>(WORKER_NON_CHUNKABLE_CLASSIFICATIONS);

  for (const chunk of bundle.chunks) {
    if (!chunk.traceId) {
      errors.push(
        issue("CHUNK_MISSING_TRACE_ID", `chunk ${chunk.chunkId} missing traceId`, "chunks.json"),
      );
      continue;
    }
    if (!traceById.has(chunk.traceId)) {
      errors.push(
        issue(
          "CHUNK_TRACE_NOT_FOUND",
          `chunk ${chunk.chunkId} traceId not in source_trace.json: ${chunk.traceId}`,
          "chunks.json",
        ),
      );
    }

    const sp = chunk.sourcePath.replace(/\\/g, "/");
    if (!inventoryPaths.has(sp) && !docPaths.has(sp)) {
      errors.push(
        issue(
          "CHUNK_SOURCE_UNTRACKED",
          `chunk ${chunk.chunkId} sourcePath not traceable: ${chunk.sourcePath}`,
          "chunks.json",
        ),
      );
    }

    const inv = inventoryByPath.get(sp);
    if (inv && nonChunkable.has(inv.classification)) {
      errors.push(
        issue(
          "CHUNK_FROM_NON_CHUNKABLE",
          `chunk ${chunk.chunkId} references ${inv.classification} source: ${chunk.sourcePath}`,
          "chunks.json",
        ),
      );
    }
  }

  for (const trace of bundle.sourceTraces) {
    const sp = trace.sourcePath.replace(/\\/g, "/");
    if (!inventoryPaths.has(sp) && !docPaths.has(sp)) {
      warnings.push(
        issue(
          "TRACE_SOURCE_UNTRACKED",
          `source_trace ${trace.traceId} sourcePath not in inventory: ${trace.sourcePath}`,
          "source_trace.json",
        ),
      );
    }
  }

  const chunkIds = new Set(bundle.chunks.map((c) => c.chunkId));
  const embeddingByChunk = new Map<string, WorkerEmbedding>();
  for (const embedding of bundle.embeddings) {
    if (!chunkIds.has(embedding.chunkId)) {
      errors.push(
        issue(
          "EMBEDDING_CHUNK_NOT_FOUND",
          `embedding chunkId not in chunks.json: ${embedding.chunkId}`,
          "embeddings.json",
        ),
      );
    }
    if (embeddingByChunk.has(embedding.chunkId)) {
      errors.push(
        issue(
          "EMBEDDING_DUPLICATE_CHUNK",
          `duplicate embedding for chunkId: ${embedding.chunkId}`,
          "embeddings.json",
        ),
      );
    } else {
      embeddingByChunk.set(embedding.chunkId, embedding);
    }
    if (embedding.vector.length === 0) {
      errors.push(
        issue(
          "EMBEDDING_VECTOR_EMPTY",
          `embedding ${embedding.chunkId} vector is empty`,
          "embeddings.json",
        ),
      );
    } else if (!embedding.vector.every((n) => typeof n === "number" && Number.isFinite(n))) {
      errors.push(
        issue(
          "EMBEDDING_VECTOR_NON_FINITE",
          `embedding ${embedding.chunkId} vector has NaN/Infinity values`,
          "embeddings.json",
        ),
      );
    } else if (embedding.vector.length !== embedding.dimension) {
      errors.push(
        issue(
          "EMBEDDING_VECTOR_DIMENSION_MISMATCH",
          `embedding ${embedding.chunkId} vector length ${embedding.vector.length} != dimension ${embedding.dimension}`,
          "embeddings.json",
        ),
      );
    }
  }

  for (const chunk of bundle.chunks) {
    if (!embeddingByChunk.has(chunk.chunkId)) {
      errors.push(
        issue(
          "CHUNK_EMBEDDING_MISSING",
          `chunk ${chunk.chunkId} has no embedding in embeddings.json`,
          "embeddings.json",
        ),
      );
    }
  }
}

/**
 * Validate a Python Worker output directory against the Store import contract.
 * Does not regenerate chunks or call Docling ND knowledge builder.
 */
export function validateWorkerOutputDirectory(
  outputDir: string,
): WorkerOutputValidationResult {
  const errors: WorkerOutputValidationIssue[] = [];
  const warnings: WorkerOutputValidationIssue[] = [];

  for (const fileName of WORKER_OUTPUT_REQUIRED_FILES) {
    // presence checked in loaders below; keep loop for documentation parity
    void fileName;
  }

  const inventoryRaw = loadRequiredJson(outputDir, "inventory.json", errors);
  const docsRaw = loadRequiredJson(outputDir, "normalized_documents.json", errors);
  const chunksRaw = loadRequiredJson(outputDir, "chunks.json", errors);
  const embeddingsRaw = loadRequiredJson(outputDir, "embeddings.json", errors);
  const tracesRaw = loadRequiredJson(outputDir, "source_trace.json", errors);
  const reportRaw = loadRequiredJson(outputDir, "validation_report.json", errors);

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const inventory = normalizeInventory(inventoryRaw, errors);
  const normalizedDocuments = normalizeDocuments(docsRaw, errors);
  const chunks = normalizeChunks(chunksRaw, errors);
  const embeddings = normalizeEmbeddings(embeddingsRaw, errors);
  const sourceTraces = normalizeTraces(tracesRaw, errors);
  const validationReport = normalizeValidationReport(reportRaw, errors);

  if (!validationReport || errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const bundle: WorkerOutputBundle = {
    inventory,
    normalizedDocuments,
    chunks,
    embeddings,
    sourceTraces,
    validationReport,
  };

  crossValidate(bundle, errors, warnings);

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, bundle, warnings };
}

/** Validate an in-memory bundle (unit tests / adapters). */
export function validateWorkerOutputBundle(
  bundle: WorkerOutputBundle,
): WorkerOutputValidationResult {
  const errors: WorkerOutputValidationIssue[] = [];
  const warnings: WorkerOutputValidationIssue[] = [];
  crossValidate(bundle, errors, warnings);
  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  return { ok: true, bundle, warnings };
}
