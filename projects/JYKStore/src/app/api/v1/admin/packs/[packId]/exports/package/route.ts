import { NextRequest, NextResponse } from "next/server";
import { logSafeRouteError } from "@/lib/safe-logging";
import { ensureClientId } from "@/lib/client-identity";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { buildPackageExport } from "@/lib/knowledge-export-service";

type RouteContext = { params: Promise<{ packId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;
  const { packId } = await context.params;
  const trimmed = packId?.trim() ?? "";

  try {
    const data = await buildPackageExport(trimmed);
    if (!data) {
      return NextResponse.json({ error: "지식팩을 찾을 수 없습니다." }, { status: 404 });
    }
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jykstore-${trimmed}-package.json"`,
      },
    });
  } catch (error) {
    logSafeRouteError({ scope: "admin-pack-export", method: "GET", path: "/api/v1/admin/packs/[packId]/exports/package", error });
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
