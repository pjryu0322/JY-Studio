import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { canAccessPlatformAdminConsole } from "@/lib/admin/platformAdmin";
import { listMergedPlatformAiMembers } from "@/lib/server/platformAiMembersMerged";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true, email: true },
    });
    if (!actor || !canAccessPlatformAdminConsole(actor.globalRole, actor.email)) {
      return NextResponse.json({ success: false, message: "플랫폼 관리자만 접근할 수 있습니다." }, { status: 403 });
    }

    const members = await listMergedPlatformAiMembers();
    return NextResponse.json({ success: true, data: { members } });
  } catch (error) {
    console.error("GET /api/admin/platform-ai-members error:", error);
    return NextResponse.json({ success: false, message: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
