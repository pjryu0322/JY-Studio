import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  fetchSampleDataArtifactsFromGithub,
  isSampleDataCodeTaskIdAlias,
  resolveSampleDataCodeTaskFromPlan,
} from "@/lib/prototype/sampleDataArtifactsFetchService";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { alignProductionCodeTaskIdsInRequirementsState } from "@/lib/prototype/requirementsStateProductionCodeTaskIdAlign";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

type RouteParams = Readonly<{ readonly params: Promise<{ readonly projectId: string }> }>;

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { projectId } = await params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        pid,
        userId,
        "canViewProject",
        "GET /api/projects/[projectId]/sample-data-artifacts",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const codeTaskId = String(request.nextUrl.searchParams.get("codeTaskId") ?? "").trim();

    const setupRow = await prisma.executionSetup.findUnique({
      where: { projectId: pid },
      select: {
        githubAccessToken: true,
        gitRepoUrl: true,
        gitRepoName: true,
        gitRepoProvider: true,
        baseBranch: true,
      },
    });
    const token = String(setupRow?.githubAccessToken ?? "").trim();
    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup(setupRow);
    if (!token || !targetRepository?.gitRepoUrl) {
      return NextResponse.json(
        { success: false, message: "GitHub 저장소 또는 Access Token이 설정되어 있지 않습니다." },
        { status: 503 },
      );
    }

    const projectRow = await prisma.project.findUnique({
      where: { id: pid },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(projectRow?.requirementsStateJson) ?? {};
    const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
    const aligned = alignProductionCodeTaskIdsInRequirementsState({
      requirementsState: state,
      taskList,
    });
    const plan = aligned.codeTaskPlan;
    const runs = aligned.runs ?? [];

    const codeTask = resolveSampleDataCodeTaskFromPlan(plan, codeTaskId || null, runs);
    if (!codeTask) {
      return NextResponse.json(
        { success: false, message: "샘플 데이터 CodeTask를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (
      codeTaskId &&
      !isSampleDataCodeTaskIdAlias(codeTaskId) &&
      !isSampleDataCodeTaskRef({
        codeTaskId,
        parentTaskId: codeTask.parentTaskId,
        title: codeTask.title,
        changeType: codeTask.changeType,
      })
    ) {
      return NextResponse.json(
        { success: false, message: "샘플 데이터 CodeTask만 조회할 수 있습니다." },
        { status: 400 },
      );
    }

    const result = await fetchSampleDataArtifactsFromGithub({
      repoUrl: targetRepository.gitRepoUrl,
      githubToken: token,
      codeTask,
      runs,
    });

    return NextResponse.json({
      success: true,
      ok: result.ok,
      codeTaskId: result.codeTaskId,
      workBranch: result.workBranch,
      gitRef: result.gitRef,
      commitSha: result.commitSha,
      repositoryFullName: result.repositoryFullName,
      files: result.files.map((f) => ({
        path: f.path,
        found: f.found,
        contentUtf8: f.found ? f.contentUtf8 : null,
      })),
      quality: result.quality,
      userMessage: result.userMessage,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "샘플 데이터 조회에 실패했습니다.";
    console.error("[sample-data-artifacts]", e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
