import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";
import { isPrismaPlatformUserColumnMismatch } from "@/lib/prisma/userPlatformFieldsCompat";
import {
  normalizeNicknameInput,
  normalizePlatformEmailInput,
  normalizePlatformLegalNameInput,
} from "@/lib/user/platformProfile";

/**
 * 플랫폼 프로필(닉네임·실명·이메일). 본인만 PATCH.
 */
export async function PATCH(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { nickname?: unknown; name?: unknown; email?: unknown };
  try {
    body = (await request.json()) as { nickname?: unknown; name?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const hasNickname = "nickname" in body;
  const hasName = "name" in body;
  const hasEmail = "email" in body;
  if (!hasNickname && !hasName && !hasEmail) {
    return NextResponse.json({ success: false, message: "nickname, name, email 중 하나 이상이 필요합니다." }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};
  if (hasNickname) {
    data.nickname = normalizeNicknameInput(body.nickname);
  }
  if (hasName) {
    const name = normalizePlatformLegalNameInput(body.name);
    if (!name) {
      return NextResponse.json({ success: false, message: "이름을 입력하세요." }, { status: 400 });
    }
    data.name = name;
  }
  if (hasEmail) {
    const email = normalizePlatformEmailInput(body.email);
    if (!email) {
      return NextResponse.json({ success: false, message: "올바른 이메일 형식이 아닙니다." }, { status: 400 });
    }
    data.email = email;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ success: false, message: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    if (isPrismaPlatformUserColumnMismatch(e)) {
      return NextResponse.json(
        { success: false, message: "DB 스키마가 맞지 않습니다. 마이그레이션을 적용한 뒤 다시 시도하세요." },
        { status: 503 }
      );
    }
    throw e;
  }

  return NextResponse.json({ success: true, message: "저장했습니다.", data: {} });
}
