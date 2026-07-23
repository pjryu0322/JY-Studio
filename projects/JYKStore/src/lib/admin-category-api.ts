import type {
  AdminCategoryDto,
  AdminCategoryTreeNode,
  CategoryWriteInput,
} from "@/lib/admin-category-service";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string | { message?: string }; message?: string };
    if (typeof body.error === "string") return body.error;
    if (body.error && typeof body.error === "object" && body.error.message) {
      return body.error.message;
    }
    return body.message ?? `요청에 실패했습니다. (${res.status})`;
  } catch {
    return `요청에 실패했습니다. (${res.status})`;
  }
}

export async function fetchAdminCategoriesApi(): Promise<{
  items: AdminCategoryDto[];
  tree: AdminCategoryTreeNode[];
}> {
  const response = await fetch("/api/v1/admin/categories", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as { items: AdminCategoryDto[]; tree: AdminCategoryTreeNode[] };
}

export async function createAdminCategoryApi(
  input: CategoryWriteInput,
): Promise<{ category: AdminCategoryDto }> {
  const response = await fetch("/api/v1/admin/categories", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as { category: AdminCategoryDto };
}

export async function updateAdminCategoryApi(
  categoryId: string,
  input: CategoryWriteInput,
): Promise<{ category: AdminCategoryDto }> {
  const response = await fetch(`/api/v1/admin/categories/${encodeURIComponent(categoryId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as { category: AdminCategoryDto };
}

export async function deleteAdminCategoryApi(categoryId: string): Promise<void> {
  const response = await fetch(`/api/v1/admin/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
}
