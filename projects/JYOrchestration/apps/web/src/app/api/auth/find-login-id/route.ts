import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskEmailForDisplay } from "@/lib/auth/maskEmail";

function fail(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
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
  const emailDomain = String(payload.emailDomain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  const emailLocalPrefix = String(payload.emailLocalPrefix ?? "")
    .trim()
    .toLowerCase();

  if (!name) {
    return fail("가입 시 등록한 이름을 입력해 주세요.", 400);
  }

  const rows = await prisma.user.findMany({
    where: {
      name,
      accountStatus: "ACTIVE",
    },
    select: { email: true },
  });

  const filtered = rows.filter((r) => {
    const em = r.email.toLowerCase();
    if (emailDomain && !em.endsWith(`@${emailDomain}`)) return false;
    if (emailLocalPrefix) {
      const local = em.split("@")[0] ?? "";
      if (!local.toLowerCase().startsWith(emailLocalPrefix.toLowerCase())) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return fail("입력하신 정보와 일치하는 계정을 찾을 수 없습니다.", 404);
  }

  if (filtered.length > 1) {
    return fail(
      "동일한 이름으로 가입된 이메일이 여러 개입니다. 기억나는 이메일 앞부분(@ 앞)과 도메인(@ 뒤, 예: gmail.com)을 함께 입력한 뒤 다시 조회해 주세요.",
      409,
      { code: "AMBIGUOUS" }
    );
  }

  return NextResponse.json({
    success: true,
    message: "가입 시 사용한 이메일(로그인 ID)은 아래와 같습니다.",
    data: { maskedEmail: maskEmailForDisplay(filtered[0].email) },
  });
}
