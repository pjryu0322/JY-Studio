import { NextRequest } from "next/server";
import { createAdminCategory, listAdminCategories } from "@/lib/admin-category-service";
import { rejectUnlessAdmin } from "@/lib/admin-route-guard";
import { ensureClientId, jsonWithClientIdCookie } from "@/lib/client-identity";
import { logSafeRouteError } from "@/lib/safe-logging";

const CREATE_ERROR_MESSAGES = {
  CATEGORY_ID_REQUIRED: "카테고리 ID를 입력해 주세요.",
  CATEGORY_ID_TOO_LONG: "카테고리 ID는 64자 이하여야 합니다.",
  CATEGORY_ID_INVALID: "카테고리 ID는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.",
  CATEGORY_ID_EXISTS: "이미 사용 중인 카테고리 ID입니다.",
  NAME_REQUIRED: "카테고리 이름을 입력해 주세요.",
  PARENT_NOT_FOUND: "상위 카테고리를 찾을 수 없습니다.",
  DEPTH_EXCEEDED: "카테고리 깊이는 최대 3단계까지 가능합니다.",
} as const;

export async function GET(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const { items, tree } = await listAdminCategories();
    return jsonWithClientIdCookie({ clientId, items, tree }, clientId);
  } catch (error) {
    logSafeRouteError({
      scope: "admin-categories",
      method: "GET",
      path: "/api/v1/admin/categories",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "카테고리 목록을 불러오지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const clientId = ensureClientId(request);
  const adminDeny = await rejectUnlessAdmin(request, clientId);
  if (adminDeny) return adminDeny;

  try {
    const body = (await request.json()) as {
      categoryId?: string;
      name?: string;
      description?: string;
      icon?: string;
      parentCategoryId?: string | null;
      sortOrder?: number;
    };

    const result = await createAdminCategory(body);
    if (!result.ok) {
      return jsonWithClientIdCookie(
        { error: CREATE_ERROR_MESSAGES[result.error] },
        clientId,
        { status: 400 },
      );
    }

    return jsonWithClientIdCookie({ clientId, category: result.category }, clientId, { status: 201 });
  } catch (error) {
    logSafeRouteError({
      scope: "admin-categories",
      method: "POST",
      path: "/api/v1/admin/categories",
      error,
    });
    return jsonWithClientIdCookie(
      { error: "카테고리를 만들지 못했습니다." },
      clientId,
      { status: 500 },
    );
  }
}
