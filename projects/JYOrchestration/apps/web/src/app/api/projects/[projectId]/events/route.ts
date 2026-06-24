import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { appendProjectEvent } from "@/lib/project-process/projectEventStore";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

const ALLOWED_ACTOR_TYPES = new Set(["USER", "AI", "SYSTEM"]);

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? 50);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(200, Math.floor(n));
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET /api/projects/[projectId]/events");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const stage = request.nextUrl.searchParams.get("stage")?.trim() || undefined;
    const eventType = request.nextUrl.searchParams.get("eventType")?.trim() || undefined;
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const events = await prisma.projectEvent.findMany({
      where: {
        projectId: pid,
        ...(stage ? { stage } : {}),
        ...(eventType ? { eventType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        projectMessage: {
          select: {
            id: true,
            stage: true,
            source: true,
            sourceMessageId: true,
            senderType: true,
            senderName: true,
            messageType: true,
            content: true,
            messageCreatedAt: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "프로젝트 이벤트를 조회했습니다.",
      data: { events, limit },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("GET /api/projects/[projectId]/events error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

type PostEventBody = Readonly<{
  readonly eventType?: string;
  readonly actorType?: string;
  readonly stage?: string | null;
  readonly sourceMessageId?: string | null;
  readonly payload?: unknown;
  readonly metadata?: unknown;
  readonly idempotencyKey?: string | null;
}>;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canGenerateTask", "POST /api/projects/[projectId]/events");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => null)) as PostEventBody | null;
    const eventType = String(body?.eventType ?? "").trim();
    if (!eventType) {
      return NextResponse.json({ success: false, message: "eventType이 필요합니다." }, { status: 400 });
    }

    const actorTypeRaw = String(body?.actorType ?? "USER").trim().toUpperCase();
    if (!ALLOWED_ACTOR_TYPES.has(actorTypeRaw)) {
      return NextResponse.json(
        { success: false, message: "actorType은 USER, AI, SYSTEM 중 하나여야 합니다." },
        { status: 400 },
      );
    }

    const event = await appendProjectEvent(prisma, {
      projectId: pid,
      eventType,
      actorType: actorTypeRaw,
      actorId: userId,
      stage: body?.stage ?? null,
      sourceMessageId: body?.sourceMessageId ?? null,
      idempotencyKey: body?.idempotencyKey ?? null,
      payload: body?.payload ?? {},
      metadata: body?.metadata ?? null,
    });

    return NextResponse.json({
      success: true,
      message: "프로젝트 이벤트를 저장했습니다.",
      data: { event },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/events error:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
