import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { prisma } from "@/lib/prisma";

/** bcrypt 바이트 제한에 맞춘 상한(과도하게 긴 입력 방지) */
const NEW_PASSWORD_MAX_LEN = 72;
const NEW_PASSWORD_MIN_LEN = 8;

export async function PATCH(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { success: false, message: "현재 비밀번호와 새 비밀번호를 모두 입력해 주세요." },
      { status: 400 },
    );
  }
  if (newPassword.length < NEW_PASSWORD_MIN_LEN) {
    return NextResponse.json(
      { success: false, message: `새 비밀번호는 ${NEW_PASSWORD_MIN_LEN}자 이상이어야 합니다.` },
      { status: 400 },
    );
  }
  if (newPassword.length > NEW_PASSWORD_MAX_LEN) {
    return NextResponse.json(
      { success: false, message: `새 비밀번호는 ${NEW_PASSWORD_MAX_LEN}자 이하여야 합니다.` },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { success: false, message: "새 비밀번호는 현재 비밀번호와 달라야 합니다." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, accountStatus: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }
  if (user.accountStatus === "SUSPENDED") {
    return NextResponse.json(
      { success: false, message: "정지된 계정은 비밀번호를 변경할 수 없습니다." },
      { status: 403 },
    );
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    return NextResponse.json({ success: false, message: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true, message: "비밀번호를 변경했습니다." });
}
