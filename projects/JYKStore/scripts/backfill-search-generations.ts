/**
 * Backfill SearchIndexGeneration rows from legacy KnowledgeChunk.metadata.
 *
 * Dry-run (default): projects what would be created without writing.
 *   npm run backfill:search-generations
 * Apply:
 *   npm run backfill:search-generations -- --apply
 * Single version:
 *   npm run backfill:search-generations -- --apply --version <versionId>
 *
 * Idempotent: existing generations (id = historical indexGenerationId) are reused,
 * never duplicated or demoted.
 */
import { backfillSearchGenerations } from "../src/lib/search-generation/search-generation-backfill";
import { prisma } from "../src/lib/prisma";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const versionId = argValue("--version");
  const dryRun = !apply;

  console.log(
    `[backfill-search-generations] mode=${dryRun ? "DRY-RUN" : "APPLY"}${
      versionId ? ` version=${versionId}` : ""
    }`,
  );

  const report = await backfillSearchGenerations({ versionId, dryRun });
  console.log("[backfill-search-generations] report:");
  console.log(JSON.stringify(report, null, 2));

  if (dryRun) {
    console.log("[backfill-search-generations] dry-run only. Re-run with --apply to write.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[backfill-search-generations] failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
