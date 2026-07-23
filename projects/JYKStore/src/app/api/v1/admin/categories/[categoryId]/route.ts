import { NextRequest } from "next/server";
import { deleteAdminCategory, updateAdminCategory } from "@/lib/admin-category-service";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

type RouteContext = { params: Promise<{ categoryId: string }> };

const UPDATE_ERROR_MESSAGES = {
  NOT_FOUND: "카테고리를 찾을 수 없습니다.",
  NAME_REQUIRED: "카테고리 이름을 입력해 주세요.",
  PARENT_NOT_FOUND: "상위 카테고리를 찾을 수 없습니다.",
  PARENT_SELF: "자기 자신을 상위 카테고리로 지정할 수 없습니다.",
  PARENT_CYCLE: "하위 카테고리를 상위로 지정할 수 없습니다.",
  DEPTH_EXCEEDED: "카테고리 깊이는 최대 3단계까지 가능합니다.",
} as const;

const DELETE_ERROR_MESSAGES = {
  NOT_FOUND: "카테고리를 찾을 수 없습니다.",
  HAS_CHILDREN: "하위 카테고리가 있어 삭제할 수 없습니다. 하위 카테고리를 먼저 정리하세요.",
  HAS_PACKS: "지식팩이 연결된 카테고리는 삭제할 수 없습니다.",
} as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const { categoryId } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      icon?: string;
      parentCategoryId?: string | null;
      sortOrder?: number;
    };

    const result = await updateAdminCategory(categoryId, body);
    if (!result.ok) {
      return jsonWithClientIdCookie(
        { error: UPDATE_ERROR_MESSAGES[result.error] },
        clientId,
        { status: result.error === "NOT_FOUND" ? 404 : 400 },
      );
    }

    return jsonWithClientIdCookie({ clientId, category: result.category }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-categories",
      method: "PATCH",
      path: "/api/v1/admin/categories/[categoryId]",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "카테고리를 수정하지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const { categoryId } = await context.params;
    const result = await deleteAdminCategory(categoryId);
    if (!result.ok) {
      return jsonWithClientIdCookie(
        { error: DELETE_ERROR_MESSAGES[result.error] },
        clientId,
        { status: result.error === "NOT_FOUND" ? 404 : 400 },
      );
    }

    return jsonWithClientIdCookie({ clientId, ok: true }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-categories",
      method: "DELETE",
      path: "/api/v1/admin/categories/[categoryId]",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "카테고리를 삭제하지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
