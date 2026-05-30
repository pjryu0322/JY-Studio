import { NextRequest, NextResponse } from "next/server";

import { requireSessionUserId } from "@/lib/auth/requireSession";

import { requireProjectPermission } from "@/lib/auth/rbacGuard";

import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

import { mapExecutionSetupPrismaRowToSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";

import { executePlatformScmMerge } from "@/lib/prototype/platformScmMergeExecutor";
import { PLATFORM_SCM_MERGE_PERMISSION } from "@/lib/prototype/platformScmRouteAuth";

import { parseCodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecutionStateWire";

import { parseImplementationQualityGateResultsV1 } from "@/lib/prototype/implementationQualityGate";

import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";

import { prisma } from "@/lib/prisma";



type Body = {

  readonly projectId?: string;

  readonly autoMergeOnly?: boolean;

  readonly codeAgentWipExecutionV1?: unknown;

  readonly implementationQualityGateResultsV1?: unknown;

  readonly implementationTaskExecutionStateV1?: unknown;

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

      await requireProjectPermission(
        projectId,
        userId,
        PLATFORM_SCM_MERGE_PERMISSION,
        "POST /api/prototype/platform-scm/merge",
      );

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

    const qualityGateResults = parseImplementationQualityGateResultsV1(body.implementationQualityGateResultsV1);

    const executionState = parseImplementationTaskExecutionStateV1(body.implementationTaskExecutionStateV1);



    const result = await executePlatformScmMerge({

      projectId,

      wip,

      setup,

      qualityGateResults: qualityGateResults ?? undefined,

      executionState: executionState ?? undefined,

      autoMergeOnly: body.autoMergeOnly === true,

    });



    return NextResponse.json({

      success: result.ok,

      status: result.status,

      message: result.message,

      platformScmExecutionV1: result.platformScmExecutionV1,

      merged: result.merged,

      diffGate: result.diffGate,

      autoMergeAttempted: result.autoMergeAttempted,

      log: result.log,

    });

  } catch (e) {

    const message = e instanceof Error ? e.message : String(e);

    return NextResponse.json({ success: false, message }, { status: 500 });

  }

}

