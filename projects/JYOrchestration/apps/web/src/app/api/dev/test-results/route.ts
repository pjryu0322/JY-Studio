import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";

function latestJsonPath(): string {
  const cwd = process.cwd();
  return join(cwd, "..", "..", ".artifacts", "test-results", "latest.json");
}

/**
 * 통합 테스트 집계 결과(latest.json) 조회. 로그인 필수.
 * production 에서는 ENABLE_TEST_RESULTS_UI=true 일 때만 허용.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_RESULTS_UI !== "true") {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  const auth = await requireSessionUserId(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  void auth;

  const path = latestJsonPath();
  if (!existsSync(path)) {
    return NextResponse.json({
      success: true,
      data: null,
      message: "아직 결과 파일이 없습니다. npm run test:all 또는 test:api / test:e2e 실행 후 다시 시도하세요.",
    });
  }

  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return NextResponse.json({ success: true, data: parsed });
  } catch (e) {
    console.error("GET /api/dev/test-results read error:", e);
    return NextResponse.json(
      { success: false, message: "결과 파일을 읽는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
