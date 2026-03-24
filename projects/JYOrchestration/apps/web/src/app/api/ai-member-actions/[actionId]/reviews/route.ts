import { NextRequest, NextResponse } from "next/server";
import { serializeAiMemberActionReviewLogEntry } from "@/lib/ai-member/aiMemberActionApiSerialize";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { AiMemberActionValidationError } from "@/lib/service/aiMemberActionService";
import { listReviewHistory } from "@/lib/service/aiMemberActionReviewService";

export async function GET(
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
    const logs = await listReviewHistory(actionId, userId);
    return NextResponse.json({
      success: true,
      data: logs.map((l) => serializeAiMemberActionReviewLogEntry(l)),
    });
  } catch (error) {
    if (error instanceof AiMemberActionValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/ai-member-actions/[actionId]/reviews error:", error);
    return NextResponse.json(
      { success: false, message: "검토 이력 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
