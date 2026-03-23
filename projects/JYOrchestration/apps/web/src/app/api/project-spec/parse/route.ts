import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/requestUser";
import { extractMainFeaturesFromFreeText } from "@/lib/project-spec/mockSpecExtract";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectSpecParse } from "@/lib/service/projectAccessGuard";

type ParseRequestBody = {
  projectSpecUploadId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ParseRequestBody;
    const projectSpecUploadId = String(body.projectSpecUploadId ?? "").trim();

    if (!projectSpecUploadId) {
      return NextResponse.json(
        {
          success: false,
          message: "projectSpecUploadId가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const upload = await prisma.projectSpecUpload.findUnique({
      where: { id: projectSpecUploadId },
    });

    if (!upload) {
      return NextResponse.json(
        {
          success: false,
          message: "대상 업로드 레코드를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const userId = getCurrentUserIdFromRequest(request);
    try {
      await requireProjectSpecParse(upload.projectId, userId);
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const contentText = (upload.contentText || "").trim();
    if (!contentText) {
      const failed = await prisma.projectSpecUpload.update({
        where: { id: projectSpecUploadId },
        data: {
          parseStatus: "FAILED",
          parsedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          data: {
            id: failed.id,
            parseStatus: failed.parseStatus,
            parsedAt: failed.parsedAt?.toISOString() ?? null,
            hasParsedJson: false,
          },
          message: "파싱할 원문(contentText)이 없어 mock parsing에 실패했습니다.",
        },
        { status: 400 }
      );
    }

    const projectOverview = contentText.slice(0, 600);
    const mainFeatures = extractMainFeaturesFromFreeText(contentText);
    const constraints: string[] = [];
    const lower = contentText.toLowerCase();
    if (/password|비밀번호|bcrypt|oauth|jwt|세션/.test(lower)) {
      constraints.push("인증·비밀번호는 안전한 방식(예: 해시 저장, HTTPS)을 전제로 설명할 것");
    }
    if (/offline|오프라인|pwa/.test(lower)) {
      constraints.push("오프라인 요구가 있으면 범위에 명시");
    }
    const parsedJson = {
      projectOverview,
      mainFeatures,
      constraints,
      techStack: [] as string[],
    };

    const updated = await prisma.projectSpecUpload.update({
      where: { id: projectSpecUploadId },
      data: {
        parsedJson,
        parseStatus: "SUCCESS",
        parsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        parseStatus: updated.parseStatus,
        parsedAt: updated.parsedAt?.toISOString() ?? null,
        hasParsedJson: Boolean(updated.parsedJson),
      },
      message: "ProjectSpec mock parsing이 완료되었습니다.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project-spec/parse error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "mock parsing 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
