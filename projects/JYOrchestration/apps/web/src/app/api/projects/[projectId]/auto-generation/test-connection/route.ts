import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { sanitizeGithubPatForStorage } from "@/lib/integration/githubPatIntegrity";
import {
  mergeCapabilityWithConnectionTest,
  type AutoGenerationSettingsConnectionTestResultV1,
} from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";
import { runAutoGenerationTestConnectionForProject } from "@/lib/prototype/autoGenerationTestConnectionService";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";

const SETUP_SELECT = {
  gitRepoUrl: true,
  gitRepoName: true,
  gitRepoProvider: true,
  baseBranch: true,
  githubAccessToken: true,
  cursorApiToken: true,
  repoConnectionOk: true,
  githubAuthConnectionOk: true,
  cursorApiConnectionOk: true,
  githubCapabilityValidation: true,
  hasGithubAccessToken: true,
  hasCursorToken: true,
} as const;

function jsonWithConnectionTest(
  result: AutoGenerationSettingsConnectionTestResultV1,
  input: { readonly success: boolean; readonly httpStatus?: number },
) {
  return NextResponse.json(
    {
      success: input.success,
      ok: result.level === "ready",
      autoGenerationReady: result.autoGenerationReady,
      previewDeploymentReady: result.previewDeploymentReady,
      level: result.level,
      data: result,
      basicConnection: result.basicConnection,
      envcheck: result.envcheck,
      previewDeploymentPreflight: result.previewDeploymentPreflight,
      sectionSummaries: result.sectionSummaries,
      message: result.userSummary,
    },
    { status: input.httpStatus ?? 200 },
  );
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await segmentData.params;
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canEditProject",
        "POST /api/projects/[projectId]/auto-generation/test-connection",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await prisma.executionSetup.findUnique({
      where: { projectId: pid },
      select: SETUP_SELECT,
    });
    if (!row) {
      const normalized = normalizeAutoGenerationConnectionTestResult({
        checkedAt: new Date().toISOString(),
      });
      return jsonWithConnectionTest(normalized, { success: false, httpStatus: 404 });
    }

    console.info(JSON.stringify({ action: "envcheck_connection_test_started", projectId: pid }));

    const cap = (row.githubCapabilityValidation as GithubCapabilityValidationSnapshot | null) ?? null;
    const tok = sanitizeGithubPatForStorage(String(row.githubAccessToken ?? ""));

    const body = (await request.json().catch(() => ({}))) as {
      readonly includePreviewPreflight?: boolean;
    };
    const includePreviewPreflight = body?.includePreviewPreflight === true;

    let result: AutoGenerationSettingsConnectionTestResultV1;
    if (!tok) {
      result = normalizeAutoGenerationConnectionTestResult({
        executionSetupForBasic: {
          ...row,
          hasGithubAccessToken: false,
          hasCursorToken: Boolean(String(row.cursorApiToken ?? "").trim()),
        } as never,
        checkedAt: new Date().toISOString(),
      });
    } else {
      result = await runAutoGenerationTestConnectionForProject({
        projectId: pid,
        viewerUserId: userId,
        executionSetup: {
          ...row,
          hasGithubAccessToken: true,
          hasCursorToken: Boolean(String(row.cursorApiToken ?? "").trim()),
        } as never,
        capabilitySnapshot: cap,
        includePreviewPreflight,
      });
    }

    const mergedCap = mergeCapabilityWithConnectionTest((cap ?? {}) as Record<string, unknown>, result);

    await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.update({
        where: { projectId: pid },
        data: { githubCapabilityValidation: mergedCap as Prisma.InputJsonValue },
      }),
    );

    console.info(
      JSON.stringify({
        action: result.autoGenerationReady
          ? "envcheck_connection_test_completed"
          : "envcheck_connection_test_failed",
        projectId: pid,
        previewDeploymentReady: result.previewDeploymentReady,
      }),
    );
    console.info(
      JSON.stringify({
        action: result.previewDeploymentReady
          ? "preview_deployment_preflight_completed"
          : "preview_deployment_preflight_failed",
        projectId: pid,
      }),
    );

    return jsonWithConnectionTest(result, { success: true });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.info(
      JSON.stringify({
        action: "auto_generation_connection_test_normalized_after_error",
        projectId: pid,
      }),
    );
    console.error("POST auto-generation/test-connection error:", error);
    const normalized = normalizeAutoGenerationConnectionTestResult({
      thrownError: error,
      checkedAt: new Date().toISOString(),
      preflightException: true,
      envcheckException: true,
      settingsConnectionTestOnly: true,
    });
    return jsonWithConnectionTest(normalized, { success: false });
  }
}
