import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  type CursorBridgeExecuteRequest,
} from "@/lib/prototype/cursorBridgeExecution";
import { executeCursorBridgeWorkItem } from "@/lib/prototype/cursorBridgeClient";
import { getCursorBridgeAvailability } from "@/lib/prototype/cursorBridgeRuntime";
import { evaluateExecutionSetupSourceGenerationReadiness } from "@/lib/prototype/executionSetupSourceGeneration";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { validateWorkspaceMatchesTargetRepository } from "@/lib/prototype/workspaceTargetRepositoryValidation";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly selectedTaskId?: string;
  readonly selectedWorkItemIds?: readonly string[];
  readonly workItems?: readonly CursorWorkItem[];
  readonly branchName?: string;
  readonly workBranch?: string;
  readonly commitMessage?: string;
};

const EXECUTION_SETUP_SOURCE_GENERATION_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  workspacePath: true,
  allowedPathGlobs: true,
  autoCommit: true,
  autoPush: true,
  autoPr: true,
  cursorApiUrl: true,
  cursorApiToken: true,
  githubAccessToken: true,
} as const;

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
      select: EXECUTION_SETUP_SOURCE_GENERATION_SELECT,
    });

    const readiness = evaluateExecutionSetupSourceGenerationReadiness({
      setup,
      env: process.env as Record<string, string | undefined>,
    });

    if (!readiness.ok) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message: readiness.message,
          missing: readiness.missing,
          availability: getCursorBridgeAvailability(),
        },
        { status: 200 },
      );
    }

    const { context } = readiness;

    if (context.workspaceRootSource === "execution_setup") {
      const workspaceMatch = await validateWorkspaceMatchesTargetRepository({
        workspacePath: context.workspaceRoot,
        targetRepoFullName: context.targetRepository.repoFullName,
      });
      if (!workspaceMatch.ok) {
        return NextResponse.json(
          {
            success: false,
            status: "blocked",
            message: workspaceMatch.reason,
            actualRemote: workspaceMatch.actualRemote,
          },
          { status: 200 },
        );
      }
    }

    const selectedTaskId = String(body.selectedTaskId ?? "").trim();
    const workItems = Array.isArray(body.workItems) ? body.workItems : [];
    const selectedWorkItemIds = Array.isArray(body.selectedWorkItemIds)
      ? body.selectedWorkItemIds.map((id) => String(id))
      : [];
    const branchName =
      String(body.branchName ?? body.workBranch ?? "").trim() ||
      `wip/cursor/${selectedTaskId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const built = buildCursorBridgeExecuteRequestFromWorkItems({
      projectId,
      selectedTaskId,
      selectedWorkItemIds,
      workItems,
      targetRepository: context.targetRepository,
      branchName,
      baseBranch: context.baseBranch,
      workspaceRoot: context.workspaceRoot,
      commitMessage: String(body.commitMessage ?? "").trim(),
      allowedPathGlobs: context.allowedPathGlobs,
      forbiddenPathGlobs: context.forbiddenPathGlobs,
      autoCommit: context.autoCommit,
      autoPush: context.autoPush,
      autoPr: context.autoPr,
      ...(context.cursorApiUrl ? { cursorApiUrl: context.cursorApiUrl } : {}),
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
      workspaceRootSource: context.workspaceRootSource,
      ...(context.workspaceRootFallbackWarning
        ? { workspaceRootFallbackWarning: context.workspaceRootFallbackWarning }
        : {}),
      availability: getCursorBridgeAvailability(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
