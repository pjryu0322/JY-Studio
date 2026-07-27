/**
 * GET  /api/v1/admin/packs/[packId]/worker-zip/preflight — 원본 인벤토리
 * PUT  /api/v1/admin/packs/[packId]/worker-zip/preflight — 제외 선택 저장
 */
import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import {
  getAdminWorkerZipPreflightInventory,
  saveAdminWorkerZipPreflightExclusions,
  WorkerZipPreflightError,
} from "@/lib/python-worker/worker-zip-preflight-service";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ packId: string }> };

function mapPreflightError(error: unknown, clientId: string) {
  if (error instanceof WorkerZipPreflightError) {
    return jsonWithClientIdCookie(
      { error: { code: error.code, message: error.message } },
      clientId,
      { status: error.status },
    );
  }
  return jsonWithClientIdCookie(
    { error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } },
    clientId,
    { status: 500 },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }

  const { packId } = await context.params;
  try {
    const inventory = await getAdminWorkerZipPreflightInventory({
      packId: packId?.trim() ?? "",
    });
    return jsonWithClientIdCookie({ clientId, ...inventory }, clientId, { status: 200 });
  } catch (error) {
    if (!(error instanceof WorkerZipPreflightError)) {
      logSafeRouteError({
        scope: "admin/worker-zip/preflight",
        method: "GET",
        path: `/api/v1/admin/packs/${packId}/worker-zip/preflight`,
        error,
      });
    }
    return mapPreflightError(error, clientId);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminAuth = await requireAdminSession(request, clientId);
  if (!adminAuth.ok) {
    return jsonWithClientIdCookie(
      { error: { code: adminAuth.code, message: adminAuth.message } },
      clientId,
      { status: adminAuth.status },
    );
  }

  const { packId } = await context.params;
  try {
    const body = (await request.json().catch(() => null)) as {
      paths?: unknown;
      items?: unknown;
    } | null;

    let items: { path: string; reason: string }[] | null = null;
    if (Array.isArray(body?.items)) {
      items = body!.items
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const rec = raw as Record<string, unknown>;
          if (typeof rec.path !== "string") return null;
          return {
            path: rec.path,
            reason: typeof rec.reason === "string" ? rec.reason : "",
          };
        })
        .filter((item): item is { path: string; reason: string } => item != null);
    } else if (Array.isArray(body?.paths)) {
      items = body!.paths
        .filter((p): p is string => typeof p === "string")
        .map((path) => ({ path, reason: "" }));
    }

    if (!items) {
      throw new WorkerZipPreflightError(
        "PATHS_REQUIRED",
        "제외 목록(items 또는 paths)이 필요합니다.",
        400,
      );
    }
    const saved = await saveAdminWorkerZipPreflightExclusions({
      packId: packId?.trim() ?? "",
      items,
      adminUserId: adminAuth.adminUserId,
    });
    return jsonWithClientIdCookie({ clientId, ...saved }, clientId, { status: 200 });
  } catch (error) {
    if (!(error instanceof WorkerZipPreflightError)) {
      logSafeRouteError({
        scope: "admin/worker-zip/preflight",
        method: "PUT",
        path: `/api/v1/admin/packs/${packId}/worker-zip/preflight`,
        error,
      });
    }
    return mapPreflightError(error, clientId);
  }
}
