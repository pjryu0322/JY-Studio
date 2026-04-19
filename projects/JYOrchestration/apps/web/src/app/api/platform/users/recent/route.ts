import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";

/**
 * 멤버 초대 모달 기본 목록: 본인 제외, 가입일 최신순 상위 N명.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw) ? Math.min(30, Math.max(1, limitRaw)) : 10;

    const rows = await prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      message: "최근 사용자 목록입니다.",
      data: rows,
    });
  } catch (error) {
    console.error("GET /api/platform/users/recent error:", error);
    return NextResponse.json(
      { success: false, message: "사용자 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
