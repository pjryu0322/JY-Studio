import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "@/lib/distribution/payload-checksum";
import type {
  PayloadStorage,
  PayloadStorageSaveInput,
  PayloadStorageSaveResult,
} from "@/lib/distribution/payload-storage";

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function defaultStorageRoot(): string {
  return path.join(process.cwd(), "storage", "payloads");
}

export function resolvePayloadStorageRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.JYKSTORE_PAYLOAD_STORAGE_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return defaultStorageRoot();
}

function assertSafeId(label: string, value: string): void {
  if (!value || !SAFE_ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label} for payload storage path`);
  }
}

function createStorageFileId(): string {
  // cuid-like unique id; never derived from the user filename
  return `c${randomBytes(12).toString("hex")}`;
}

function resolveUnderRoot(root: string, storagePath: string): string {
  if (!storagePath || storagePath.includes("\0")) {
    throw new Error("Invalid storage path");
  }
  const normalized = storagePath.replace(/\\/g, "/");
  if (
    path.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error("Invalid storage path");
  }
  const absolute = path.resolve(root, ...normalized.split("/"));
  const relative = path.relative(root, absolute);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes(`..${path.sep}`)
  ) {
    throw new Error("Storage path escapes root");
  }
  return absolute;
}

export class LocalPayloadStorage implements PayloadStorage {
  readonly root: string;

  constructor(root: string = resolvePayloadStorageRoot()) {
    this.root = path.resolve(root);
  }

  async save(input: PayloadStorageSaveInput): Promise<PayloadStorageSaveResult> {
    assertSafeId("packId", input.packId);
    assertSafeId("versionId", input.versionId);

    const fileId = createStorageFileId();
    const relativePath = `${input.packId}/${input.versionId}/${fileId}.zip`;
    const absolutePath = resolveUnderRoot(this.root, relativePath);
    const dir = path.dirname(absolutePath);
    const tempPath = `${absolutePath}.${randomBytes(4).toString("hex")}.tmp`;

    await mkdir(dir, { recursive: true });

    const checksumSha256 = sha256Hex(input.bytes);

    try {
      await writeFile(tempPath, Buffer.from(input.bytes));
      await rename(tempPath, absolutePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }

    return {
      storagePath: relativePath.replace(/\\/g, "/"),
      fileSize: input.bytes.byteLength,
      checksumSha256,
    };
  }

  async read(storagePath: string): Promise<Uint8Array> {
    const absolutePath = resolveUnderRoot(this.root, storagePath);
    const buffer = await readFile(absolutePath);
    return new Uint8Array(buffer);
  }

  async delete(storagePath: string): Promise<void> {
    const absolutePath = resolveUnderRoot(this.root, storagePath);
    await rm(absolutePath, { force: true });
  }
}
