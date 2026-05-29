import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  type CursorBridgeExecuteRequest,
} from "@/lib/prototype/cursorBridgeExecution";
import { executeCursorBridgeWorkItem } from "@/lib/prototype/cursorBridgeClient";
import {
  getCursorBridgeAvailability,
  resolveCursorBridgeCloneRoot,
} from "@/lib/prototype/cursorBridgeRuntime";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  evaluateCursorBridgeSourceGenerationGate,
  resolveProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly selectedTaskId?: string;
  readonly selectedWorkItemIds?: readonly string[];
  readonly workItems?: readonly CursorWorkItem[];
  readonly branchName?: string;
  readonly workBranch?: string;
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

    const setup = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: {
        gitRepoName: true,
        gitRepoUrl: true,
        baseBranch: true,
      },
    });
    const targetRepository = resolveProjectTargetRepository({ projectSettings: setup });
    const availability = getCursorBridgeAvailability();
    const gate = evaluateCursorBridgeSourceGenerationGate({
      targetRepository,
      bridgeAvailable: availability.available,
      bridgeReason: availability.reason,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: gate.message,
          availability,
        },
        { status: 200 },
      );
    }

    const selectedTaskId = String(body.selectedTaskId ?? "").trim();
    const workItems = Array.isArray(body.workItems) ? body.workItems : [];
    const selectedWorkItemIds = Array.isArray(body.selectedWorkItemIds)
      ? body.selectedWorkItemIds.map((id) => String(id))
      : [];
    const workBranch =
      String(body.workBranch ?? body.branchName ?? "").trim() ||
      `wip/cursor/${selectedTaskId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const baseBranch =
      String(body.baseBranch ?? "").trim() || targetRepository!.defaultBranch || "main";
    const cloneRoot = resolveCursorBridgeCloneRoot(process.env);

    const built = buildCursorBridgeExecuteRequestFromWorkItems({
      projectId,
      selectedTaskId,
      selectedWorkItemIds,
      workItems,
      targetRepository: targetRepository!,
      workBranch,
      baseBranch,
      commitMessage: String(body.commitMessage ?? "").trim(),
      ...(availability.mode === "local_cli" && cloneRoot ? { workspaceRoot: cloneRoot } : {}),
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
