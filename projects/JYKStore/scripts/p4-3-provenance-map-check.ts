import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const outDir = path.join(process.cwd(), "tmp-p4-3-validation", "worker-out");
const inventory = JSON.parse(
  readFileSync(path.join(outDir, "inventory.json"), "utf8"),
) as Array<Record<string, unknown>>;

const knowledge = inventory.filter((e) => e.classification === "knowledge_target");
const map: Record<string, string> = {};
knowledge.forEach((e, i) => {
  map[String(e.sourcePath)] = `p43-item-${String(i + 1).padStart(4, "0")}`;
});

// Simulate stamp (mirrors Python stamp_inventory_provenance)
for (const e of inventory) {
  const sp = String(e.sourcePath);
  if (map[sp]) e.inventoryItemId = map[sp];
  e.workingCopyId = "p43-wc-validation";
  e.sourceRevisionId = "p43-rev-validation";
  e.inventoryId = "p43-inv-validation";
}

const stamped = knowledge.filter((e) => e.inventoryItemId).length;
const chunks = JSON.parse(readFileSync(path.join(outDir, "chunks.json"), "utf8")) as Array<
  Record<string, unknown>
>;

// Verify chunk sourcePaths are subset of knowledge paths with map keys
let resolvable = 0;
let missing = 0;
for (const c of chunks) {
  const sp = String(c.sourcePath);
  if (map[sp]) resolvable += 1;
  else missing += 1;
}

const sample = chunks.slice(0, 5).map((c) => ({
  chunkId: c.chunkId,
  sourcePath: c.sourcePath,
  mappedInventoryItemId: map[String(c.sourcePath)] ?? null,
  workingCopyId: c.workingCopyId,
  sourceRevisionId: c.sourceRevisionId,
  canLocateInventoryEntry: inventory.some((e) => e.sourcePath === c.sourcePath),
  inventorySha256: inventory.find((e) => e.sourcePath === c.sourcePath)?.sha256 ?? null,
}));

const result = {
  knowledgeTargets: knowledge.length,
  stampedInventoryItems: stamped,
  chunksResolvableToInventoryItemMap: resolvable,
  chunksMissingFromMap: missing,
  sampleTraceability: sample,
  verdict:
    stamped === knowledge.length && missing === 0
      ? "PROVENANCE_PATH_OK_WITH_STORE_MAP"
      : "PROVENANCE_GAP",
};

writeFileSync(
  path.join(process.cwd(), "tmp-p4-3-validation", "provenance-map-check.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
