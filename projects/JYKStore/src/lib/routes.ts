export const ROUTES = {
  home: "/",
  login: "/login",
  today: "/today",
  search: "/search",
  categories: "/categories",
  myPacks: "/my-packs",
  account: "/account",
  accountProfile: "/account/profile",
  accountPlan: "/account/plan",
  settings: "/settings",
  apiKeys: "/api-keys",
  packs: "/packs",
  provider: "/provider",
  /** Provider inbox for generation-result review requests. */
  providerReviews: "/provider/reviews",
  providerPackNew: "/provider/packs/new",
  admin: "/admin",
  /** @deprecated Prefer `/admin?queue=generation`. Kept for old bookmarks. */
  adminGeneration: "/admin/generation",
  /** @deprecated Use `login`. Kept as alias so old links resolve to the shared login page. */
  adminLogin: "/login",
  adminReviews: "/admin/reviews",
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

export type AdminWorkQueueKey =
  | "all"
  | "accept"
  | "generation"
  | "quality"
  | "correction"
  | "provider-review"
  | "service-validation"
  | "approval-publish"
  | "ops";

export function adminQueuePath(queue: AdminWorkQueueKey = "accept"): string {
  if (queue === "ops") return ROUTES.adminOps;
  if (queue === "all") return `${ROUTES.admin}?queue=accept`;
  return `${ROUTES.admin}?queue=${encodeURIComponent(queue)}`;
}

export function parseAdminWorkQueue(raw: string | null | undefined): AdminWorkQueueKey {
  switch (raw) {
    case "all":
    case "accept":
    case "generation":
    case "quality":
    case "correction":
    case "provider-review":
    case "service-validation":
    case "approval-publish":
    case "ops":
      return raw;
    default:
      return "accept";
  }
}

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

export type BottomTabKey =
  | "today"
  | "search"
  | "categories"
  | "myPacks"
  | "provider"
  | "providerReview"
  | "admin"
  | "adminAccept"
  | "adminGeneration"
  | "adminQuality"
  | "adminCorrection"
  | "adminProviderReview"
  | "adminServiceValidation"
  | "adminApproval"
  | "account"
  | "opsUsage"
  | "opsAudit"
  | "ops";

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
  { key: "admin", href: adminQueuePath("accept"), label: "지식데이터 접수", icon: "📥" },
  { key: "adminAccept", href: adminQueuePath("accept"), label: "지식데이터 접수", icon: "📁" },
  { key: "adminGeneration", href: adminQueuePath("generation"), label: "지식데이터 생성", icon: "▶" },
  { key: "adminQuality", href: adminQueuePath("quality"), label: "점검", icon: "☑" },
  { key: "adminCorrection", href: adminQueuePath("correction"), label: "보정", icon: "🔧" },
  {
    key: "adminProviderReview",
    href: adminQueuePath("provider-review"),
    label: "제공자 검토",
    icon: "👤",
  },
  {
    key: "adminServiceValidation",
    href: adminQueuePath("service-validation"),
    label: "서비스 검증",
    icon: "⌕",
  },
  {
    key: "adminApproval",
    href: adminQueuePath("approval-publish"),
    label: "승인·게시",
    icon: "✓",
  },
  { key: "provider", href: ROUTES.provider, label: "제공자 센터", icon: "🏷" },
  { key: "providerReview", href: ROUTES.providerReviews, label: "검토대상", icon: "☑" },
  { key: "account", href: ROUTES.account, label: "계정", icon: "👤" },
  { key: "opsUsage", href: ROUTES.adminOpsUsage, label: "운영 사용량", icon: "📊" },
  { key: "opsAudit", href: ROUTES.adminOpsAudit, label: "AuditLog", icon: "📋" },
  { key: "ops", href: ROUTES.adminOps, label: "공개/운영", icon: "⚙" },
];

export function isTodayPath(pathname: string): boolean {
  return pathname === ROUTES.home || pathname === ROUTES.today;
}

export function bottomTabActive(
  key: BottomTabKey,
  pathname: string,
  searchParams?: URLSearchParams | { get(name: string): string | null },
): boolean {
  const queue = searchParams?.get("queue") ?? null;
  switch (key) {
    case "today":
      return isTodayPath(pathname);
    case "search":
      return pathname === ROUTES.search;
    case "categories":
      return pathname === ROUTES.categories || pathname.startsWith("/categories/");
    case "myPacks":
      return pathname === ROUTES.myPacks || pathname.startsWith(`${ROUTES.myPacks}/`);
    case "provider":
      return (
        pathname === ROUTES.provider ||
        (pathname.startsWith(`${ROUTES.provider}/`) &&
          !pathname.startsWith(ROUTES.providerReviews))
      );
    case "providerReview":
      return (
        pathname === ROUTES.providerReviews ||
        pathname.startsWith(`${ROUTES.providerReviews}/`)
      );
    case "admin":
    case "adminAccept":
      return pathname === ROUTES.admin && (queue === "accept" || queue == null);
    case "adminGeneration":
      return (
        (pathname === ROUTES.admin && queue === "generation") ||
        pathname === ROUTES.adminGeneration ||
        pathname.startsWith(`${ROUTES.adminGeneration}/`)
      );
    case "adminQuality":
      return pathname === ROUTES.admin && queue === "quality";
    case "adminCorrection":
      return pathname === ROUTES.admin && queue === "correction";
    case "adminProviderReview":
      return pathname === ROUTES.admin && queue === "provider-review";
    case "adminServiceValidation":
      return pathname === ROUTES.admin && queue === "service-validation";
    case "adminApproval":
      return pathname === ROUTES.admin && queue === "approval-publish";
    case "account":
      return (
        pathname === ROUTES.account ||
        pathname.startsWith(`${ROUTES.account}/`)
      );
    case "opsUsage":
      return (
        pathname === ROUTES.adminOpsUsage ||
        pathname.startsWith(`${ROUTES.adminOpsUsage}/`)
      );
    case "opsAudit":
      return (
        pathname === ROUTES.adminOpsAudit ||
        pathname.startsWith(`${ROUTES.adminOpsAudit}/`)
      );
    case "ops":
      return pathname === ROUTES.adminOps;
    default:
      return false;
  }
}
