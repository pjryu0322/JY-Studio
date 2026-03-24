import { NextRequest, NextResponse } from "next/server";
import { serializeAiMemberActionRow } from "@/lib/ai-member/aiMemberActionApiSerialize";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { AiMemberActionValidationError } from "@/lib/service/aiMemberActionService";
import { applyApprovedAiMemberAction } from "@/lib/service/aiMemberActionReviewService";

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
    const row = await applyApprovedAiMemberAction(actionId, userId);
    const failed = row.applyStatus === "APPLY_FAILED";
    return NextResponse.json({
      success: !failed,
      message: failed ? "승인 결과 적용 중 오류가 발생했습니다." : undefined,
      data: serializeAiMemberActionRow(row),
    });
  } catch (error) {
    if (error instanceof AiMemberActionValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/ai-member-actions/[actionId]/apply error:", error);
    return NextResponse.json(
      { success: false, message: "적용 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
