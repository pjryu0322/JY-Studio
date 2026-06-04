import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  runTaskCursorGithubVerifyWithQuickRunAdvance,
  validateTaskCursorGithubVerifyExecution,
} from "@/lib/prototype/taskCursorGithubVerifyService";
import type { TaskCursorGithubVerifyRequestBody } from "@/lib/prototype/taskCursorGithubVerifyTypes";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as TaskCursorGithubVerifyRequestBody;
    const projectId = String(body.projectId ?? "").trim();
    const execution = parseTaskCursorExecutionV1(body.execution);
    if (!projectId || !execution) {
      return NextResponse.json(
        { success: false, message: "projectId와 taskCursorExecutionV1이 필요합니다." },
        { status: 400 },
      );
    }

    const preflight = validateTaskCursorGithubVerifyExecution(execution);
    if (preflight) {
      return NextResponse.json(
        { success: false, status: preflight.status, message: preflight.message },
        { status: 200 },
      );
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canViewProject",
        "POST /api/prototype/task-cursor/verify-github",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const outcome = await runTaskCursorGithubVerifyWithQuickRunAdvance({
      projectId,
      body,
      execution,
    });

    if (outcome.kind === "blocked") {
      return NextResponse.json(
        { success: false, status: outcome.status ?? "blocked", message: outcome.message },
        { status: 200 },
      );
    }

    return NextResponse.json({
      success: outcome.verify.ok,
      status: outcome.execution.status,
      verify: outcome.verify,
      execution: outcome.execution,
      orchestrationPatch: outcome.orchestrationPatch,
      nextQuickRunDispatch: outcome.advance.nextDispatch,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
