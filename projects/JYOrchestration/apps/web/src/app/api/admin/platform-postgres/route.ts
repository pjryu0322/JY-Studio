import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { canAccessPlatformAdminConsole } from "@/lib/admin/platformAdmin";
import { prisma } from "@/lib/prisma";
import {
  loadPlatformManagedPostgresConfig,
  sanitizePlatformManagedPostgresConfigForAdmin,
} from "@/lib/planning/platformManagedPostgresConfig.server";
import { testPlatformManagedPostgresAdminConnection } from "@/lib/planning/createProjectDatabaseForProject.server";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    if (!user || !canAccessPlatformAdminConsole(user.globalRole, user.email)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }
    const config = loadPlatformManagedPostgresConfig();
    return NextResponse.json({
      success: true,
      data: {
        config: sanitizePlatformManagedPostgresConfigForAdmin(config),
        envHint:
          "JYO_PLATFORM_PG_HOST, JYO_PLATFORM_PG_PORT, JYO_PLATFORM_PG_ADMIN_DATABASE, JYO_PLATFORM_PG_ADMIN_USERNAME, JYO_PLATFORM_PG_ADMIN_PASSWORD",
      },
    });
  } catch (error) {
    console.error("GET admin/platform-postgres error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    if (!user || !canAccessPlatformAdminConsole(user.globalRole, user.email)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { readonly action?: string };
    if (body.action !== "test") {
      return NextResponse.json(
        { success: false, message: "플랫폼 PostgreSQL 설정은 서버 환경 변수로 관리합니다." },
        { status: 400 },
      );
    }
    const test = await testPlatformManagedPostgresAdminConnection();
    return NextResponse.json({ success: test.ok, data: test, message: test.message });
  } catch (error) {
    console.error("POST admin/platform-postgres error:", error);
    return NextResponse.json({ success: false, message: "테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}
