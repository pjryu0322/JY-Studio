/** Route / app entry path candidates for foundation and integration wiring (P3-M53). */
export const FOUNDATION_ROUTE_APP_ENTRY_CANDIDATES = [
  "index.html",
  "app/index.html",
  "app/page.*",
  "app/layout.*",
  "src/app/page.*",
  "src/app/layout.*",
  "pages/index.*",
  "src/pages/index.*",
  "src/App.*",
  "src/main.*",
] as const;

export const INTEGRATION_ROUTE_WIRING_CANDIDATES = [
  "app/page.*",
  "app/layout.*",
  "src/app/page.*",
  "src/app/layout.*",
  "pages/index.*",
  "src/pages/index.*",
  "src/App.*",
  "src/routes/*",
] as const;

export const ROUTE_ENTRY_USAGE_NOTE =
  "아래 route/app entry 후보 중 실제 저장소에 존재하는 파일을 우선 사용한다.\n존재하지 않는 route 파일을 새로 만들기 전에, 현재 프레임워크 구조를 확인한다." as const;

function dedupePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    const p = raw.trim();
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function mergeFoundationShellOwnedFiles(owned: readonly string[]): readonly string[] {
  return dedupePaths([...owned, ...FOUNDATION_ROUTE_APP_ENTRY_CANDIDATES]);
}

export function mergeIntegrationWiringOwnedFiles(owned: readonly string[]): readonly string[] {
  return dedupePaths([...owned, ...INTEGRATION_ROUTE_WIRING_CANDIDATES]);
}
