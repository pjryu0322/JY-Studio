/**
 * Workspace-level endpoints (no projectId scope). Per-project RBAC lives under
 * /api/project-spec/* and /api/task/*.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/lib/auth/requestUser";
import { projectPrototypeCardMeta } from "@/lib/project/projectPrototypeCardMeta";
import { createProject,
  listProjectsOrderedByCreatedDesc,
} from "@/lib/service/projectService";
import { ReferenceSnapshotSelectionValidationError } from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";
import { prepareReferenceSelectionForProjectCreate } from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionPrepareService";

type ApiSuccess<T> = {
  success: true;
  message?: string;
  data?: T;
};

type ApiFailure<T = null> = {
  success: false;
  message?: string;
  data?: T;
};

function ok<T>(message: string, data: T, status = 200) {
  const payload: ApiSuccess<T> = { success: true, message, data };
  return NextResponse.json(payload, { status });
}

function fail<T = null>(message: string, status: number, data?: T) {
  const payload: ApiFailure<T> = data === undefined
    ? { success: false, message }
    : { success: false, message, data };
  return NextResponse.json(payload, { status });
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return fail("로그인이 필요합니다.", 401, []);
    }
    const sp = request.nextUrl.searchParams;
    const includeDeleted =
      sp.get("includeDeleted") === "1" || sp.get("includeDeleted")?.toLowerCase() === "true";
    const projects = await listProjectsOrderedByCreatedDesc(userId, { includeDeleted });
    const enriched = projects.map((p) => ({
      ...p,
      ...projectPrototypeCardMeta(p.id),
    }));

    return ok("프로젝트 목록 조회에 성공했습니다.", enriched);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return fail("프로젝트 목록 조회 중 오류가 발생했습니다.", 500, []);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error("POST /api/projects invalid json:", error);
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }

  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return fail("로그인이 필요합니다.", 401);
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const name = String(payload.name ?? "").trim();
    const description = String(payload.description ?? "").trim() || null;
    const projectType = String(payload.projectType ?? "web-service").trim();
    const repoUrl = String(payload.repoUrl ?? "").trim() || null;
    const defaultBranch = String(payload.defaultBranch ?? "main").trim() || "main";
    const includeDefaultAiPlanner =
      payload.includeDefaultAiPlanner === false || String(payload.includeDefaultAiPlanner).toLowerCase() === "false"
        ? false
        : true;

    if (!name) {
      return fail("프로젝트명은 필수입니다.", 400);
    }

    const preparedReference = await prepareReferenceSelectionForProjectCreate({
      userId,
      referenceSnapshotIds: payload.referenceSnapshotIds,
    });

    const project = await createProject({
      name,
      description,
      projectType,
      repoUrl,
      defaultBranch,
      ownerUserId: userId,
      includeDefaultAiPlanner,
      referenceSelection: preparedReference.referenceSelection,
      referenceSelectionSummary: preparedReference.referenceSelectionSummary,
      materializedReferenceContextV1: preparedReference.materializedReferenceContextV1,
    });

    return ok("프로젝트가 생성되었습니다.", project, 201);
  } catch (error) {
    if (error instanceof ReferenceSnapshotSelectionValidationError) {
      return fail(error.message, error.status);
    }
    console.error("POST /api/projects error:", error);
    return fail("프로젝트 생성 중 오류가 발생했습니다.", 500);
  }
}
