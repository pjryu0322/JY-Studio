import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { isPrismaPlatformUserColumnMismatch } from "@/lib/prisma/userPlatformFieldsCompat";
import { normalizeNicknameInput } from "@/lib/user/platformProfile";

/**
 * 플랫폼 프로필(닉네임). 본인만 PATCH.
 */
export async function PATCH(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { nickname?: unknown };
  try {
    body = (await request.json()) as { nickname?: unknown };
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  if (!("nickname" in body)) {
    return NextResponse.json({ success: false, message: "nickname 필드가 필요합니다." }, { status: 400 });
  }

  const nickname = normalizeNicknameInput(body.nickname);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { nickname },
    });
  } catch (e) {
    if (isPrismaPlatformUserColumnMismatch(e)) {
      return NextResponse.json(
        { success: false, message: "DB 스키마가 맞지 않습니다. 마이그레이션을 적용한 뒤 다시 시도하세요." },
        { status: 503 }
      );
    }
    throw e;
  }

  return NextResponse.json({ success: true, message: "닉네임을 저장했습니다.", data: { nickname } });
}
