import { redirect } from "next/navigation";
import { AdminCategoryManager } from "@/components/AdminCategoryManager";
import { CategoryCard } from "@/components/CategoryCard";
import { isAdminAccountRole, isProviderAccountRole } from "@/lib/account-role";
import { listAdminCategories } from "@/lib/admin-category-service";
import { getStoreAuthSessionFromCookies } from "@/lib/auth-session";
import { listCategoryTreeWithPublishedCounts } from "@/lib/pack-catalog-service";
import { ROUTES } from "@/lib/routes";
import { getStoreUserById } from "@/lib/store-auth-service";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getStoreAuthSessionFromCookies();
  let isAdmin = false;
  if (session) {
    const user = await getStoreUserById(session.userId);
    if (isProviderAccountRole(user?.accountRole)) {
      redirect(ROUTES.provider);
    }
    isAdmin = isAdminAccountRole(user?.accountRole);
  }

  if (isAdmin) {
    try {
      const { items, tree } = await listAdminCategories();
      return <AdminCategoryManager initialItems={items} initialTree={tree} />;
    } catch {
      return <AdminCategoryManager />;
    }
  }

  const tree = await listCategoryTreeWithPublishedCounts();

  return (
    <ul className="grid gap-1.5 pb-6">
      {tree.map((node) => (
        <li key={node.categoryId} className="space-y-1.5">
          <CategoryCard category={node} packCount={node.publishedCount} depth={0} />
          {node.children.length > 0 ? (
            <ul className="ml-4 grid gap-1.5 border-l border-store-border pl-2.5">
              {node.children.map((child) => (
                <li key={child.categoryId} className="space-y-1.5">
                  <CategoryCard category={child} packCount={child.publishedCount} depth={1} />
                  {child.children.length > 0 ? (
                    <ul className="ml-3 grid gap-1.5 border-l border-store-border pl-2.5">
                      {child.children.map((grand) => (
                        <li key={grand.categoryId}>
                          <CategoryCard category={grand} packCount={grand.publishedCount} depth={2} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
