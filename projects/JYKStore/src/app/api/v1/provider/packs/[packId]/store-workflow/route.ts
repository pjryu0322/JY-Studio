import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import {
  confirmProviderStoreReview,
  resolveStoreWorkflowMarkers,
  withdrawProviderStoreReview,
} from "@/lib/store-workflow-markers";
import { logSafeRouteError } from "@/lib/safe-logging";
import { getProviderPackForClient } from "@/lib/provider-pack/provider-pack-query-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;

  const { packId } = await context.params;
  const trimmed = packId?.trim() ?? "";
  const pack = await getProviderPackForClient(userId, clientId, trimmed);
  if (!pack) {
    return jsonWithClientIdCookie(
      { error: { code: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." } },
      clientId,
      { status: 404 },
    );
  }

  const markers = await resolveStoreWorkflowMarkers(trimmed);
  return jsonWithClientIdCookie(
    { ok: true, clientId, packId: trimmed, ...markers },
    clientId,
    { status: 200 },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId, userId } = auth;

  const { packId } = await context.params;
  const trimmed = packId?.trim() ?? "";

  try {
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      changesRequest?: {
        changeType?: string;
        targetKind?: string;
        targetLabel?: string;
        details?: string;
      };
    } | null;
    const action = body?.action?.trim();

    const pack = await getProviderPackForClient(userId, clientId, trimmed);
    if (!pack) {
      return jsonWithClientIdCookie(
        { error: { code: "NOT_FOUND", message: "지식팩을 찾을 수 없습니다." } },
        clientId,
        { status: 404 },
      );
    }

    if (action === "confirm") {
      const result = await confirmProviderStoreReview({
        packId: trimmed,
        clientId,
      });
      if (!result.ok) {
        return jsonWithClientIdCookie(
          { ok: false, error: result.error, message: result.message },
          clientId,
          { status: 409 },
        );
      }
      return jsonWithClientIdCookie(
        { ok: true, clientId, packId: trimmed, providerReviewPhase: "CONFIRMED" },
        clientId,
        { status: 200 },
      );
    }

    if (action === "withdraw") {
      const cr = body?.changesRequest;
      const changesRequest =
        cr && typeof cr.details === "string"
          ? {
              changeType: (cr.changeType ?? "OTHER") as
                | "STRUCTURE"
                | "MISSING"
                | "CHUNKING"
                | "RETRIEVAL"
                | "OTHER",
              targetKind: (cr.targetKind ?? "OTHER") as
                | "FILE"
                | "SECTION"
                | "KU"
                | "CHUNK"
                | "QUERY"
                | "OTHER",
              targetLabel: cr.targetLabel,
              details: cr.details,
            }
          : undefined;
      const result = await withdrawProviderStoreReview({
        packId: trimmed,
        clientId,
        changesRequest,
      });
      if (!result.ok) {
        return jsonWithClientIdCookie(
          { ok: false, error: result.error, message: result.message },
          clientId,
          { status: 409 },
        );
      }
      return jsonWithClientIdCookie(
        { ok: true, clientId, packId: trimmed, providerReviewPhase: "WITHDRAWN" },
        clientId,
        { status: 200 },
      );
    }

    return jsonWithClientIdCookie(
      { ok: false, error: "INVALID_ACTION", message: "action은 confirm 또는 withdraw 입니다." },
      clientId,
      { status: 400 },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "provider/store-workflow",
      method: "POST",
      path: "/api/v1/provider/packs/[packId]/store-workflow",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      clientId,
      { status: 500 },
    );
  }
}
