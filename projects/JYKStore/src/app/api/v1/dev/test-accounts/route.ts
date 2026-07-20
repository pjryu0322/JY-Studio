import { NextRequest, NextResponse } from "next/server";
import { canUseTestAccountSwitcher } from "@/lib/test-account-switcher";
import {
  listTestAccounts,
  type TestAccountDto,
} from "@/lib/test-account-service";
import { logSafeRouteError } from "@/lib/safe-logging";

export const dynamic = "force-dynamic";

export type ListTestAccountsRouteDeps = {
  listAccounts?: () => Promise<TestAccountDto[]>;
};

function notFound() {
  return NextResponse.json(
    { error: "NOT_FOUND" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

/** Third `deps` arg is test-only; Next.js only passes request (+ route context). */
export async function GET(
  request: NextRequest,
  _context?: unknown,
  deps: ListTestAccountsRouteDeps = {},
) {
  if (!canUseTestAccountSwitcher(request)) {
    return notFound();
  }

  try {
    const accounts = await (deps.listAccounts ?? listTestAccounts)();
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
