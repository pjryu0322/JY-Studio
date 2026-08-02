import { join } from "node:path";
import { dbInventory } from "../db/db-inventory.ts";
import { collectVerifyFailures } from "../db/db-verifier.ts";
import { MANIFEST_DIR, writeJson } from "../paths.ts";
import {
  assertBucket,
  createS3,
  objectInventory,
} from "../storage/object-inventory.ts";

export async function cmdVerify() {
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);

  const { failures, roleCounts, providerProfileCount } =
    await collectVerifyFailures(db, objects);

  const report = {
    at: new Date().toISOString(),
    pass: failures.length === 0,
    failures,
    roleCounts,
    userEmails: db.users.map((u) => u.email),
    providerProfileCount,
    packCount: db.packs.length,
    objectCount: objects.totals.count,
    categories: db.categories,
    structureTemplates: db.structureTemplates,
    tables: db.tables.filter((t) => t.count !== 0),
  };
  writeJson(join(MANIFEST_DIR, "verify-latest.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error("P11 CLEAN RESET BLOCKED — verify failed");
    process.exitCode = 2;
  } else {
    console.log("P11 VERIFY PASS");
  }
  return report;
}
