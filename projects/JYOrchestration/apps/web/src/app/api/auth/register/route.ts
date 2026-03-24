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
  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  if (!name || !email) {
    return fail("이름과 이메일은 필수입니다.", 400);
  }
  if (password.length < 8) {
    return fail("비밀번호는 8자 이상이어야 합니다.", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return fail("이미 사용 중인 이메일입니다.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
    select: { id: true, email: true, name: true, globalRole: true, createdAt: true },
  });

  const token = await signSessionToken(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieBaseOptions());

  return NextResponse.json(
    {
      success: true,
      message: "회원가입되었습니다.",
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
        createdAt: user.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
