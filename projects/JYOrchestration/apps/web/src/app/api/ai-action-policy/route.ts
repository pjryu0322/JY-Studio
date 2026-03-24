import { NextRequest, NextResponse } from "next/server";
import {
  getProjectAiActionPolicies,
  parseProjectAiActionApprovalMode,
  parseProjectAiActionApplyMode,
  upsertProjectAiActionPolicy,
} from "@/lib/ai-member/aiMemberActionApprovalPolicy";
import { auditProjectAiActionPolicyUpdated } from "@/lib/ai-member/aiMemberActionAudit";
import { parseAiMemberActionType } from "@/lib/ai-member/aiMemberActionTypes";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { getUserProjectRole, requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/ai-action-policy");

    const data = await getProjectAiActionPolicies(projectId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/ai-action-policy error:", error);
    return NextResponse.json(
      { success: false, message: "AI 액션 정책 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

type PutBody = {
  projectId?: string;
  actionType?: string;
  approvalMode?: unknown;
  applyMode?: unknown;
};

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    const body = (await request.json()) as PutBody;
    const projectId = String(body.projectId ?? "").trim();
    const actionType = parseAiMemberActionType(body.actionType);
    const approvalMode = parseProjectAiActionApprovalMode(body.approvalMode);
    const applyMode = parseProjectAiActionApplyMode(body.applyMode);

    if (!projectId || !actionType || !approvalMode || !applyMode) {
      return NextResponse.json(
        {
          success: false,
          message: "projectId, actionType, approvalMode, applyMode가 올바르게 필요합니다.",
        },
        { status: 400 }
      );
    }

    await requireProjectPermission(projectId, userId, "canViewProject", "PUT /api/ai-action-policy");

    const role = await getUserProjectRole(projectId, userId);
    if (role !== "OWNER") {
      return NextResponse.json(
        { success: false, message: "AI 액션 정책은 OWNER만 변경할 수 있습니다." },
        { status: 403 }
      );
    }

    const row = await upsertProjectAiActionPolicy({
      projectId,
      actionType,
      approvalMode,
      applyMode,
    });

    await auditProjectAiActionPolicyUpdated({
      projectId,
      actorUserId: userId,
      actionType: row.actionType,
      approvalMode: row.approvalMode,
      applyMode: row.applyMode,
    });

    const list = await getProjectAiActionPolicies(projectId);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("PUT /api/ai-action-policy error:", error);
    return NextResponse.json(
      { success: false, message: "AI 액션 정책 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
