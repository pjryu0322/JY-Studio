import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dbInventory } from "../db/db-inventory.ts";
import { P11_CANONICAL_ACCOUNTS } from "../policy/reset-allowlist.ts";
import {
  BACKUP_DIR,
  env,
  MANIFEST_DIR,
  writeJson,
} from "../paths.ts";
import {
  assertBucket,
  createS3,
  objectInventory,
} from "../storage/object-inventory.ts";

export async function cmdBackup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);

  // Safe account export (no secrets)
  writeJson(join(BACKUP_DIR, "accounts-allowlist.json"), {
    at: new Date().toISOString(),
    canonical: P11_CANONICAL_ACCOUNTS,
    currentUsers: db.users.map((u) => ({
      id: u.id,
      email: u.email,
      accountRole: u.accountRole,
      keep: u.keep,
    })),
    categories: db.categories,
    packs: db.packs,
  });

  writeJson(join(BACKUP_DIR, "object-manifest.json"), {
    at: new Date().toISOString(),
    bucket: s3.bucket,
    prefix: s3.prefix,
    objects: objects.objects.map((o) => ({
      key: o.key,
      size: o.size,
      lastModified: o.lastModified,
      classification: o.classification,
      packId: o.packId,
    })),
  });

  writeJson(join(BACKUP_DIR, "db-inventory.json"), db);

  // Attempt pg_dump if available (strip Prisma ?schema= query which pg_dump rejects)
  let pgDump: { ok: boolean; path?: string; error?: string } = { ok: false };
  const dumpPath = join(BACKUP_DIR, "jykstore-p11.dump");
  try {
    const { spawnSync } = await import("node:child_process");
    let databaseUrl = env("DATABASE_URL");
    try {
      const u = new URL(databaseUrl);
      u.search = "";
      databaseUrl = u.toString();
    } catch {
      databaseUrl = databaseUrl.replace(/\?.*$/, "");
    }
    const result = spawnSync(
      "pg_dump",
      ["--format=custom", `--file=${dumpPath}`, databaseUrl],
      { encoding: "utf8" },
    );
    if (result.status === 0 && existsSync(dumpPath)) {
      pgDump = { ok: true, path: "tmp-p11-clean-reset/backup/jykstore-p11.dump" };
    } else {
      pgDump = {
        ok: false,
        error: (result.stderr || result.error?.message || "pg_dump failed").slice(0, 500),
      };
      writeJson(join(BACKUP_DIR, "pg-dump-status.json"), pgDump);
    }
  } catch (error) {
    pgDump = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    writeJson(join(BACKUP_DIR, "pg-dump-status.json"), pgDump);
  }

  const marker = {
    at: new Date().toISOString(),
    backupDir: "tmp-p11-clean-reset/backup",
    pgDump,
    objectCount: objects.totals.count,
    objectBytes: objects.totals.bytes,
    userCount: db.users.length,
    packCount: db.packs.length,
  };
  writeJson(join(BACKUP_DIR, "BACKUP_COMPLETE.json"), marker);
  writeJson(join(MANIFEST_DIR, "backup-latest.json"), marker);
  console.log(JSON.stringify(marker, null, 2));
  if (!pgDump.ok) {
    console.warn(
      "[p11] pg_dump unavailable/failed — JSON inventory + object manifest still written (acceptable local backup).",
    );
  }
  return marker;
}
