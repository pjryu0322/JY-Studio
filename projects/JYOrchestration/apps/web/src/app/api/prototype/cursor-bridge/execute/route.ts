import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  type CursorBridgeExecuteRequest,
} from "@/lib/prototype/cursorBridgeExecution";
import { executeCursorBridgeWorkItem } from "@/lib/prototype/cursorBridgeClient";
import { getCursorBridgeAvailability, resolveCursorBridgeWorkspaceRoot } from "@/lib/prototype/cursorBridgeRuntime";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

type Body = {
  readonly projectId?: string;
  readonly selectedTaskId?: string;
  readonly selectedWorkItemIds?: readonly string[];
  readonly workItems?: readonly CursorWorkItem[];
  readonly branchName?: string;
  readonly baseBranch?: string;
  readonly commitMessage?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype/cursor-bridge/execute");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const availability = getCursorBridgeAvailability();
    if (!availability.available) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: availability.reason,
          availability,
        },
        { status: 200 },
      );
    }

    const workspaceRoot = resolveCursorBridgeWorkspaceRoot(process.env) ?? availability.workspaceRoot;
    if (!workspaceRoot) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: "Cursor Bridge workspace root가 설정되지 않았습니다.",
        },
        { status: 200 },
      );
    }

    const selectedTaskId = String(body.selectedTaskId ?? "").trim();
    const workItems = Array.isArray(body.workItems) ? body.workItems : [];
    const selectedWorkItemIds = Array.isArray(body.selectedWorkItemIds)
      ? body.selectedWorkItemIds.map((id) => String(id))
      : [];

    const built = buildCursorBridgeExecuteRequestFromWorkItems({
      projectId,
      selectedTaskId,
      selectedWorkItemIds,
      workItems,
      branchName: String(body.branchName ?? "").trim(),
      baseBranch: String(body.baseBranch ?? "main").trim() || "main",
      workspaceRoot,
      commitMessage: String(body.commitMessage ?? "").trim(),
    });

    if ("message" in built && !("prompt" in built)) {
      const blocked = built as { readonly message: string };
      return NextResponse.json({ success: false, status: "blocked", message: blocked.message }, { status: 200 });
    }

    const bridgeRequest = built as CursorBridgeExecuteRequest;
    const result = await executeCursorBridgeWorkItem(bridgeRequest);

    return NextResponse.json({
      success: result.ok && result.status === "completed",
      result,
      availability,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
