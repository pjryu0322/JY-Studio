import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, sessionCookieBaseOptions } from "@/lib/auth/session";

export async function POST() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieBaseOptions(),
    maxAge: 0,
  });
  return NextResponse.json({ success: true, message: "로그아웃되었습니다." });
}
