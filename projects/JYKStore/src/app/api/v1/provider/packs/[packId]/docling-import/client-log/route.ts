import { NextRequest } from "next/server";
import { jsonWithClientIdCookie } from "@/lib/client-identity";
import { requireProviderApiAuth } from "@/lib/provider-api-auth";
import { sanitizeLogMessage } from "@/lib/safe-logging";

type RouteContext = {
  params: Promise<{ packId: string }>;
};

/**
 * Browser → terminal breadcrumb for Docling multipart uploads.
 * Never logs URLs, credentials, or file bytes.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireProviderApiAuth(request);
  if (!auth.ok) return auth.response;
  const { clientId } = auth;
  const { packId } = await context.params;

  try {
    const body = (await request.json()) as {
      event?: string;
      level?: "info" | "warn" | "error";
      detail?: Record<string, unknown> | null;
    };
    const event = typeof body.event === "string" ? body.event.slice(0, 120) : "unknown";
    const level = body.level === "warn" || body.level === "error" ? body.level : "info";
    const detail = body.detail && typeof body.detail === "object" ? body.detail : {};
    const safeDetail: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(detail)) {
      if (/url|token|secret|password|authorization|signature/i.test(key)) continue;
      if (typeof value === "string") {
        safeDetail[key] = sanitizeLogMessage(value).slice(0, 200);
      } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
        safeDetail[key] = value;
      } else {
        safeDetail[key] = "[object]";
      }
    }
    const line = `[docling-upload] pack=${packId} event=${event} ${JSON.stringify(safeDetail)}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
    return jsonWithClientIdCookie({ ok: true }, clientId);
  } catch {
    return jsonWithClientIdCookie({ ok: false }, clientId, { status: 400 });
  }
}
