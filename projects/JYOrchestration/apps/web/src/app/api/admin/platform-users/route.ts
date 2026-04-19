import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { isPlatformAdminUser } from "@/lib/admin/platformAdmin";

/**
 * 플랫폼 가입 사용자 목록(읽기 전용). 프로젝트 멤버와 별개입니다.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    if (!actor || !isPlatformAdminUser(actor.globalRole, actor.email)) {
      return NextResponse.json({ success: false, message: "플랫폼 사용자 관리는 관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const q = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 100;

    const rows = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        globalRole: r.globalRole,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/platform-users error:", error);
    return NextResponse.json({ success: false, message: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
