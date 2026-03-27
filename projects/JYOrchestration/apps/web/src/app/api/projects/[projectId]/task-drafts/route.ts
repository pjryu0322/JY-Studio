import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { nodeTypeFromTitle, stripNodeTypePrefix, withNodeTypePrefix } from "@/lib/project-spec/taskDraftHierarchy";

function jsonArrayFromDb(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

function numberFromDb(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function stringFromDb(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

function levelFromNodeType(nodeType: string): number {
  if (nodeType === "requirement") return 0;
  if (nodeType === "design") return 1;
  if (nodeType === "feature") return 2;
  return 3;
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const id = String(projectId ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(id, userId, "canViewProject", "GET /api/projects/[projectId]/task-drafts");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    const statusFilter = request.nextUrl.searchParams.get("status")?.trim() || "";

    const rows = await prisma.taskDraft.findMany({
      where: {
        projectId: id,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        specVersion: { select: { id: true, version: true } },
      },
    });
    const byId = new Map<
      string,
      {
        id: string;
        nodeType: "requirement" | "design" | "feature" | "task";
        dependsOnIds: string[];
      }
    >();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        nodeType: nodeTypeFromTitle(stringFromDb(r.title)),
        dependsOnIds: jsonArrayFromDb((r as unknown as { dependsOnIds?: unknown }).dependsOnIds),
      });
    }
    const parentById = new Map<string, string | null>();
    const childrenById = new Map<string, string[]>();
    for (const r of rows) childrenById.set(r.id, []);
    for (const r of rows) {
      const meType = nodeTypeFromTitle(stringFromDb(r.title));
      const deps = jsonArrayFromDb((r as unknown as { dependsOnIds?: unknown }).dependsOnIds);
      const parent =
        deps.find((id) => {
          const p = byId.get(id);
          return p && levelFromNodeType(p.nodeType) < levelFromNodeType(meType);
        }) ?? null;
      parentById.set(r.id, parent);
      if (parent) {
        childrenById.set(parent, [...(childrenById.get(parent) ?? []), r.id]);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Task 초안 목록을 조회했습니다.",
      data: rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        specVersionId: r.specVersionId,
        specVersionNumber: r.specVersion.version,
        nodeType: nodeTypeFromTitle(stringFromDb(r.title)),
        title: stripNodeTypePrefix(stringFromDb(r.title)),
        description: r.description,
        parentId: parentById.get(r.id) ?? null,
        childrenIds: childrenById.get(r.id) ?? [],
        priority: r.priority,
        dependsOn: jsonArrayFromDb(r.dependsOn),
        dependsOnIds: jsonArrayFromDb((r as unknown as { dependsOnIds?: unknown }).dependsOnIds),
        acceptanceCriteria: jsonArrayFromDb(r.acceptanceCriteria),
        positionX: numberFromDb((r as unknown as { positionX?: unknown }).positionX),
        positionY: numberFromDb((r as unknown as { positionY?: unknown }).positionY),
        stage: stringFromDb((r as unknown as { stage?: unknown }).stage) || "Build",
        createdByType: stringFromDb((r as unknown as { createdByType?: unknown }).createdByType) || "AI",
        status: r.status,
        sourceModel: r.sourceModel,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        totalTokens: r.totalTokens,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("GET /api/projects/[projectId]/task-drafts error:", error);
    return NextResponse.json(
      { success: false, message: "Task 초안 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) {
      return userId;
    }

    try {
      await requireProjectPermissionById(pid, userId, "canGenerateTask", "POST /api/projects/[projectId]/task-drafts");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) {
        return denied;
      }
      throw error;
    }

    let body: {
      specVersionId?: string;
      title?: string;
      nodeType?: "requirement" | "design" | "feature" | "task";
      description?: string | null;
      priority?: string;
      acceptanceCriteria?: string[];
      positionX?: number;
      positionY?: number;
      dependsOnIds?: string[];
      stage?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ success: false, message: "title이 필요합니다." }, { status: 400 });
    }

    const specVersionId = String(body.specVersionId ?? "").trim();
    if (!specVersionId) {
      return NextResponse.json({ success: false, message: "specVersionId가 필요합니다." }, { status: 400 });
    }

    const created = await prisma.taskDraft.create({
      data: {
        projectId: pid,
        specVersionId,
        title: withNodeTypePrefix(body.nodeType ?? "task", title.slice(0, 500)),
        description: body.description === null ? null : String(body.description ?? "").slice(0, 8000) || null,
        priority: String(body.priority ?? "MEDIUM").toUpperCase().trim() || "MEDIUM",
        acceptanceCriteria: Array.isArray(body.acceptanceCriteria)
          ? body.acceptanceCriteria.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
          : [],
        dependsOn: [],
        dependsOnIds: Array.isArray(body.dependsOnIds)
          ? body.dependsOnIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 50)
          : [],
        positionX: Number.isFinite(Number(body.positionX)) ? Number(body.positionX) : 0,
        positionY: Number.isFinite(Number(body.positionY)) ? Number(body.positionY) : 0,
        stage: String(body.stage ?? "Build").trim() || "Build",
        createdByType: "USER",
        status: "DRAFT",
        createdByUserId: userId,
      },
      include: { specVersion: { select: { version: true } } },
    });

    return NextResponse.json({
      success: true,
      message: "Task 초안을 추가했습니다.",
      data: {
        id: created.id,
        projectId: created.projectId,
        specVersionId: created.specVersionId,
        specVersionNumber: created.specVersion.version,
        nodeType: nodeTypeFromTitle(stringFromDb(created.title)),
        title: stripNodeTypePrefix(stringFromDb(created.title)),
        description: created.description,
        parentId: null,
        childrenIds: [],
        priority: created.priority,
        dependsOn: jsonArrayFromDb(created.dependsOn),
        dependsOnIds: jsonArrayFromDb((created as unknown as { dependsOnIds?: unknown }).dependsOnIds),
        acceptanceCriteria: jsonArrayFromDb(created.acceptanceCriteria),
        positionX: numberFromDb((created as unknown as { positionX?: unknown }).positionX),
        positionY: numberFromDb((created as unknown as { positionY?: unknown }).positionY),
        stage: stringFromDb((created as unknown as { stage?: unknown }).stage) || "Build",
        createdByType: stringFromDb((created as unknown as { createdByType?: unknown }).createdByType) || "USER",
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) {
      return denied;
    }
    console.error("POST /api/projects/[projectId]/task-drafts error:", error);
    return NextResponse.json({ success: false, message: "Task 초안 추가 중 오류가 발생했습니다." }, { status: 500 });
  }
}
