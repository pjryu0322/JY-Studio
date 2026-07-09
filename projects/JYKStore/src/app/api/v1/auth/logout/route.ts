import { NextResponse } from "next/server";
import { clearAuthSessionCookie } from "@/lib/auth-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  return clearAuthSessionCookie(response);
}
