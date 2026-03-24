import { NextRequest, NextResponse } from "next/server";
import { serializeAiMemberActionRow } from "@/lib/ai-member/aiMemberActionApiSerialize";
import { parseAiMemberActionReviewDecision } from "@/lib/ai-member/aiMemberActionReviewTypes";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { AiMemberActionValidationError } from "@/lib/service/aiMemberActionService";
import { reviewAiMemberAction } from "@/lib/service/aiMemberActionReviewService";

type Body = { decision?: string; comment?: string | null };

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
    const body = (await request.json()) as Body;
    const decision = parseAiMemberActionReviewDecision(body.decision);
    if (!decision) {
      return NextResponse.json(
        { success: false, message: "decision은 APPROVE, REJECT, REQUEST_REVISION 중 하나여야 합니다." },
        { status: 400 }
      );
    }
    const row = await reviewAiMemberAction({
      actionId,
      reviewerUserId: userId,
      decision,
      comment: body.comment ?? null,
    });
    return NextResponse.json({ success: true, data: serializeAiMemberActionRow(row) });
  } catch (error) {
    if (error instanceof AiMemberActionValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/ai-member-actions/[actionId]/review error:", error);
    return NextResponse.json(
      { success: false, message: "검토 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
