/**
 * Deterministic URL segments for {@link ScreenDraft} rows (ASCII paths; stable fallbacks for KO).
 */

import type { ScreenDraft } from "./screenGenerationContracts";

export type ScreenRouteMenuNode = {
  id: string;
  name: string;
  parentId: string | null;
};

export type BuildScreenRoutePathContext = {
  menuById: ReadonlyMap<string, ScreenRouteMenuNode>;
  rootMenuIds: ReadonlySet<string>;
};

function slugifyAscii(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function segmentFromMenuName(name: string): string {
  const n = name.trim();
  if (/화상회의/u.test(n)) return "video-meeting";
  if (/^로그인$/u.test(n) || /^sign\s*in$/iu.test(n) || /^login$/iu.test(n)) return "login";
  if (/^조회$/u.test(n) || /목록/u.test(n)) return "list";
  if (/^작성$/u.test(n) || /^생성$/u.test(n) || /작성$/u.test(n)) return "create";
  if (/상세/u.test(n)) return "detail";
  if (/^게시글$/u.test(n)) return "posts";
  if (/^설정$/u.test(n)) return "settings";
  const ascii = slugifyAscii(n);
  if (ascii.length > 0) return ascii;
  let h = 0;
  for (let i = 0; i < n.length; i++) {
    h = (Math.imul(31, h) + n.charCodeAt(i)) | 0;
  }
  return "m" + Math.abs(h).toString(16).slice(0, 12);
}

/**
 * Builds a slash-led path from the menu chain up to (but excluding) the synthetic root.
 */
export function buildScreenRoutePath(screen: ScreenDraft, ctx: BuildScreenRoutePathContext): string {
  const segments: string[] = [];
  let cur: ScreenRouteMenuNode | undefined = ctx.menuById.get(screen.menuId);
  const guard = new Set<string>();
  while (cur && !ctx.rootMenuIds.has(cur.id) && !guard.has(cur.id)) {
    guard.add(cur.id);
    segments.unshift(segmentFromMenuName(cur.name));
    if (cur.parentId == null || ctx.rootMenuIds.has(cur.parentId)) break;
    cur = ctx.menuById.get(cur.parentId);
    if (guard.size > 64) break;
  }
  const path = "/" + segments.join("/");
  return path.length > 1 ? path : "/app";
}

/**
 * Ensures unique `routePath` values by appending `-2`, `-3`, … when needed (stable iteration order).
 */
export function dedupeRoutePaths(screens: readonly ScreenDraft[]): ScreenDraft[] {
  const used = new Set<string>();
  return screens.map((s) => {
    let p = s.routePath;
    if (!used.has(p)) {
      used.add(p);
      return { ...s, routePath: p };
    }
    let n = 2;
    let candidate = `${p}-${n}`;
    while (used.has(candidate)) {
      n += 1;
      candidate = `${p}-${n}`;
    }
    used.add(candidate);
    return { ...s, routePath: candidate };
  });
}
