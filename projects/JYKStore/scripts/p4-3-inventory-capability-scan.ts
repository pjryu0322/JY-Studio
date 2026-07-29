/**
 * P4.3 — Inventory/Capability scan of a real ZIP (no DB).
 * Usage: node --import tsx scripts/p4-3-inventory-capability-scan.ts <zipPath>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { classifyInventoryAutoDecision } from "../src/lib/knowledge-scope/inventory-auto-exclude";
import { assessWorkerCapability } from "../src/lib/python-worker/worker-capability-policy";
import { buildZipPreflightInventory } from "../src/lib/python-worker/zip-preflight-inventory";

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error("Usage: p4-3-inventory-capability-scan.ts <zipPath>");
    process.exit(1);
  }
  const bytes = new Uint8Array(readFileSync(zipPath));
  const scan = await buildZipPreflightInventory(bytes);
  const files = scan.entries.filter((e) => e.kind === "file");

  const counts = {
    totalFiles: files.length,
    SUPPORTED: 0,
    UNSUPPORTED: 0,
    REVIEW_REQUIRED: 0,
    SUPPORTING: 0,
    SYSTEM_EXCLUDED: 0,
    PENDING: 0,
    zeroByte: 0,
    executable: 0,
    byDecision: {} as Record<string, number>,
    byReason: {} as Record<string, number>,
    byCapability: {} as Record<string, number>,
    includedEligible: [] as string[],
    mismatchIfIncluded: [] as string[],
  };

  const rows: Array<Record<string, unknown>> = [];

  for (const f of files) {
    const fileName = f.path.replace(/\\/g, "/").split("/").pop() || f.path;
    const extension = (() => {
      const d = fileName.lastIndexOf(".");
      return d > 0 ? fileName.slice(d).toLowerCase() : "";
    })();
    const sizeBytes = f.sizeBytes ?? 0;
    const auto = classifyInventoryAutoDecision({
      relativePath: f.path,
      fileName,
      extension,
      sizeBytes,
    });
    const cap = assessWorkerCapability({
      relativePath: f.path,
      fileName,
      extension,
    });
    counts.byCapability[cap.capability] = (counts.byCapability[cap.capability] ?? 0) + 1;
    counts.byDecision[auto.decision] = (counts.byDecision[auto.decision] ?? 0) + 1;
    if (auto.exclusionReasonCode) {
      counts.byReason[auto.exclusionReasonCode] =
        (counts.byReason[auto.exclusionReasonCode] ?? 0) + 1;
    }
    if (cap.capability === "SUPPORTED") counts.SUPPORTED += 1;
    if (cap.capability === "UNSUPPORTED") counts.UNSUPPORTED += 1;
    if (cap.capability === "REVIEW_REQUIRED") counts.REVIEW_REQUIRED += 1;
    if (cap.capability === "SUPPORTING") counts.SUPPORTING += 1;
    if (auto.decision === "EXCLUDED") counts.SYSTEM_EXCLUDED += 1;
    if (auto.decision === "PENDING") counts.PENDING += 1;
    if (auto.exclusionReasonCode === "ZERO_BYTE") counts.zeroByte += 1;
    if (
      auto.exclusionReasonCode === "EXECUTABLE" ||
      auto.exclusionReasonCode === "EXECUTABLE_LIBRARY"
    ) {
      counts.executable += 1;
    }
    if (cap.knowledgeEligible) counts.includedEligible.push(f.path);
    if (!cap.knowledgeEligible) {
      // would be mismatch if forced INCLUDED
      counts.mismatchIfIncluded.push(f.path);
    }
    rows.push({
      path: f.path,
      sizeBytes,
      decision: auto.decision,
      reason: auto.exclusionReasonCode,
      capability: cap.capability,
      parser: cap.parser,
      knowledgeEligible: cap.knowledgeEligible,
    });
  }

  const outDir = path.join(process.cwd(), "tmp-p4-3-validation");
  mkdirSync(outDir, { recursive: true });
  const summary = {
    zipPath,
    zipBytes: bytes.byteLength,
    ...counts,
    includedEligibleCount: counts.includedEligible.length,
    sampleEligible: counts.includedEligible.slice(0, 30),
    sampleExcluded: rows.filter((r) => r.decision === "EXCLUDED").slice(0, 30),
  };
  writeFileSync(path.join(outDir, "inventory-capability-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(path.join(outDir, "inventory-capability-rows.json"), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
