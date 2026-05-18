import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { canAccessPlatformAdminConsole, normalizePlatformRole } from "@/lib/admin/platformAdmin";
import { isPrismaPlatformUserColumnMismatch } from "@/lib/prisma/userPlatformFieldsCompat";

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  accountStatus: "ACTIVE" | "SUSPENDED";
  planTier: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 플랫폼 가입 사용자 목록(읽기). 프로젝트 멤버와 별개입니다.
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
    if (!actor || !canAccessPlatformAdminConsole(actor.globalRole, actor.email)) {
      return NextResponse.json({ success: false, message: "플랫폼 사용자 관리는 관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const q = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 100;

    const whereClause = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    let rows: AdminUserRow[];
    try {
      const loaded = await prisma.user.findMany({
        where: whereClause,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          accountStatus: true,
          planTier: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      rows = loaded;
    } catch (e) {
      if (!isPrismaPlatformUserColumnMismatch(e)) throw e;
      const legacy = await prisma.user.findMany({
        where: whereClause,
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
      rows = legacy.map((r) => ({
        ...r,
        accountStatus: "ACTIVE" as const,
        planTier: "free",
        lastLoginAt: null,
      }));
    }

    const ids = rows.map((r) => r.id);
    const membershipCounts =
      ids.length === 0
        ? []
        : await prisma.projectMember.groupBy({
            by: ["userId"],
            where: { userId: { in: ids }, memberType: "HUMAN" },
            _count: { _all: true },
          });
    const projectCountByUserId = new Map<string, number>(
      membershipCounts.map((g) => [String(g.userId ?? ""), g._count._all])
    );

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        globalRole: r.globalRole,
        platformRole: normalizePlatformRole(r.globalRole),
        accountStatus: r.accountStatus,
        planTier: r.planTier,
        lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
        humanProjectCount: projectCountByUserId.get(r.id) ?? 0,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/platform-users error:", error);
    return NextResponse.json({ success: false, message: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
