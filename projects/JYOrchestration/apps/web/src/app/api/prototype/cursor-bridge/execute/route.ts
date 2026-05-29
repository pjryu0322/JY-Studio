import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  type CursorBridgeExecuteRequest,
} from "@/lib/prototype/cursorBridgeExecution";
import { executeCursorBridgeWorkItem } from "@/lib/prototype/cursorBridgeClient";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
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

    const availability = evaluateCursorExecutionAvailability({
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
          availability,
        },
        { status: 200 },
      );
    }

    const cursorApiToken = String(setup?.cursorApiToken ?? "").trim();
    if (availability.mode === "cursor_api" && !cursorApiToken) {
      return NextResponse.json(
        {
          success: false,
          status: "blocked",
          message:
            "Cursor API Token을 읽을 수 없습니다. 환경설정에서 Cursor API 키를 다시 저장해 주세요.",
          availability,
        },
        { status: 200 },
      );
    }

    if (!availability.ready) {
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
    const bridgeRequestWithAdapter: CursorBridgeExecuteRequest = {
      ...bridgeRequest,
      ...(readiness.context.cursorApiUrl
        ? { cursorApiUrl: readiness.context.cursorApiUrl }
        : {}),
      ...(availability.mode === "cursor_api" && cursorApiToken
        ? { cursorApiToken, bridgeAdapter: "cursor_api" as const }
        : availability.mode === "http_bridge"
          ? { bridgeAdapter: "http_bridge" as const }
          : availability.mode === "local_runner"
            ? { bridgeAdapter: "local_runner" as const }
            : {}),
    };

    const result = await executeCursorBridgeWorkItem(bridgeRequestWithAdapter, {
      env: process.env as Record<string, string | undefined>,
      executionMode: availability.mode,
      cursorApiToken: cursorApiToken || undefined,
      bridgeAdapter: bridgeRequestWithAdapter.bridgeAdapter,
    });

    return NextResponse.json({
      success: result.ok && result.status === "completed",
      result,
      workspaceRootSource: context.workspaceRootSource,
      executionMode: availability.mode,
      bridgeAdapter: bridgeRequestWithAdapter.bridgeAdapter ?? availability.mode,
      ...(context.workspaceRootFallbackWarning
        ? { workspaceRootFallbackWarning: context.workspaceRootFallbackWarning }
        : {}),
      availability,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
