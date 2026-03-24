import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  sessionCookieBaseOptions,
  signSessionToken,
} from "@/lib/auth/session";

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

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, globalRole: true, passwordHash: true, createdAt: true },
  });
  if (!user) {
    return fail("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return fail("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  }

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
      globalRole: user.globalRole,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
