import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { isPrismaPlatformUserColumnMismatch } from "@/lib/prisma/userPlatformFieldsCompat";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

/**
 * 플랫폼에 가입된 사용자 검색(멤버 초대용). 이메일·이름 부분 일치.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const q = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "15");
    const limit = Number.isFinite(limitRaw) ? Math.min(30, Math.max(1, limitRaw)) : 15;

    if (q.length < 2) {
      return NextResponse.json({ success: true, message: "검색어를 2자 이상 입력하세요.", data: [] });
    }

    const baseOrLegacy = [
      { email: { contains: q, mode: "insensitive" as const } },
      { name: { contains: q, mode: "insensitive" as const } },
    ];
    const baseOrFull = [
      ...baseOrLegacy,
      { nickname: { contains: q, mode: "insensitive" as const } },
    ];

    let rows: { id: string; email: string; name: string; nickname?: string | null; createdAt: Date; updatedAt: Date }[];
    try {
      rows = await prisma.user.findMany({
        where: {
          AND: [{ id: { not: userId } }, { accountStatus: "ACTIVE" }, { OR: baseOrFull }],
        },
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { email: "asc" }],
        select: { id: true, email: true, name: true, nickname: true, createdAt: true, updatedAt: true },
      });
    } catch (e) {
      if (!isPrismaPlatformUserColumnMismatch(e)) throw e;
      rows = await prisma.user.findMany({
        where: {
          AND: [{ id: { not: userId } }, { OR: baseOrLegacy }],
        },
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { email: "asc" }],
        select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
      });
    }

    const data = rows.map((r) => {
      const nick = (r as { nickname?: string | null }).nickname ?? null;
      return { ...r, nickname: nick, displayName: platformUserDisplayName(nick, r.name) };
    });

    return NextResponse.json({
      success: true,
      message: "검색 결과입니다.",
      data,
    });
  } catch (error) {
    console.error("GET /api/platform/users/search error:", error);
    return NextResponse.json(
      { success: false, message: "사용자 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
