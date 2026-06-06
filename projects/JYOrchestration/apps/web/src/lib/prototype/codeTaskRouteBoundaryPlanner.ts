/** Route / app entry path candidates for foundation and integration wiring (P3-M53+). */
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

export const ROUTE_ENTRY_DUPLICATE_GUARD_LINE =
  "동일 목적의 route/app entry 파일을 여러 프레임워크 방식으로 중복 생성하지 않는다." as const;

export const ROUTE_ENTRY_USAGE_NOTE = [
  "아래 route/app entry 후보 중 실제 저장소에 존재하는 파일을 우선 사용한다.",
  "존재하지 않는 route 파일을 새로 만들기 전에, package.json과 현재 프레임워크 구조를 확인한다.",
  ROUTE_ENTRY_DUPLICATE_GUARD_LINE,
  "예: Next.js App Router의 `app/page.*`와 React/Vite의 `src/App.*`를 같은 목적으로 동시에 새로 만들지 않는다.",
  "새 entry 파일 생성은 현재 구조에서 필요한 경우에만 마지막 수단으로 수행한다.",
].join("\n");

const ROUTE_ENTRY_OWNED_MARKERS = [
  "app/page",
  "app/layout",
  "src/app/page",
  "src/app/layout",
  "pages/index",
  "src/pages/index",
  "src/App.",
  "src/main.",
  "src/routes/",
  "app/index.html",
  "index.html",
] as const;

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

export function boundaryIncludesRouteEntryCandidates(ownedFiles: readonly string[]): boolean {
  const paths = ownedFiles.map((p) => p.trim()).filter(Boolean);
  if (!paths.length) return false;
  return paths.some((path) =>
    ROUTE_ENTRY_OWNED_MARKERS.some((marker) => path.includes(marker)),
  );
}

export function mergeFoundationShellOwnedFiles(owned: readonly string[]): readonly string[] {
  return dedupePaths([...owned, ...FOUNDATION_ROUTE_APP_ENTRY_CANDIDATES]);
}

export function mergeIntegrationWiringOwnedFiles(owned: readonly string[]): readonly string[] {
  return dedupePaths([...owned, ...INTEGRATION_ROUTE_WIRING_CANDIDATES]);
}

export function requiresRouteEntryGuardInPrompt(input: {
  readonly branchGroup?: import("@/lib/prototype/implementationBranchPlan").CodeTaskBranchGroupV1 | null;
  readonly ownedFiles?: readonly string[];
}): boolean {
  if (input.branchGroup === "foundation" || input.branchGroup === "integration") {
    return true;
  }
  return boundaryIncludesRouteEntryCandidates(input.ownedFiles ?? []);
}
