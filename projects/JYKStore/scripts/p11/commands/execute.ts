import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureStructureTemplatesSeeded } from "../../../src/lib/structure-quality/structure-template-service.ts";
import { prisma } from "../db/client.ts";
import {
  deleteAllPackRelated,
  deleteNonCanonicalAccounts,
  seedCanonicalAccounts,
  seedCategories,
} from "../db/db-reset.ts";
import { BACKUP_DIR, MANIFEST_DIR, writeJson } from "../paths.ts";
import {
  assertBucket,
  createS3,
  objectInventory,
} from "../storage/object-inventory.ts";
import { deleteObjects } from "../storage/object-reset.ts";
import { cmdDryRun } from "./dry-run.ts";

async function requireBackupComplete(): Promise<void> {
  const marker = join(BACKUP_DIR, "BACKUP_COMPLETE.json");
  if (!existsSync(marker)) {
    throw new Error("Backup incomplete: run `backup` before execute");
  }
}

export async function cmdExecute() {
  await requireBackupComplete();
  const dry = await cmdDryRun();
  if (!dry.safeToExecute) {
    throw new Error("P11 CLEAN RESET BLOCKED by dry-run blockers");
  }

  const s3 = createS3();
  await assertBucket(s3);
  if (s3.prefix !== "payloads" && !s3.prefix.startsWith("payloads")) {
    // Soft check — allow configured prefix but refuse empty
    if (!s3.prefix) throw new Error("Refusing empty S3 prefix");
  }

  const objects = await objectInventory(s3);
  const deleteKeys = objects.objects
    .filter((o) => o.classification !== "MISSING_OBJECT")
    .map((o) => o.key);

  console.log(`[p11] deleting ${deleteKeys.length} objects…`);
  const objResult = await deleteObjects(s3, deleteKeys);
  writeJson(join(MANIFEST_DIR, "object-delete-manifest.json"), {
    at: new Date().toISOString(),
    deleted: objResult.deleted,
    failed: objResult.failed,
    keysAttempted: deleteKeys.length,
  });
  if (objResult.failed.length > 0) {
    throw new Error(`Object delete failed for ${objResult.failed.length} keys`);
  }

  console.log("[p11] deleting pack-related DB rows…");
  const packResult = await deleteAllPackRelated();

  console.log("[p11] deleting non-canonical accounts…");
  const accountResult = await deleteNonCanonicalAccounts();

  console.log("[p11] seeding categories + structure templates + 3 accounts…");
  await seedCategories();
  await ensureStructureTemplatesSeeded();
  const seed = await seedCanonicalAccounts();

  // Final wipe of leftover provider profiles except one
  const profiles = await prisma.providerProfile.findMany();
  if (profiles.length > 1) {
    await prisma.providerProfile.deleteMany({
      where: { id: { not: seed.providerProfileId } },
    });
  }

  const summary = {
    at: new Date().toISOString(),
    objectsDeleted: objResult.deleted,
    packsDeleted: packResult.deletedPacks,
    packIds: packResult.packIds,
    usersDeleted: accountResult.deletedUsers,
    seededUsers: seed.users,
    providerProfileId: seed.providerProfileId,
  };
  writeJson(join(MANIFEST_DIR, "execute-summary.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}
