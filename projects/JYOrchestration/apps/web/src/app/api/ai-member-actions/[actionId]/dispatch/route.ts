import { NextRequest, NextResponse } from "next/server";
import { serializeAiMemberActionRow } from "@/lib/ai-member/aiMemberActionApiSerialize";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  AiMemberActionValidationError,
  dispatchAiMemberActionForUser,
} from "@/lib/service/aiMemberActionService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ actionId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const { actionId } = await context.params;
    void request;
    const row = await dispatchAiMemberActionForUser(actionId, userId);
    return NextResponse.json({ success: true, data: serializeAiMemberActionRow(row) });
  } catch (error) {
    if (error instanceof AiMemberActionValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/ai-member-actions/[actionId]/dispatch error:", error);
    return NextResponse.json(
      { success: false, message: "디스패치 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
