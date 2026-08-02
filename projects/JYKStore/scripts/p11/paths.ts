import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const BACKUP_DIR = join(ROOT, "tmp-p11-clean-reset", "backup");
export const MANIFEST_DIR = join(ROOT, "tmp-p11-clean-reset");

export function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function loadDotEnvKeys(keys: string[]): void {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const key of keys) {
    if (process.env[key]?.trim()) continue;
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, "m"));
    if (!match?.[1]) continue;
    let value = match[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function ensureDatabaseUrlFromDotEnv(): void {
  loadDotEnvKeys([
    "DATABASE_URL",
    "JYKSTORE_PAYLOAD_STORAGE_DRIVER",
    "JYKSTORE_PAYLOAD_S3_ENDPOINT",
    "JYKSTORE_PAYLOAD_S3_REGION",
    "JYKSTORE_PAYLOAD_S3_BUCKET",
    "JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID",
    "JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY",
    "JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE",
    "JYKSTORE_PAYLOAD_S3_PREFIX",
    "JYKSTORE_PAYLOAD_S3_SERVER_SIDE_ENCRYPTION",
    "JYKSTORE_ADMIN_EMAILS",
  ]);
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}
