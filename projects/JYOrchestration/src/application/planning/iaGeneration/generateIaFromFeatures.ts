/**
 * Deterministic menu IA from standardized features (flat by default; 게시글* grouping when obvious).
 */

import type { IaGenerationResult, IaMenuDraft, IaNodeTrace } from "./iaGenerationContracts";
import { buildMenuTree } from "./buildMenuTree";
import { normalizeMenuName } from "./normalizeMenuName";

export type IaFeatureInput = {
  id: string;
  projectId: string;
  name: string;
  order: number;
};

const POST_LINE = /^게시글\s+(\S+)$/u;

function parsePostLine(name: string): { suffix: string } | null {
  const m = name.trim().match(POST_LINE);
  return m?.[1] ? { suffix: m[1]! } : null;
}

function collectPostGroup(features: readonly IaFeatureInput[]): IaFeatureInput[] {
  const hits = features.filter((f) => parsePostLine(f.name) != null);
  return hits.length >= 2 ? hits : [];
}

/**
 * Builds root + feature menus, optionally a "게시글" parent with per-suffix children when ≥2 post lines.
 */
export function generateIaFromFeatures(features: readonly IaFeatureInput[]): IaGenerationResult {
  if (features.length === 0) {
    throw new Error("IA_GENERATION_EMPTY_FEATURES: call buildIaGenerationResult instead of generateIaFromFeatures");
  }
  const projectId = features[0]!.projectId;
  const rootId = `menu-root-${projectId}`;
  const sortedFeatures = [...features].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const postGroup = collectPostGroup(sortedFeatures);
  const postGroupIds = new Set(postGroup.map((f) => f.id));
  const standalone = sortedFeatures.filter((f) => !postGroupIds.has(f.id));

  const drafts: IaMenuDraft[] = [];
  const traces: IaNodeTrace[] = [];

  drafts.push({
    id: rootId,
    projectId,
    name: "Root",
    parentId: null,
    order: 0,
    sourceFeatureIds: [],
  });
  traces.push({ menuId: rootId, featureIds: [] });

  let nextOrder = 1;

  for (const f of standalone) {
    const leafId = `menu-${f.id}`;
    drafts.push({
      id: leafId,
      projectId,
      name: normalizeMenuName(f.name),
      parentId: rootId,
      order: nextOrder++,
      sourceFeatureIds: [f.id],
    });
    traces.push({ menuId: leafId, featureIds: [f.id] });
  }

  if (postGroup.length >= 2) {
    const parentId = `menu-group-${projectId}-post`;
    const parentFeatureIds = postGroup.map((f) => f.id).sort((a, b) => a.localeCompare(b));
    drafts.push({
      id: parentId,
      projectId,
      name: normalizeMenuName("게시글"),
      parentId: rootId,
      order: nextOrder++,
      sourceFeatureIds: parentFeatureIds,
    });
    traces.push({ menuId: parentId, featureIds: parentFeatureIds });

    const orderedPosts = [...postGroup].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    for (const f of orderedPosts) {
      const parsed = parsePostLine(f.name)!;
      const leafId = `menu-${f.id}`;
      drafts.push({
        id: leafId,
        projectId,
        name: normalizeMenuName(parsed.suffix),
        parentId,
        order: nextOrder++,
        sourceFeatureIds: [f.id],
      });
      traces.push({ menuId: leafId, featureIds: [f.id] });
    }
  }

  const menuNodes = buildMenuTree(drafts);
  const traceByMenu = new Map(traces.map((t) => [t.menuId, t]));
  const orderedTraces = menuNodes
    .map((m) => traceByMenu.get(m.id))
    .filter((t): t is IaNodeTrace => t != null);
  return { projectId, menuNodes, traces: orderedTraces };
}
