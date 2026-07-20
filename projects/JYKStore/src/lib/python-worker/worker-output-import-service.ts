import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { IMPORT_CHANNELS } from "@/lib/python-worker/import-channel";
import type { WorkerOutputBundle } from "@/lib/python-worker/worker-output-contract";
import {
  buildWorkerRunSourceZipObjectKey,
  planWorkerOutputObjectKeys,
  type WorkerOutputStoredFilePlan,
  type WorkerRunObjectKeyContext,
} from "@/lib/python-worker/worker-output-object-keys";
import { validateWorkerOutputDirectory } from "@/lib/python-worker/worker-output-validator";
import {
  mapWorkerZipStageToPipelineStatus,
  type WorkerZipLogicalStage,
} from "@/lib/python-worker/worker-zip-pipeline-stages";

export type WorkerOutputFileMeta = {
  relativePath: string;
  objectKey: string;
  sizeBytes: number;
  sha256: string;
  required: boolean;
  present: boolean;
};

export type WorkerOutputImportPayload = {
  importChannel: typeof IMPORT_CHANNELS.WORKER_ZIP_IMPORT;
  /** Explicit: this path must not call docling-nd-knowledge-builder. */
  regenerateChunks: false;
  packId: string;
  packVersionId: string;
  pipelineRunId: string;
  parserVersion: string | null;
  sourceZip: {
    objectKey: string;
  };
  storedFiles: WorkerOutputFileMeta[];
  /** Chunks imported as-is from worker chunks.json (source of truth). */
  chunks: WorkerOutputBundle["chunks"];
  sourceTraces: WorkerOutputBundle["sourceTraces"];
  normalizedDocuments: WorkerOutputBundle["normalizedDocuments"];
  inventory: WorkerOutputBundle["inventory"];
  validationReport: WorkerOutputBundle["validationReport"];
  pipelineStatusAfterImport: ReturnType<typeof mapWorkerZipStageToPipelineStatus>;
  logicalStage: WorkerZipLogicalStage;
  warnings: { code: string; message: string; path?: string }[];
};

export type PrepareWorkerOutputImportInput = {
  outputDir: string;
  packId: string;
  packVersionId: string;
  pipelineRunId: string;
  objectStoragePrefix: string;
  /** Optional parser_artifacts relative paths discovered by caller */
  parserArtifactPaths?: string[];
};

export type PrepareWorkerOutputImportResult =
  | { ok: true; payload: WorkerOutputImportPayload }
  | {
      ok: false;
      errors: { code: string; message: string; path?: string }[];
      warnings: { code: string; message: string; path?: string }[];
    };

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function listParserArtifacts(outputDir: string): string[] {
  const root = path.join(outputDir, "parser_artifacts");
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string, relBase: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = path.posix.join(relBase, name.replace(/\\/g, "/"));
      if (statSync(full).isDirectory()) {
        walk(full, rel);
      } else {
        out.push(rel);
      }
    }
  };
  walk(root, "parser_artifacts");
  return out;
}

function inferParserVersion(bundle: WorkerOutputBundle): string | null {
  const fromTrace = bundle.sourceTraces.find((t) => t.parserVersion)?.parserVersion;
  if (fromTrace) return fromTrace;
  for (const doc of bundle.normalizedDocuments) {
    const meta = doc.metadata;
    if (meta && typeof meta.parserVersion === "string" && meta.parserVersion.trim()) {
      return meta.parserVersion;
    }
  }
  return null;
}

function buildStoredFileMetas(
  outputDir: string,
  plans: WorkerOutputStoredFilePlan[],
): { metas: WorkerOutputFileMeta[]; missingRequired: string[] } {
  const metas: WorkerOutputFileMeta[] = [];
  const missingRequired: string[] = [];
  for (const plan of plans) {
    const full = path.join(outputDir, plan.relativePath);
    const present = existsSync(full);
    if (!present) {
      if (plan.required) missingRequired.push(plan.relativePath);
      metas.push({
        relativePath: plan.relativePath,
        objectKey: plan.objectKey,
        sizeBytes: 0,
        sha256: "",
        required: plan.required,
        present: false,
      });
      continue;
    }
    const st = statSync(full);
    metas.push({
      relativePath: plan.relativePath,
      objectKey: plan.objectKey,
      sizeBytes: st.size,
      sha256: sha256File(full),
      required: plan.required,
      present: true,
    });
  }
  return { metas, missingRequired };
}

/**
 * Validate worker output and build an import payload for Object Storage + DB reflection.
 *
 * - Does **not** regenerate chunks
 * - Does **not** call docling-nd-knowledge-builder
 * - Does **not** upload to Object Storage (caller uploads using storedFiles[].objectKey)
 */
export function prepareWorkerOutputImport(
  input: PrepareWorkerOutputImportInput,
): PrepareWorkerOutputImportResult {
  const validated = validateWorkerOutputDirectory(input.outputDir);
  if (!validated.ok) {
    return {
      ok: false,
      errors: validated.errors,
      warnings: validated.warnings,
    };
  }

  const ctx: WorkerRunObjectKeyContext = {
    prefix: input.objectStoragePrefix,
    packId: input.packId,
    packVersionId: input.packVersionId,
    pipelineRunId: input.pipelineRunId,
  };

  const artifactPaths =
    input.parserArtifactPaths ?? listParserArtifacts(input.outputDir);
  const plans = planWorkerOutputObjectKeys(ctx, {
    includeMarkdown: true,
    parserArtifactPaths: artifactPaths,
  });
  const { metas, missingRequired } = buildStoredFileMetas(input.outputDir, plans);
  if (missingRequired.length > 0) {
    return {
      ok: false,
      errors: missingRequired.map((p) => ({
        code: "MISSING_OUTPUT_FILE",
        message: `Required worker output file missing for storage: ${p}`,
        path: p,
      })),
      warnings: validated.warnings,
    };
  }

  const logicalStage: WorkerZipLogicalStage = "IMPORTED";
  const payload: WorkerOutputImportPayload = {
    importChannel: IMPORT_CHANNELS.WORKER_ZIP_IMPORT,
    regenerateChunks: false,
    packId: input.packId,
    packVersionId: input.packVersionId,
    pipelineRunId: input.pipelineRunId,
    parserVersion: inferParserVersion(validated.bundle),
    sourceZip: {
      objectKey: buildWorkerRunSourceZipObjectKey(ctx),
    },
    storedFiles: metas,
    chunks: validated.bundle.chunks,
    sourceTraces: validated.bundle.sourceTraces,
    normalizedDocuments: validated.bundle.normalizedDocuments,
    inventory: validated.bundle.inventory,
    validationReport: validated.bundle.validationReport,
    pipelineStatusAfterImport: mapWorkerZipStageToPipelineStatus(logicalStage),
    logicalStage,
    warnings: validated.warnings,
  };

  return { ok: true, payload };
}
