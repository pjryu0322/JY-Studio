import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  buildCursorBridgeExecuteRequestFromWorkItems,
  type CursorBridgeExecuteRequest,
} from "@/lib/prototype/cursorBridgeExecution";
import { executeCursorBridgeWorkItem } from "@/lib/prototype/cursorBridgeClient";
import { ensureTargetRepositoryWorktree } from "@/lib/prototype/cursorBridgeTargetRepoGit";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { resolveDefaultGitWorkspaceCloneRoot } from "@/lib/prototype/gitRepoAutoWorkspace";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { validateWorkspaceMatchesTargetRepository } from "@/lib/prototype/workspaceTargetRepositoryValidation";
import { normalizeCursorBridgeResultForPlatform } from "@/lib/prototype/platformScmExecution";
import { prisma } from "@/lib/prisma";

/**
 * Historical route name contains cursor-bridge.
 * Runtime is Cursor API direct only (executionMode: cursor_api).
 */

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

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: EXECUTION_SETUP_SOURCE_GENERATION_SELECT,
    });
    const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);

    const readiness = evaluateExecutionSetupSourceGenerationReadiness({
      setup,
      env: process.env as Record<string, string | undefined>,
    });

    const availability = evaluateCursorExecutionAvailability({ setup });

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

    const cursorApiToken = String(setupRow?.cursorApiToken ?? "").trim();
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

    const selectedTaskId = String(body.selectedTaskId ?? "").trim();
    const workItems = Array.isArray(body.workItems) ? body.workItems : [];
    const selectedWorkItemIds = Array.isArray(body.selectedWorkItemIds)
      ? body.selectedWorkItemIds.map((id) => String(id))
      : [];
    const branchName =
      String(body.branchName ?? body.workBranch ?? "").trim() ||
      `wip/cursor/${selectedTaskId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    let workspaceRoot = context.workspaceRoot;

    if (context.workspaceRootSource === "execution_setup") {
      const workspaceMatch = await validateWorkspaceMatchesTargetRepository({
        workspacePath: workspaceRoot,
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
    } else if (context.workspaceRootSource === "git_repo_auto") {
      const cloneRootRaw = resolveDefaultGitWorkspaceCloneRoot(
        process.env as Record<string, string | undefined>,
      );
      const cloneRoot = path.isAbsolute(cloneRootRaw)
        ? cloneRootRaw
        : path.join(process.cwd(), cloneRootRaw);
      try {
        const prepared = await ensureTargetRepositoryWorktree({
          cloneRoot,
          targetRepository: context.targetRepository,
          baseBranch: context.baseBranch,
          workBranch: branchName,
        });
        workspaceRoot = prepared.workdir;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          {
            success: false,
            status: "blocked",
            message: `Git 저장소 작업공간 준비에 실패했습니다.\n사유: ${message}`,
            availability,
          },
          { status: 200 },
        );
      }
    }

    const built = buildCursorBridgeExecuteRequestFromWorkItems({
      projectId,
      selectedTaskId,
      selectedWorkItemIds,
      workItems,
      targetRepository: context.targetRepository,
      branchName,
      baseBranch: context.baseBranch,
      workspaceRoot,
      commitMessage: String(body.commitMessage ?? "").trim(),
      allowedPathGlobs: context.allowedPathGlobs,
      forbiddenPathGlobs: context.forbiddenPathGlobs,
      autoCommit: context.autoCommit,
      autoPush: false,
      autoPr: false,
      ...(context.cursorApiUrl ? { cursorApiUrl: context.cursorApiUrl } : {}),
    });

    if ("message" in built && !("prompt" in built)) {
      const blocked = built as { readonly message: string };
      return NextResponse.json({ success: false, status: "blocked", message: blocked.message }, { status: 200 });
    }

    const bridgeRequest = built as CursorBridgeExecuteRequest;
    const bridgeRequestWithAdapter: CursorBridgeExecuteRequest = {
      ...bridgeRequest,
      cursorApiUrl: readiness.context.cursorApiUrl,
      cursorApiToken,
      bridgeAdapter: "cursor_api",
    };

    const result = await executeCursorBridgeWorkItem(bridgeRequestWithAdapter, {
      cursorApiToken,
    });

    const normalizedResult = normalizeCursorBridgeResultForPlatform(result);

    return NextResponse.json({
      success: normalizedResult.ok && normalizedResult.status === "completed",
      result: normalizedResult,
      workspaceRootSource: context.workspaceRootSource,
      executionMode: "cursor_api",
      bridgeAdapter: "cursor_api",
      availability,
      scm: {
        status: "pending",
        message: "Push/PR은 플랫폼 SCM 단계에서 수행합니다.",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
