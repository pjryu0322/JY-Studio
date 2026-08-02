import { join } from "node:path";
import { dbInventory } from "../db/db-inventory.ts";
import { MANIFEST_DIR, writeJson } from "../paths.ts";
import {
  assertBucket,
  createS3,
  objectInventory,
} from "../storage/object-inventory.ts";

export async function cmdInventory() {
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);
  const report = {
    at: new Date().toISOString(),
    bucket: s3.bucket,
    prefix: s3.prefix,
    db,
    objects: {
      totals: objects.totals,
      missingCount: objects.missingObjects.length,
      byClass: Object.fromEntries(
        [
          "ACTIVE_REFERENCED",
          "LEGACY_REFERENCED",
          "ORPHAN_OBJECT",
          "MISSING_OBJECT",
          "UNKNOWN",
        ].map((c) => [
          c,
          objects.objects.filter((o) => o.classification === c).length,
        ]),
      ),
      sample: objects.objects.slice(0, 50).map((o) => ({
        key: o.key,
        size: o.size,
        classification: o.classification,
        packId: o.packId,
      })),
    },
  };
  writeJson(join(MANIFEST_DIR, "inventory-latest.json"), report);
  console.log(JSON.stringify(report, null, 2));
  return report;
}
