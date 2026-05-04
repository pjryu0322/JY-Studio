import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  sessionCookieBaseOptions,
  signSessionToken,
} from "@/lib/auth/session";
import { findUserForLogin, touchUserLastLogin } from "@/lib/prisma/userPlatformFieldsCompat";
import { platformUserDisplayName } from "@/lib/user/platformProfile";

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
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  if (!email || !password) {
    return fail("이메일과 비밀번호를 입력해 주세요.", 400);
  }

  const user = await findUserForLogin(email);
  if (!user) {
    return fail("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  if (user.accountStatus === "SUSPENDED") {
    return fail("계정이 정지되어 로그인할 수 없습니다. 관리자에게 문의하세요.", 403);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return fail("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  await touchUserLastLogin(user.id);

  const token = await signSessionToken(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieBaseOptions());

  return NextResponse.json({
    success: true,
    message: "로그인되었습니다.",
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      displayName: platformUserDisplayName(user.nickname, user.name),
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
