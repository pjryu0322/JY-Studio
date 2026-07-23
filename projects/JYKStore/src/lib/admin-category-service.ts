import { prisma } from "@/lib/prisma";

const CATEGORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DEPTH = 3;

export type AdminCategoryDto = {
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  parentCategoryId: string | null;
  sortOrder: number;
  packCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryTreeNode = AdminCategoryDto & {
  children: AdminCategoryTreeNode[];
};

export type CategoryWriteInput = {
  categoryId?: string;
  name?: string;
  description?: string;
  icon?: string;
  parentCategoryId?: string | null;
  sortOrder?: number;
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeText(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).trim();
}

export type CategoryIdValidationError =
  | "CATEGORY_ID_REQUIRED"
  | "CATEGORY_ID_TOO_LONG"
  | "CATEGORY_ID_INVALID";

export function validateCategoryId(categoryId: string): CategoryIdValidationError | null {
  const id = normalizeSlug(categoryId);
  if (!id) return "CATEGORY_ID_REQUIRED";
  if (id.length > 64) return "CATEGORY_ID_TOO_LONG";
  if (!CATEGORY_ID_PATTERN.test(id)) return "CATEGORY_ID_INVALID";
  return null;
}

function buildTree(items: AdminCategoryDto[]): AdminCategoryTreeNode[] {
  const byId = new Map<string, AdminCategoryTreeNode>();
  for (const item of items) {
    byId.set(item.categoryId, { ...item, children: [] });
  }
  const roots: AdminCategoryTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentCategoryId && byId.has(node.parentCategoryId)) {
      byId.get(node.parentCategoryId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: AdminCategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}

async function getCategoryRow(categoryId: string): Promise<{
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  parentCategoryId: string | null;
  sortOrder: number;
} | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      categoryId: string;
      name: string;
      description: string;
      icon: string;
      parentCategoryId: string | null;
      sortOrder: number;
    }>
  >`
    SELECT "categoryId", "name", "description", "icon", "parentCategoryId", "sortOrder"
    FROM "PackCategory"
    WHERE "categoryId" = ${categoryId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getAdminCategoryDto(categoryId: string): Promise<AdminCategoryDto | null> {
  const { items } = await listAdminCategories();
  return items.find((item) => item.categoryId === categoryId) ?? null;
}

async function categoryDepth(categoryId: string | null | undefined): Promise<number> {
  if (!categoryId) return 0;
  let depth = 0;
  let current: string | null = categoryId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) return Number.POSITIVE_INFINITY;
    seen.add(current);
    depth += 1;
    const row = await getCategoryRow(current);
    current = row?.parentCategoryId ?? null;
  }
  return depth;
}

async function wouldCreateCycle(categoryId: string, parentCategoryId: string): Promise<boolean> {
  let current: string | null = parentCategoryId;
  const seen = new Set<string>();
  while (current) {
    if (current === categoryId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    const row = await getCategoryRow(current);
    current = row?.parentCategoryId ?? null;
  }
  return false;
}

export async function listAdminCategories(): Promise<{
  items: AdminCategoryDto[];
  tree: AdminCategoryTreeNode[];
}> {
  // Raw SQL so this works even if the running Next.js process still has a
  // stale Prisma client that predates parentCategoryId / sortOrder.
  const rows = await prisma.$queryRaw<
    Array<{
      categoryId: string;
      name: string;
      description: string;
      icon: string;
      parentCategoryId: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      packCount: number;
      childCount: number;
    }>
  >`
    SELECT
      c."categoryId",
      c."name",
      c."description",
      c."icon",
      c."parentCategoryId",
      c."sortOrder",
      c."createdAt",
      c."updatedAt",
      (
        SELECT COUNT(*)::int
        FROM "KnowledgePack" p
        WHERE p."categoryId" = c."categoryId"
      ) AS "packCount",
      (
        SELECT COUNT(*)::int
        FROM "PackCategory" ch
        WHERE ch."parentCategoryId" = c."categoryId"
      ) AS "childCount"
    FROM "PackCategory" c
    ORDER BY c."sortOrder" ASC, c."name" ASC
  `;

  const items: AdminCategoryDto[] = rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    icon: row.icon,
    parentCategoryId: row.parentCategoryId,
    sortOrder: Number(row.sortOrder) || 0,
    packCount: Number(row.packCount) || 0,
    childCount: Number(row.childCount) || 0,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
  return { items, tree: buildTree(items) };
}

export async function createAdminCategory(input: CategoryWriteInput): Promise<
  | { ok: true; category: AdminCategoryDto }
  | {
      ok: false;
      error:
        | "CATEGORY_ID_REQUIRED"
        | "CATEGORY_ID_TOO_LONG"
        | "CATEGORY_ID_INVALID"
        | "CATEGORY_ID_EXISTS"
        | "NAME_REQUIRED"
        | "PARENT_NOT_FOUND"
        | "DEPTH_EXCEEDED";
    }
> {
  const idError = validateCategoryId(input.categoryId ?? "");
  if (idError) return { ok: false, error: idError };

  const categoryId = normalizeSlug(input.categoryId!);
  const name = normalizeText(input.name);
  const description = normalizeText(input.description);
  const icon = normalizeText(input.icon, "📁") || "📁";
  const parentCategoryId = input.parentCategoryId?.trim()
    ? normalizeSlug(input.parentCategoryId)
    : null;
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.trunc(input.sortOrder)
      : 0;

  if (!name) return { ok: false, error: "NAME_REQUIRED" };

  if (await getCategoryRow(categoryId)) return { ok: false, error: "CATEGORY_ID_EXISTS" };

  if (parentCategoryId) {
    if (!(await getCategoryRow(parentCategoryId))) return { ok: false, error: "PARENT_NOT_FOUND" };
    const depth = await categoryDepth(parentCategoryId);
    if (depth + 1 > MAX_DEPTH) return { ok: false, error: "DEPTH_EXCEEDED" };
  }

  const id = `cat_${categoryId}_${Date.now().toString(36)}`;
  await prisma.$executeRaw`
    INSERT INTO "PackCategory" (
      "id", "categoryId", "name", "description", "icon", "parentCategoryId", "sortOrder", "createdAt", "updatedAt"
    ) VALUES (
      ${id},
      ${categoryId},
      ${name},
      ${description},
      ${icon},
      ${parentCategoryId},
      ${sortOrder},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  const category = await getAdminCategoryDto(categoryId);
  if (!category) return { ok: false, error: "CATEGORY_ID_REQUIRED" };
  return { ok: true, category };
}

export async function updateAdminCategory(
  categoryId: string,
  input: CategoryWriteInput,
): Promise<
  | { ok: true; category: AdminCategoryDto }
  | {
      ok: false;
      error:
        | "NOT_FOUND"
        | "NAME_REQUIRED"
        | "PARENT_NOT_FOUND"
        | "PARENT_SELF"
        | "PARENT_CYCLE"
        | "DEPTH_EXCEEDED";
    }
> {
  const existing = await getCategoryRow(categoryId);
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  const name = input.name !== undefined ? normalizeText(input.name) : existing.name;
  if (!name) return { ok: false, error: "NAME_REQUIRED" };

  const description =
    input.description !== undefined ? normalizeText(input.description) : existing.description;
  const icon =
    input.icon !== undefined ? normalizeText(input.icon, existing.icon) || existing.icon : existing.icon;
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.trunc(input.sortOrder)
      : existing.sortOrder;

  let parentCategoryId = existing.parentCategoryId;
  if (input.parentCategoryId !== undefined) {
    parentCategoryId = input.parentCategoryId?.trim()
      ? normalizeSlug(input.parentCategoryId)
      : null;
  }

  if (parentCategoryId === categoryId) return { ok: false, error: "PARENT_SELF" };

  if (parentCategoryId) {
    if (!(await getCategoryRow(parentCategoryId))) return { ok: false, error: "PARENT_NOT_FOUND" };
    if (await wouldCreateCycle(categoryId, parentCategoryId)) {
      return { ok: false, error: "PARENT_CYCLE" };
    }
    const parentDepth = await categoryDepth(parentCategoryId);
    const ownSubtreeExtra = await maxDescendantDepth(categoryId);
    if (parentDepth + 1 + ownSubtreeExtra > MAX_DEPTH) {
      return { ok: false, error: "DEPTH_EXCEEDED" };
    }
  }

  await prisma.$executeRaw`
    UPDATE "PackCategory"
    SET
      "name" = ${name},
      "description" = ${description},
      "icon" = ${icon},
      "parentCategoryId" = ${parentCategoryId},
      "sortOrder" = ${sortOrder},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "categoryId" = ${categoryId}
  `;

  const category = await getAdminCategoryDto(categoryId);
  if (!category) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, category };
}

async function maxDescendantDepth(categoryId: string): Promise<number> {
  const children = await prisma.$queryRaw<Array<{ categoryId: string }>>`
    SELECT "categoryId" FROM "PackCategory" WHERE "parentCategoryId" = ${categoryId}
  `;
  if (children.length === 0) return 0;
  let max = 0;
  for (const child of children) {
    max = Math.max(max, 1 + (await maxDescendantDepth(child.categoryId)));
  }
  return max;
}

export async function deleteAdminCategory(categoryId: string): Promise<
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "HAS_CHILDREN" | "HAS_PACKS" }
> {
  if (!(await getCategoryRow(categoryId))) return { ok: false, error: "NOT_FOUND" };

  const counts = await prisma.$queryRaw<Array<{ childCount: number; packCount: number }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "PackCategory" ch WHERE ch."parentCategoryId" = ${categoryId}) AS "childCount",
      (SELECT COUNT(*)::int FROM "KnowledgePack" p WHERE p."categoryId" = ${categoryId}) AS "packCount"
  `;
  const childCount = Number(counts[0]?.childCount ?? 0);
  const packCount = Number(counts[0]?.packCount ?? 0);
  if (childCount > 0) return { ok: false, error: "HAS_CHILDREN" };
  if (packCount > 0) return { ok: false, error: "HAS_PACKS" };

  await prisma.$executeRaw`DELETE FROM "PackCategory" WHERE "categoryId" = ${categoryId}`;
  return { ok: true };
}
