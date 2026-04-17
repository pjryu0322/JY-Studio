import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";

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

    const rows = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: limit,
      orderBy: [{ email: "asc" }],
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({
      success: true,
      message: "검색 결과입니다.",
      data: rows,
    });
  } catch (error) {
    console.error("GET /api/platform/users/search error:", error);
    return NextResponse.json(
      { success: false, message: "사용자 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
