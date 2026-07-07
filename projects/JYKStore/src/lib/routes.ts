export const ROUTES = {
  home: "/",
  today: "/today",
  search: "/search",
  categories: "/categories",
  myPacks: "/my-packs",
  account: "/account",
  packs: "/packs",
} as const;

export function packDetailPath(packId: string): string {
  return `/packs/${packId}`;
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
      return pathname === ROUTES.myPacks;
    case "account":
      return pathname === ROUTES.account;
    default:
      return false;
  }
}
