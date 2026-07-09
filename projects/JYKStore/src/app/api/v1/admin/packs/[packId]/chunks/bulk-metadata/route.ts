import { NextRequest } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { bulkUpdateChunkMetadata } from "@/lib/chunk-pipeline-service";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import type { BulkMetadataMode } from "@/lib/chunk-pipeline-dto";
import { rejectUnlessAdminOps } from "@/lib/admin-route-guard";

type RouteContext = { params: Promise<{ packId: string }> };

async function parseJsonBody(request: NextRequest) {
  try {
    return (await request.json()) as {
      chunkIds?: unknown;
      mode?: unknown;
      metadata?: Record<string, unknown> | null;
    };
  } catch {
    return null;
  }
}

const VALID_MODES: BulkMetadataMode[] = ["merge", "replace", "clear"];

export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = rejectUnlessAdminOps(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;

  try {
    const body = await parseJsonBody(request);
    if (!body) {
      return jsonWithClientIdCookie(
        { error: "요청 본문이 올바른 JSON이 아닙니다." },
        clientId,
        { status: 400 },
      );
    }

    if (
      !Array.isArray(body.chunkIds) ||
      body.chunkIds.length === 0 ||
      body.chunkIds.some((id) => typeof id !== "string")
    ) {
      return jsonWithClientIdCookie(
        { error: "chunkIds는 1개 이상의 문자열 배열이어야 합니다." },
        clientId,
        { status: 400 },
      );
    }

    if (typeof body.mode !== "string" || !VALID_MODES.includes(body.mode as BulkMetadataMode)) {
      return jsonWithClientIdCookie(
        { error: "mode는 merge, replace, clear 중 하나여야 합니다." },
        clientId,
        { status: 400 },
      );
    }

    const result = await bulkUpdateChunkMetadata({
      packId: packId?.trim() ?? "",
      chunkIds: body.chunkIds as string[],
      mode: body.mode as BulkMetadataMode,
      metadata: body.metadata,
    });

    if (result.error === "NOT_FOUND") {
      return jsonWithClientIdCookie({ error: "청크를 찾을 수 없습니다." }, clientId, { status: 404 });
    }
    if (result.error === "VALIDATION") {
      return jsonWithClientIdCookie({ error: result.message }, clientId, { status: 400 });
    }

    return jsonWithClientIdCookie(
      { clientId, updatedCount: result.updatedCount, summary: result.summary },
      clientId,
    );
  } catch (error) {
    logSafeRouteError({ scope: "admin-pack-chunks", method: "PATCH", path: "/api/v1/admin/packs/[packId]/chunks/bulk-metadata", error });
    return jsonWithClientIdCookie({ error: "서버 오류가 발생했습니다." }, clientId, { status: 500 });
  }
}
