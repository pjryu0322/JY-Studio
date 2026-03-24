import { NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { extractMainFeaturesFromFreeText } from "@/lib/project-spec/mockSpecExtract";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type ParseRequestBody = {
  projectSpecUploadId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ParseRequestBody;
    const projectSpecUploadId = String(body.projectSpecUploadId ?? "").trim();

    if (!projectSpecUploadId) {
      return NextResponse.json(
        { success: false, message: "projectSpecUploadId? ?????." },
        { status: 400 }
      );
    }

    const upload = await prisma.projectSpecUpload.findUnique({
      where: { id: projectSpecUploadId },
    });
    if (!upload) {
      return NextResponse.json(
        { success: false, message: "?? ??? ???? ?? ? ????." },
        { status: 404 }
      );
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }
    try {
      await requireProjectPermissionById(
        upload.projectId,
        userId,
        "canEditProject",
        "POST /api/project-spec/parse"
      );
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
        data: { parseStatus: "FAILED", parsedAt: new Date() },
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
          message: "??? ??(contentText)? ?? mock parsing? ??????.",
        },
        { status: 400 }
      );
    }

    const projectOverview = contentText.slice(0, 600);
    const mainFeatures = extractMainFeaturesFromFreeText(contentText);
    const constraints: string[] = [];
    const lower = contentText.toLowerCase();
    if (/password|bcrypt|oauth|jwt|session|auth/.test(lower)) {
      constraints.push("?? ??? ?? ?? ? HTTPS ???? ?????.");
    }
    if (/offline|pwa/.test(lower)) {
      constraints.push("???? ??? ??? ??? ?????.");
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
      message: "ProjectSpec mock parsing? ???????.",
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/project-spec/parse error:", error);
    return NextResponse.json(
      { success: false, message: "ProjectSpec parsing ? ??? ??????." },
      { status: 500 }
    );
  }
}
