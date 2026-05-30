import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  mapExecutionSetupPrismaRowToSourceGenerationRow,
} from "@/lib/prototype/executionSetupSourceGeneration";
import { executePlatformScmPushAndPr } from "@/lib/prototype/platformScmPushExecutor";
import { parseCodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecutionStateWire";
import { prisma } from "@/lib/prisma";

type Body = {
  readonly projectId?: string;
  readonly createPr?: boolean;
  readonly codeAgentWipExecutionV1?: unknown;
};

const EXECUTION_SETUP_SCM_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  workspacePath: true,
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
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype/platform-scm/execute");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const wip = parseCodeAgentWipExecutionV1(body.codeAgentWipExecutionV1);
    if (!wip) {
      return NextResponse.json(
        { success: false, status: "blocked", message: "Code Agent WIP 실행 상태가 필요합니다." },
        { status: 200 },
      );
    }

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId },
      select: EXECUTION_SETUP_SCM_SELECT,
    });
    const setup = mapExecutionSetupPrismaRowToSourceGenerationRow(setupRow);

    const result = await executePlatformScmPushAndPr({
      projectId,
      wip,
      setup,
      env: process.env as Record<string, string | undefined>,
      createPr: body.createPr !== false,
    });

    return NextResponse.json({
      success: result.ok,
      status: result.status,
      message: result.message,
      platformScmExecutionV1: result.platformScmExecutionV1,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      log: result.log,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
