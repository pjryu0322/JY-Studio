import { NextRequest, NextResponse } from "next/server";
import { serializeAiMemberActionRow } from "@/lib/ai-member/aiMemberActionApiSerialize";
import { parseAiMemberActionExecutionMode, parseAiMemberActionStatus } from "@/lib/ai-member/aiMemberActionTypes";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  AiMemberActionValidationError,
  failAiMemberAction,
  completeAiMemberAction,
  runStubPipelineForUser,
  updateAiMemberActionStatus,
} from "@/lib/service/aiMemberActionService";

type PatchBody = {
  status?: string;
  resultPayload?: unknown;
  errorMessage?: string | null;
  executionMode?: string | null;
  /** true이면 StubExecutor + ingestion + 감사 파이프라인 */
  runStub?: boolean;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ actionId: string }> }
) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    const { actionId } = await context.params;
    const body = (await request.json()) as PatchBody;

    if (body.runStub === true) {
      const row = await runStubPipelineForUser(actionId, userId);
      return NextResponse.json({ success: true, data: serializeAiMemberActionRow(row) });
    }

    const status = body.status ? parseAiMemberActionStatus(body.status) : null;
    if (!status) {
      return NextResponse.json(
        { success: false, message: "유효한 status가 필요합니다(runStub 또는 status)." },
        { status: 400 }
      );
    }

    const executionMode = body.executionMode ? parseAiMemberActionExecutionMode(body.executionMode) : undefined;

    if (status === "DONE") {
      const row = await completeAiMemberAction({
        actionId,
        actorUserId: userId,
        resultPayload: body.resultPayload ?? undefined,
      });
      return NextResponse.json({ success: true, data: serializeAiMemberActionRow(row) });
    }

    if (status === "FAILED") {
      const msg = String(body.errorMessage ?? "").trim() || "처리 실패";
      const row = await failAiMemberAction({
        actionId,
        actorUserId: userId,
        errorMessage: msg,
        resultPayload: body.resultPayload ?? undefined,
      });
      return NextResponse.json({ success: true, data: serializeAiMemberActionRow(row) });
    }

    const row = await updateAiMemberActionStatus({
      actionId,
      actorUserId: userId,
      status,
      resultPayload: body.resultPayload ?? undefined,
      errorMessage: body.errorMessage ?? undefined,
      executionMode,
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
    console.error("PATCH /api/ai-member-actions/[actionId] error:", error);
    return NextResponse.json(
      { success: false, message: "액션 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
