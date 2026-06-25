import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  MaterializeReferenceContextProjectNotFoundError,
  materializeReferenceContextForProject,
  type MaterializeReferenceContextResult,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializationService";
import { ReferenceSnapshotSelectionValidationError } from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

function publicMaterializePayload(
  result: MaterializeReferenceContextResult,
): Record<string, unknown> | null {
  switch (result.status) {
    case "MATERIALIZED":
      return {
        status: result.status,
        referenceContextSource: result.referenceContextSource,
        counts: result.counts,
      };
    case "ALREADY_MATERIALIZED":
      return {
        status: result.status,
        referenceContextSource: result.referenceContextSource,
      };
    case "NO_REFERENCE_SELECTION":
      return {
        status: result.status,
        referenceContextSource: result.referenceContextSource,
      };
    default:
      return null;
  }
}

function isFailureResult(
  result: MaterializeReferenceContextResult,
): result is Extract<MaterializeReferenceContextResult, { readonly message: string }> {
  return (
    result.status === "SOURCE_UNAVAILABLE" ||
    result.status === "SOURCE_PERMISSION_DENIED" ||
    result.status === "SNAPSHOT_NOT_READY" ||
    result.status === "INVALID_SELECTION"
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    let dryRun = false;
    try {
      const body = (await request.json()) as { dryRun?: unknown };
      dryRun = body?.dryRun === true;
    } catch {
      dryRun = false;
    }

    try {
      const result = await materializeReferenceContextForProject({
        projectId: pid,
        userId,
        dryRun,
      });

      if (isFailureResult(result)) {
        return NextResponse.json(
          {
            success: false,
            message: result.message,
            data: {
              status: result.status,
              referenceContextSource: result.referenceContextSource,
            },
          },
          { status: result.status === "SOURCE_PERMISSION_DENIED" ? 403 : 400 },
        );
      }

      const data = publicMaterializePayload(result);
      if (result.status === "NO_REFERENCE_SELECTION") {
        return NextResponse.json(
          { success: false, message: "저장된 참조 선택이 없습니다.", data },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      if (error instanceof MaterializeReferenceContextProjectNotFoundError) {
        return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      }
      if (error instanceof ReferenceSnapshotSelectionValidationError) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
      }
      throw error;
    }
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST reference-selection/materialize error:", error);
    return NextResponse.json({ success: false, message: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
