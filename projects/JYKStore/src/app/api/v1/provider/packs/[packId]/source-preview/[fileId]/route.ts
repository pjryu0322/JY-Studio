import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import type { ObjectStorage } from "@/lib/object-storage/object-storage";
import { prisma } from "@/lib/prisma";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string; fileId: string }> };

function toWebReadable(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream) {
  if (typeof (stream as ReadableStream).getReader === "function") {
    return stream as ReadableStream<Uint8Array>;
  }
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

function parseBytesRange(
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
 * Inline PDF viewer stream for provider source preview.
 * Uses Content-Disposition: inline and supports Range when possible.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;
  const { packId, fileId } = await context.params;
  const packIdTrim = packId?.trim() ?? "";
  const fileIdTrim = fileId?.trim() ?? "";

  try {
    const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
    if (!profile) {
      throw new PayloadServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
    }
    const pack = await prisma.knowledgePack.findFirst({
      where: { packId: packIdTrim, providerProfileId: profile.id },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!pack) {
      throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }

    const file = await prisma.knowledgePackFile.findFirst({
      where: {
        id: fileIdTrim,
        packId: pack.packId,
        role: "SOURCE_ORIGINAL",
        bundle: {
          isActive: true,
          deletedAt: null,
          storageStatus: "ACTIVE",
        },
      },
    });
    if (!file?.storageKey) {
      throw new PayloadServiceError("NOT_FOUND", "원문 파일을 찾을 수 없습니다.", 404);
    }

    const mimeType = file.mimeType || "application/pdf";
    if (!mimeType.toLowerCase().includes("pdf")) {
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

    const head = await storage.headObject({ objectKey: file.storageKey });
    if (!head.exists) {
      throw new PayloadServiceError("NOT_FOUND", "원문 파일을 찾을 수 없습니다.", 404);
    }
    const totalSize =
      typeof head.contentLength === "number" && head.contentLength > 0
        ? head.contentLength
        : Number(file.fileSize);

    const range = parseBytesRange(request.headers.get("range"), totalSize);
    const streamed = await storage.getObjectStream({
      objectKey: file.storageKey,
      ...(range ? { range: { start: range.start, end: range.end } } : {}),
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
    );
    headers.set("Cache-Control", "private, no-store");
    headers.set("Accept-Ranges", "bytes");

    if (range && (streamed.partial || streamed.contentRange)) {
      const contentRange =
        streamed.contentRange ?? `bytes ${range.start}-${range.end}/${totalSize}`;
      headers.set("Content-Range", contentRange);
      headers.set("Content-Length", String(streamed.contentLength));
      return new NextResponse(toWebReadable(streamed.body), {
        status: 206,
        headers,
      });
    }

    if (streamed.contentLength > 0) {
      headers.set("Content-Length", String(streamed.contentLength));
    } else if (Number.isFinite(totalSize) && totalSize > 0) {
      headers.set("Content-Length", String(totalSize));
    }

    return new NextResponse(toWebReadable(streamed.body), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof PayloadServiceError) {
      return jsonWithClientIdCookie(
        { error: error.code, message: error.message },
        clientId,
        { status: error.httpStatus },
      );
    }
    logSafeRouteError({
      scope: "provider/source-preview/file",
      method: "GET",
      path: "/api/v1/provider/packs/[packId]/source-preview/[fileId]",
      error,
    });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, {
      status: 500,
    });
  }
}
