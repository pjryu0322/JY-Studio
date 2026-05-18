import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { hashPasswordResetToken } from "@/lib/auth/passwordResetToken";
import { sqlCompletePasswordReset, sqlFindActivePasswordResetByTokenHash } from "@/lib/auth/passwordResetSql";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const token = String(payload.token ?? "").trim();
  const password = String(payload.password ?? "");

  if (!token) {
    return fail("재설정 링크가 올바르지 않습니다.", 400);
  }
  if (password.length < 8) {
    return fail("비밀번호는 8자 이상이어야 합니다.", 400);
  }

  const tokenHash = hashPasswordResetToken(token);
  const row = await sqlFindActivePasswordResetByTokenHash(tokenHash);

  if (!row) {
    return fail("링크가 만료되었거나 이미 사용되었습니다. 비밀번호 재설정을 다시 요청해 주세요.", 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await sqlCompletePasswordReset({
    rowId: row.id,
    userId: row.userId,
    passwordHash,
  });

  return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다. 로그인해 주세요." });
}
