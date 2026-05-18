import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetRawToken, hashPasswordResetToken } from "@/lib/auth/passwordResetToken";
import { sqlReplacePasswordResetTokenForUser } from "@/lib/auth/passwordResetSql";
import { trySendPasswordResetEmail } from "@/lib/auth/sendPasswordResetEmail";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

const RESET_TTL_MS = 60 * 60 * 1000;

function ok(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: true as const, message, ...extra });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const email = String((body as Record<string, unknown>).email ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, message: "이메일을 입력해 주세요." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, nickname: true, accountStatus: true },
  });

  const generic =
    "등록된 이메일이면 비밀번호 재설정 안내를 보냈습니다. 메일이 오지 않으면 스팸함을 확인하거나, 이메일 주소를 다시 확인해 주세요.";

  if (!user || user.accountStatus === "SUSPENDED") {
    return ok(generic);
  }

  const raw = generatePasswordResetRawToken();
  const tokenHash = hashPasswordResetToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await sqlReplacePasswordResetTokenForUser({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const origin = request.nextUrl.origin;
  const resetUrl = `${origin}/login/reset?token=${encodeURIComponent(raw)}`;

  const sent = await trySendPasswordResetEmail({
    to: user.email,
    resetUrl,
    displayName: platformUserDisplayName(user.nickname, user.name),
  });

  if (sent) {
    return ok(generic);
  }

  /** 메일 엔진 미설정: 브라우저에서 바로 재설정 UI로 이어진다(운영에서 Resend 등 설정 시에는 응답에 포함하지 않음). */
  return ok("이메일 발송이 설정되어 있지 않아, 바로 비밀번호 변경 화면으로 이동합니다.", { resetUrl });
}
