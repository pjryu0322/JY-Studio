import type { KnowledgePackFile } from "@prisma/client";
import {
  projectDoclingJsonStream,
  shouldUseDoclingJsonStreamProjector,
} from "@/lib/adapters/docling/docling-json-stream-projector";
import {
  MARKDOWN_FULL_BUFFER_MAX_BYTES,
  MARKDOWN_PREVIEW_MAX_BYTES,
  resolveMaxMarkdownBytes,
  validateDoclingMarkdown,
  validateDoclingMarkdownPreview,
  type MarkdownValidationResult,
} from "@/lib/adapters/docling/docling-markdown-validator";
import type {
  AdapterValidationResult,
  DoclingDocument,
} from "@/lib/adapters/docling/docling-types";
import {
  validateDoclingJson,
  validateDoclingParsedDocument,
} from "@/lib/adapters/docling/docling-validator";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";
import { getDoclingUploadPolicy } from "@/lib/docling-import/docling-upload-policy";
import { detectFileSignature } from "@/lib/docling-import/file-signature-detector";
import { sha256Hex, sha256HexFromStream } from "@/lib/object-storage/checksum";
import type {
  ObjectStorageBackend,
  PayloadStorage,
} from "@/lib/object-storage/object-storage";
import {
  detectFileSignatureFromSamples,
  sha256HexAndHeadFromStream,
  SOURCE_SIGNATURE_FULL_BUFFER_MAX_BYTES,
  streamMarkdownPreviewFromReadable,
} from "@/lib/object-storage/stream-object-helpers";

export type BundleValidationLoadResult = {
  document: DoclingDocument | undefined;
  jsonIssues: AdapterValidationResult["issues"];
  originMatch: AdapterValidationResult["originMatch"];
  markdown: MarkdownValidationResult;
  markdownPreviewText: string;
};

function asObjectStorage(storage: PayloadStorage): ObjectStorageBackend | null {
  const candidate = storage as PayloadStorage & Partial<ObjectStorageBackend>;
  if (typeof candidate.getObjectStream === "function") {
    return candidate as ObjectStorageBackend;
  }
  return null;
}

function assertChecksum(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new DoclingImportError(
      "DOCLING_OBJECT_INTEGRITY_FAILED",
      "파일 무결성 검증에 실패했습니다.",
      503,
    );
  }
}

async function openStream(storage: ObjectStorageBackend, file: KnowledgePackFile) {
  try {
    return await storage.getObjectStream({ objectKey: file.storageKey });
  } catch {
    throw new DoclingImportError(
      "DOCLING_STORAGE_UNAVAILABLE",
      "저장소에서 파일을 읽지 못했습니다.",
      503,
    );
  }
}

async function readAllFromStream(
  body: NodeJS.ReadableStream,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk, "utf8"));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Load + verify source/json/markdown for validateAndNormalizeBundle without
 * buffering large objects into memory when ObjectStorage streaming is available.
 *
 * Raw JSON objects in storage are never rewritten — only a compact in-memory
 * projection is returned for normalizeDoclingDocument.
 */
export async function loadAndValidateDoclingBundlePayloads(input: {
  storage: PayloadStorage;
  sourceFile: KnowledgePackFile;
  jsonFile: KnowledgePackFile;
  mdFile: KnowledgePackFile;
}): Promise<BundleValidationLoadResult> {
  const { storage, sourceFile, jsonFile, mdFile } = input;
  const objectStorage = asObjectStorage(storage);
  const uploadPolicy = getDoclingUploadPolicy();
  const maxMdBytes = Math.min(uploadPolicy.maxMarkdownBytes, resolveMaxMarkdownBytes());

  const sourceMeta = {
    filename: sourceFile.originalFileName,
    mimetype: sourceFile.mimeType,
    fileId: sourceFile.id,
  };

  // --- SOURCE integrity (+ light signature for large files) ---
  const sourceSize = Number(sourceFile.fileSize);
  if (objectStorage) {
    if (
      !Number.isFinite(sourceSize) ||
      sourceSize > SOURCE_SIGNATURE_FULL_BUFFER_MAX_BYTES
    ) {
      const streamed = await openStream(objectStorage, sourceFile);
      const sampled = await sha256HexAndHeadFromStream(streamed.body);
      assertChecksum(sampled.checksumSha256, sourceFile.checksumSha256);
      detectFileSignatureFromSamples({
        head: sampled.head,
        contentLength: sampled.bytesRead || sourceSize,
      });
    } else {
      const streamed = await openStream(objectStorage, sourceFile);
      const bytes = await readAllFromStream(streamed.body);
      assertChecksum(sha256Hex(bytes), sourceFile.checksumSha256);
      detectFileSignature(bytes);
    }
  } else {
    let got;
    try {
      got = await storage.get({ objectKey: sourceFile.storageKey });
    } catch {
      throw new DoclingImportError(
        "DOCLING_STORAGE_UNAVAILABLE",
        "저장소에서 파일을 읽지 못했습니다.",
        503,
      );
    }
    assertChecksum(sha256Hex(got.bytes), sourceFile.checksumSha256);
    detectFileSignature(got.bytes);
  }

  // --- JSON ---
  const jsonSize = Number(jsonFile.fileSize);
  const useJsonStream =
    Boolean(objectStorage) && shouldUseDoclingJsonStreamProjector(jsonSize);

  let document: DoclingDocument | undefined;
  let jsonIssues: AdapterValidationResult["issues"] = [];
  let originMatch: AdapterValidationResult["originMatch"];

  if (useJsonStream && objectStorage) {
    const hashStream = await openStream(objectStorage, jsonFile);
    assertChecksum(await sha256HexFromStream(hashStream.body), jsonFile.checksumSha256);

    const projectStream = await openStream(objectStorage, jsonFile);
    const projected = await projectDoclingJsonStream(projectStream.body, {
      contentLength: jsonSize,
    });
    jsonIssues = projected.issues;
    if (projected.document) {
      const schema = validateDoclingParsedDocument(
        projected.document,
        { source: sourceMeta },
        projected.issues.filter((i) => i.severity === "WARNING"),
      );
      document = schema.document;
      jsonIssues = schema.issues;
      originMatch = schema.originMatch;
    }
  } else {
    let jsonBytes: Uint8Array;
    if (objectStorage) {
      const streamed = await openStream(objectStorage, jsonFile);
      jsonBytes = await readAllFromStream(streamed.body);
      assertChecksum(sha256Hex(jsonBytes), jsonFile.checksumSha256);
    } else {
      try {
        const got = await storage.get({ objectKey: jsonFile.storageKey });
        assertChecksum(sha256Hex(got.bytes), jsonFile.checksumSha256);
        jsonBytes = got.bytes;
      } catch {
        throw new DoclingImportError(
          "DOCLING_STORAGE_UNAVAILABLE",
          "저장소에서 파일을 읽지 못했습니다.",
          503,
        );
      }
    }
    const jsonOnly = validateDoclingJson({
      json: jsonBytes,
      source: sourceMeta,
    });
    document = jsonOnly.document;
    jsonIssues = jsonOnly.issues;
    originMatch = jsonOnly.originMatch;
  }

  // --- MARKDOWN ---
  const mdSize = Number(mdFile.fileSize);
  let markdown: MarkdownValidationResult;
  let markdownPreviewText = "";

  if (
    objectStorage &&
    (!Number.isFinite(mdSize) || mdSize > MARKDOWN_FULL_BUFFER_MAX_BYTES)
  ) {
    const streamed = await openStream(objectStorage, mdFile);
    const preview = await streamMarkdownPreviewFromReadable(streamed.body, {
      maxBytes: maxMdBytes,
      previewBytes: MARKDOWN_PREVIEW_MAX_BYTES,
    });
    assertChecksum(preview.checksumSha256, mdFile.checksumSha256);
    markdownPreviewText = preview.textPreview;
    markdown = validateDoclingMarkdownPreview({
      textPreview: preview.textPreview,
      encodingOk: preview.encodingOk,
      empty: preview.empty,
      byteLength: preview.bytesRead,
      maxBytes: maxMdBytes,
      document,
    });
  } else {
    let mdBytes: Uint8Array;
    if (objectStorage) {
      const streamed = await openStream(objectStorage, mdFile);
      mdBytes = await readAllFromStream(streamed.body);
      assertChecksum(sha256Hex(mdBytes), mdFile.checksumSha256);
    } else {
      try {
        const got = await storage.get({ objectKey: mdFile.storageKey });
        assertChecksum(sha256Hex(got.bytes), mdFile.checksumSha256);
        mdBytes = got.bytes;
      } catch {
        throw new DoclingImportError(
          "DOCLING_STORAGE_UNAVAILABLE",
          "저장소에서 파일을 읽지 못했습니다.",
          503,
        );
      }
    }
    markdown = validateDoclingMarkdown({
      markdown: mdBytes,
      document,
      maxBytes: maxMdBytes,
    });
    markdownPreviewText =
      markdown.text ??
      new TextDecoder("utf-8").decode(
        mdBytes.subarray(0, Math.min(mdBytes.byteLength, MARKDOWN_PREVIEW_MAX_BYTES)),
      );
  }

  return {
    document,
    jsonIssues,
    originMatch,
    markdown,
    markdownPreviewText,
  };
}

export { asObjectStorage, MARKDOWN_PREVIEW_MAX_BYTES as DOCLING_MARKDOWN_PREVIEW_MAX_BYTES };
