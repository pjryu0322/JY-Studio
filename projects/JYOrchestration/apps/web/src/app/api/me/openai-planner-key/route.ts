import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { maskOpenAiKeyForUi } from "@/lib/executionSetup/openAiKeyMask";
import { prisma } from "@/lib/prisma";

/**
 * 사용자 기본 OpenAI 키(프로토타입 AI 기획자용). 본인만 PATCH.
 */
export async function PATCH(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  let body: { defaultOpenaiApiKey?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const raw = body.defaultOpenaiApiKey;
  if (raw === undefined) {
    return NextResponse.json({ success: false, message: "defaultOpenaiApiKey 필드가 필요합니다." }, { status: 400 });
  }

  if (raw === null || raw === "") {
    await prisma.user.update({
      where: { id: userId },
      data: { defaultOpenaiApiKey: null, defaultOpenaiApiKeyMasked: null },
    });
    return NextResponse.json({
      success: true,
      message: "기본 OpenAI 키를 삭제했습니다.",
      data: { defaultOpenaiApiKeyMasked: null, hasDefaultOpenaiApiKey: false },
    });
  }

  const key = String(raw).trim();
  if (!key.startsWith("sk-")) {
    return NextResponse.json({ success: false, message: "OpenAI API 키 형식이 올바르지 않습니다." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      defaultOpenaiApiKey: key,
      defaultOpenaiApiKeyMasked: maskOpenAiKeyForUi(key),
    },
  });

  return NextResponse.json({
    success: true,
    message: "기본 OpenAI 키를 저장했습니다.",
    data: { defaultOpenaiApiKeyMasked: maskOpenAiKeyForUi(key), hasDefaultOpenaiApiKey: true },
  });
}
