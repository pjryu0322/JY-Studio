export const ROUTES = {
  home: "/",
  today: "/today",
  search: "/search",
  categories: "/categories",
  myPacks: "/my-packs",
  account: "/account",
  accountPlan: "/account/plan",
  apiKeys: "/api-keys",
  packs: "/packs",
  provider: "/provider",
  providerPackNew: "/provider/packs/new",
  admin: "/admin",
  adminKnowledgeUnitDrafts: "/admin/knowledge-unit-drafts",
  adminOps: "/admin/ops",
  adminOpsUsage: "/admin/ops/usage",
  adminOpsAudit: "/admin/ops/audit",
  adminOpsHealth: "/admin/ops/health",
  adminOpsPlans: "/admin/ops/plans",
  adminOpsApiKeys: "/admin/ops/api-keys",
  adminOpsQuota: "/admin/ops/quota",
  docs: "/docs",
  apiDocs: "/docs/api",
  contextApiDocs: "/docs/api/context",
  retrievalApiDocs: "/docs/api/retrieval",
  sdkDocs: "/docs/sdk",
} as const;

export function adminOpsUsagePath(params?: { status?: string; endpoint?: string }): string {
  const search = new URLSearchParams();
  if (params?.status?.trim()) search.set("status", params.status.trim());
  if (params?.endpoint?.trim()) search.set("endpoint", params.endpoint.trim());
  const qs = search.toString();
  return qs ? `${ROUTES.adminOpsUsage}?${qs}` : ROUTES.adminOpsUsage;
}

export function contextApiDocsPath(packId?: string): string {
  return packId
    ? `/docs/api/context?packId=${encodeURIComponent(packId)}`
    : "/docs/api/context";
}

export function packDetailPath(packId: string): string {
  return `/packs/${packId}`;
}

export function myPackConnectPath(packId: string): string {
  return `/my-packs/${packId}/connect`;
}

export function providerPackDetailPath(packId: string): string {
  return `/provider/packs/${packId}`;
}

export function adminReviewDetailPath(packId: string): string {
  return `/admin/reviews/${packId}`;
}

export function categoryDetailPath(categoryId: string): string {
  return `/categories/${categoryId}`;
}

export function searchPath(query?: string, chip?: string): string {
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  if (chip?.trim()) params.set("chip", chip.trim());
  const qs = params.toString();
  return qs ? `${ROUTES.search}?${qs}` : ROUTES.search;
}

export type BottomTabKey = "today" | "search" | "categories" | "myPacks" | "account";

export const BOTTOM_TABS: readonly {
  key: BottomTabKey;
  href: string;
  label: string;
  icon: string;
}[] = [
  { key: "today", href: ROUTES.today, label: "투데이", icon: "☀" },
  { key: "search", href: ROUTES.search, label: "검색", icon: "⌕" },
  { key: "categories", href: ROUTES.categories, label: "카테고리", icon: "▦" },
  { key: "myPacks", href: ROUTES.myPacks, label: "내 지식팩", icon: "📦" },
  { key: "account", href: ROUTES.account, label: "계정", icon: "👤" },
];

export function isTodayPath(pathname: string): boolean {
  return pathname === ROUTES.home || pathname === ROUTES.today;
}

export function bottomTabActive(key: BottomTabKey, pathname: string): boolean {
  switch (key) {
    case "today":
      return isTodayPath(pathname);
    case "search":
      return pathname === ROUTES.search;
    case "categories":
      return pathname === ROUTES.categories || pathname.startsWith("/categories/");
    case "myPacks":
      return pathname === ROUTES.myPacks || pathname.startsWith(`${ROUTES.myPacks}/`);
    case "account":
      return pathname === ROUTES.account || pathname === ROUTES.apiKeys || pathname.startsWith("/provider") || pathname.startsWith("/admin") || pathname.startsWith("/docs");
    default:
      return false;
  }
}
