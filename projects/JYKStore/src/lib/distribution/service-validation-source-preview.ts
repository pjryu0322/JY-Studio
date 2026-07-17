import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import type { ObjectStorage } from "@/lib/object-storage/object-storage";
import { prisma } from "@/lib/prisma";

function toWebReadable(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream) {
  if (typeof (stream as ReadableStream).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

export function parseBytesRange(
  header: string | null,
  totalSize: number,
): { start: number; end: number } | null {
  if (!header || totalSize <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return null;
  let start: number;
  let end: number;
  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : totalSize - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= totalSize) {
    return null;
  }
  end = Math.min(end, totalSize - 1);
  if (start > end) return null;
  return { start, end };
}

/**
 * Resolve SOURCE_ORIGINAL bound to a validation result item for the run's version.
 */
export async function resolveSourceOriginalForValidationResult(input: {
  packId: string;
  runId: string;
  rank: number;
}): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  fileSize: number;
  versionId: string;
}> {
  const run = await prisma.serviceValidationRun.findUnique({
    where: { id: input.runId },
  });
  if (!run || run.packId !== input.packId) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  const item = await prisma.serviceValidationResultItem.findFirst({
    where: { runId: run.id, rank: input.rank },
  });
  if (!item) {
    throw new PayloadServiceError("NOT_FOUND", "검색 결과 항목을 찾을 수 없습니다.", 404);
  }

  const file = await prisma.knowledgePackFile.findFirst({
    where: {
      packId: input.packId,
      versionId: run.versionId,
      role: "SOURCE_ORIGINAL",
      bundle: {
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!file?.storageKey) {
    throw new PayloadServiceError("NOT_FOUND", "원문 파일을 찾을 수 없습니다.", 404);
  }
  if (file.versionId !== run.versionId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "원문 파일이 검증 실행 버전과 일치하지 않습니다.",
      404,
    );
  }

  // Prefer file that matches result source document when available.
  const sourceDoc = await prisma.sourceDocument.findUnique({
    where: { id: item.sourceDocumentId },
    select: { id: true, fileName: true },
  });
  if (sourceDoc?.fileName && file.originalFileName !== sourceDoc.fileName) {
    const byName = await prisma.knowledgePackFile.findFirst({
      where: {
        packId: input.packId,
        versionId: run.versionId,
        role: "SOURCE_ORIGINAL",
        originalFileName: sourceDoc.fileName,
        bundle: {
          isActive: true,
          deletedAt: null,
          storageStatus: "ACTIVE",
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (byName?.storageKey) {
      return {
        fileId: byName.id,
        fileName: byName.originalFileName,
        mimeType: byName.mimeType || "application/pdf",
        storageKey: byName.storageKey,
        fileSize: Number(byName.fileSize),
        versionId: run.versionId,
      };
    }
  }

  return {
    fileId: file.id,
    fileName: file.originalFileName,
    mimeType: file.mimeType || "application/pdf",
    storageKey: file.storageKey,
    fileSize: Number(file.fileSize),
    versionId: run.versionId,
  };
}

export async function streamInlinePdfResponse(input: {
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  rangeHeader: string | null;
}): Promise<NextResponse> {
  if (!input.mimeType.toLowerCase().includes("pdf")) {
    throw new PayloadServiceError(
      "UNSUPPORTED_MEDIA",
      "PDF 원문만 미리볼 수 있습니다.",
      400,
    );
  }
  const storage = getConfiguredPayloadStorage() as ObjectStorage;
  if (typeof storage.getObjectStream !== "function" || typeof storage.headObject !== "function") {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "Object Storage를 사용할 수 없습니다.",
      503,
    );
  }
  const head = await storage.headObject({ objectKey: input.storageKey });
  if (!head.exists) {
    throw new PayloadServiceError("NOT_FOUND", "원문 파일을 찾을 수 없습니다.", 404);
  }
  const totalSize =
    typeof head.contentLength === "number" && head.contentLength > 0
      ? head.contentLength
      : input.fileSize;
  const range = parseBytesRange(input.rangeHeader, totalSize);
  const streamed = await storage.getObjectStream({
    objectKey: input.storageKey,
    ...(range ? { range: { start: range.start, end: range.end } } : {}),
  });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
  );
  headers.set("Cache-Control", "private, no-store");
  headers.set("Accept-Ranges", "bytes");

  if (range && (streamed.partial || streamed.contentRange)) {
    headers.set(
      "Content-Range",
      streamed.contentRange ?? `bytes ${range.start}-${range.end}/${totalSize}`,
    );
    headers.set("Content-Length", String(streamed.contentLength));
    return new NextResponse(toWebReadable(streamed.body), { status: 206, headers });
  }

  if (streamed.contentLength > 0) {
    headers.set("Content-Length", String(streamed.contentLength));
  } else if (Number.isFinite(totalSize) && totalSize > 0) {
    headers.set("Content-Length", String(totalSize));
  }
  return new NextResponse(toWebReadable(streamed.body), { status: 200, headers });
}
