/**
 * 산출물 뷰어·Artifact Hub 공통 — 버전/문서 선택 콤보.
 */

import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { IDEATION_DELIVERABLE_LABELS, isIdeationDeliverableType } from "@/lib/requirements/ideationDeliverables";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

export function formatDeliverableCreatedAt(ts: string): string {
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return ts;
  try {
    return d.toLocaleString("ko-KR");
  } catch {
    return d.toISOString();
  }
}

export function sortDeliverableAssetsForPicker(
  assets: readonly IdeationDeliverableAsset[],
): IdeationDeliverableAsset[] {
  return [...assets].sort((a, b) => {
    const at = String(a.type).localeCompare(String(b.type));
    if (at !== 0) return at;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

export function buildDeliverableAssetPickerLabel(
  asset: IdeationDeliverableAsset,
  input: {
    readonly onlyFullPlanAssets: boolean;
    readonly isLatest: boolean;
    readonly isConfirmed: boolean;
  },
): string {
  const parts: string[] = [asset.title || "산출물"];
  if (!input.onlyFullPlanAssets) {
    const typeLabel = isIdeationDeliverableType(asset.type) ? IDEATION_DELIVERABLE_LABELS[asset.type] : String(asset.type);
    parts.push(typeLabel);
  }
  if (typeof asset.version === "number") parts.push(`v${asset.version}`);
  parts.push(formatDeliverableCreatedAt(asset.createdAt));
  parts.push(input.isLatest ? "최신" : "과거");
  parts.push(input.isConfirmed ? "확정" : "미확정");
  return parts.join(" · ");
}

export function computeLatestVersionByDeliverableType(
  assets: readonly IdeationDeliverableAsset[],
): ReadonlyMap<string, number> {
  const m = new Map<string, number>();
  for (const a of assets) {
    const prev = m.get(a.type) ?? -1;
    if (typeof a.version === "number" && a.version > prev) m.set(a.type, a.version);
  }
  return m;
}

export function resolveDeliverablePickerLabel(assets: readonly IdeationDeliverableAsset[]): string {
  const onlyFullPlan = assets.length > 0 && assets.every((a) => a.type === "full_plan");
  return onlyFullPlan ? "기획안 버전" : "문서";
}

/** Hub·모달 뷰어에 넘길 산출물 asset id 목록 */
export function collectDeliverableViewerAssetIds(input: {
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly projectId: string;
}): readonly string[] {
  const known = new Set(input.deliverableAssets.map((a) => a.id));
  const ids = input.deliverableAssets.map((a) => a.id);
  for (const art of input.projectArtifacts ?? []) {
    if (!known.has(art.id)) ids.push(art.id);
  }
  return ids;
}

/** 버전 콤보 옵션용 — deliverable + projectArtifacts 병합 */
export function buildMergedDeliverablePickerAssets(input: {
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly projectId: string;
}): readonly IdeationDeliverableAsset[] {
  const byId = new Map<string, IdeationDeliverableAsset>();
  for (const a of input.deliverableAssets) {
    const id = String(a.id ?? "").trim();
    if (id) byId.set(id, a);
  }
  const pid = String(input.projectId ?? "").trim();
  for (const art of input.projectArtifacts ?? []) {
    const id = String(art.id ?? "").trim();
    if (!id || byId.has(id) || !pid) continue;
    byId.set(id, projectArtifactToDeliverableAsset(art, pid));
  }
  return sortDeliverableAssetsForPicker([...byId.values()]);
}

export function pickDefaultDeliverableAssetId(
  assets: readonly IdeationDeliverableAsset[],
  preferredId?: string | null,
): string {
  if (preferredId && assets.some((a) => a.id === preferredId)) return preferredId;
  const latestByType = computeLatestVersionByDeliverableType(assets);
  const sorted = sortDeliverableAssetsForPicker(assets);
  const latest = sorted.find((a) => {
    const maxVer = latestByType.get(a.type) ?? a.version;
    return typeof a.version === "number" && typeof maxVer === "number" && a.version === maxVer;
  });
  return latest?.id ?? sorted[0]?.id ?? "";
}
