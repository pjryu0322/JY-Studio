/** Git 브랜치 세그먼트 — 클라이언트/서버 공용 (node:fs 미사용). */

export function slugifyForBranchSegment(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "project";
}

export function buildPrototypeBranchName(projectName: string, runId: string): string {
  const slug = slugifyForBranchSegment(projectName);
  const short = runId.replace(/-/g, "").slice(0, 8);
  return `prototype/${slug}/${short}`;
}

export function buildWorkUnitBranchName(projectName: string, runId: string, order: number): string {
  const slug = slugifyForBranchSegment(projectName);
  const short = runId.replace(/-/g, "").slice(0, 8);
  return `prototype/${slug}/${short}-wu${order}`;
}
