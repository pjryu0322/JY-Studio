import { join } from "node:path";
import { dbInventory } from "../db/db-inventory.ts";
import { P11_CANONICAL_ACCOUNTS } from "../policy/reset-allowlist.ts";
import { env, MANIFEST_DIR, writeJson } from "../paths.ts";
import {
  assertBucket,
  createS3,
  objectInventory,
} from "../storage/object-inventory.ts";

export async function cmdDryRun() {
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);

  const blockers: string[] = [];
  if (objects.totals.unknownCount > 0) {
    blockers.push(`UNKNOWN objects: ${objects.totals.unknownCount}`);
  }
  // Missing objects are integrity findings — classify but do not auto-block if they
  // belong to packs we will delete (DB rows go away). Still report them.
  const missingOnDeleteTargets = objects.missingObjects.length;

  const keepUsers = db.users.filter((u) => u.keep);
  const deleteUsers = db.users.filter((u) => !u.keep);

  // Allowlist readiness: we will CREATE canonical accounts if missing.
  const missingCanonical = P11_CANONICAL_ACCOUNTS.filter(
    (a) => !db.users.some((u) => u.email?.toLowerCase() === a.email),
  );

  const deleteKeys = objects.objects
    .filter((o) => o.classification !== "MISSING_OBJECT")
    .map((o) => o.key);

  const packRelatedDeletes = db.tables
    .filter((t) => t.packRelated && t.count > 0)
    .map((t) => ({ model: t.model, count: t.count }));

  const report = {
    at: new Date().toISOString(),
    mode: "DRY-RUN",
    accounts: {
      keep: keepUsers.map((u) => ({ email: u.email, role: u.accountRole })),
      delete: deleteUsers.map((u) => ({ email: u.email, role: u.accountRole })),
      willCreate: missingCanonical.map((a) => a.email),
      target: P11_CANONICAL_ACCOUNTS.map((a) => ({
        email: a.email,
        role: a.accountRole,
      })),
    },
    packs: {
      keep: 0,
      delete: db.packs.map((p) => p.packId),
      count: db.packs.length,
    },
    categoriesKeep: db.categories,
    structureTemplatesKeep: db.structureTemplates,
    packRelatedDeletes,
    objects: {
      deleteCount: deleteKeys.length,
      deleteBytes: objects.totals.bytes,
      orphanCount: objects.totals.orphanCount,
      unknownCount: objects.totals.unknownCount,
      missingObjectFindings: missingOnDeleteTargets,
    },
    blockers,
    safeToExecute:
      blockers.length === 0 &&
      Boolean(env("JYKSTORE_PAYLOAD_S3_BUCKET")) &&
      Boolean(env("DATABASE_URL")),
  };

  writeJson(join(MANIFEST_DIR, "dry-run-latest.json"), {
    ...report,
    // full key list stays local, not for git
    deleteKeys,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.safeToExecute) {
    console.error("P11 CLEAN RESET BLOCKED — see blockers");
    process.exitCode = 2;
  }
  return report;
}
