import { NextRequest, NextResponse } from "next/server";
import { canUseTestAccountSwitcher } from "@/lib/test-account-switcher";
import { listTestAccounts } from "@/lib/test-account-service";
import { logSafeRouteError } from "@/lib/safe-logging";

export const dynamic = "force-dynamic";

function notFound() {
  return NextResponse.json(
    { error: "NOT_FOUND" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  if (!canUseTestAccountSwitcher(request)) {
    return notFound();
  }

  try {
    const accounts = await listTestAccounts();
    return NextResponse.json(
      { accounts },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logSafeRouteError({
      scope: "dev-test-accounts",
      method: "GET",
      path: "/api/v1/dev/test-accounts",
      error,
    });
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
