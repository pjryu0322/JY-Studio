import JSZip from "jszip";
import {
  PAYLOAD_FORBIDDEN_EXTENSIONS,
  PAYLOAD_MAX_ENTRIES,
  PAYLOAD_MAX_PATH_LENGTH,
  PAYLOAD_MAX_SINGLE_ENTRY_BYTES,
  PAYLOAD_MAX_UNPACKED_BYTES,
  PAYLOAD_MAX_ZIP_BYTES,
  type PayloadZipEntry,
  type PayloadZipValidationResult,
} from "@/lib/distribution/payload-types";

const UNIX_S_IFMT = 0xf000;
const UNIX_S_IFLNK = 0xa000;

type ZipObjectWithMeta = JSZip.JSZipObject & {
  unsafeOriginalName?: string;
  _data?: { uncompressedSize?: number };
};

function normalizePathSeparators(raw: string): string {
  return raw.replace(/\\/g, "/");
}

function extensionOf(entryPath: string): string {
  const base = entryPath.split("/").pop() ?? entryPath;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function isUnixSymlink(unixPermissions: number | string | null | undefined): boolean {
  if (unixPermissions == null) return false;
  const mode =
    typeof unixPermissions === "string"
      ? Number.parseInt(unixPermissions, 8)
      : unixPermissions;
  if (!Number.isFinite(mode)) return false;
  return (mode & UNIX_S_IFMT) === UNIX_S_IFLNK;
}

function getUncompressedSize(entry: ZipObjectWithMeta): number {
  const size = entry._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : 0;
}

/**
 * Reject unsafe ZIP entry paths before trusting JSZip's resolved `name`.
 */
export function findUnsafeZipPathReason(rawPath: string): string | null {
  if (!rawPath) {
    return "Empty ZIP entry path";
  }
  if (rawPath.includes("\0")) {
    return `NUL character in path: ${rawPath}`;
  }
  if (rawPath.length > PAYLOAD_MAX_PATH_LENGTH) {
    return `Path exceeds ${PAYLOAD_MAX_PATH_LENGTH} characters: ${rawPath.slice(0, 80)}…`;
  }

  const normalized = normalizePathSeparators(rawPath);
  if (normalized.startsWith("/") || normalized.startsWith("//")) {
    return `Absolute path not allowed: ${rawPath}`;
  }
  if (/^[a-zA-Z]:(\/|$)/.test(normalized) || /^[a-zA-Z]:\\/.test(rawPath)) {
    return `Drive-letter path not allowed: ${rawPath}`;
  }
  if (normalized.startsWith("//") || rawPath.startsWith("\\\\")) {
    return `UNC / network path not allowed: ${rawPath}`;
  }

  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === ".." || part === ".") {
      if (part === "..") {
        return `Path traversal not allowed: ${rawPath}`;
      }
    }
  }
  if (normalized.includes("../") || normalized.includes("/..") || normalized === "..") {
    return `Path traversal not allowed: ${rawPath}`;
  }

  return null;
}

function collectZipObjects(zip: JSZip): ZipObjectWithMeta[] {
  const objects: ZipObjectWithMeta[] = [];
  zip.forEach((_relativePath, file) => {
    objects.push(file as ZipObjectWithMeta);
  });
  return objects;
}

export type ValidateZipBytesOptions = {
  maxZipBytes?: number;
  maxEntries?: number;
  maxUnpackedBytes?: number;
  maxSingleEntryBytes?: number;
};

/**
 * Validate ZIP bytes for upload safety (path traversal, zip bomb, executables, etc.).
 * Does not mutate the ZIP.
 */
export async function validateZipBytes(
  bytes: Uint8Array,
  options: ValidateZipBytesOptions = {},
): Promise<PayloadZipValidationResult> {
  const maxZipBytes = options.maxZipBytes ?? PAYLOAD_MAX_ZIP_BYTES;
  const maxEntries = options.maxEntries ?? PAYLOAD_MAX_ENTRIES;
  const maxUnpackedBytes = options.maxUnpackedBytes ?? PAYLOAD_MAX_UNPACKED_BYTES;
  const maxSingleEntryBytes =
    options.maxSingleEntryBytes ?? PAYLOAD_MAX_SINGLE_ENTRY_BYTES;

  const errors: string[] = [];

  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, entries: [], errors: ["ZIP is empty"] };
  }
  if (bytes.byteLength > maxZipBytes) {
    return {
      ok: false,
      entries: [],
      errors: [`ZIP exceeds maximum size of ${maxZipBytes} bytes`],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { createFolders: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) {
      return { ok: false, entries: [], errors: ["Encrypted ZIP entries are not allowed"] };
    }
    return { ok: false, entries: [], errors: [`Invalid ZIP: ${message}`] };
  }

  const objects = collectZipObjects(zip);
  if (objects.length === 0) {
    return { ok: false, entries: [], errors: ["ZIP has no entries"] };
  }
  if (objects.length > maxEntries) {
    errors.push(`ZIP has too many entries (${objects.length} > ${maxEntries})`);
  }

  const entries: PayloadZipEntry[] = [];
  const seenPaths = new Set<string>();
  let unpackedTotal = 0;

  for (const object of objects) {
    const rawPath = object.unsafeOriginalName ?? object.name;
    const displayPath = normalizePathSeparators(rawPath);

    const pathReason = findUnsafeZipPathReason(rawPath);
    if (pathReason) {
      errors.push(pathReason);
      continue;
    }

    if (isUnixSymlink(object.unixPermissions)) {
      errors.push(`Symbolic links are not allowed: ${displayPath}`);
      continue;
    }

    // JSZip throws on encrypted entries during load; keep a defensive check if exposed.
    const maybeEncrypted = (object as { encrypted?: boolean; options?: { encrypted?: boolean } })
      .encrypted;
    if (maybeEncrypted === true) {
      errors.push(`Encrypted entry not allowed: ${displayPath}`);
      continue;
    }

    const normalizedKey = displayPath.replace(/\/+$/, "").toLowerCase();
    if (seenPaths.has(normalizedKey)) {
      errors.push(`Duplicate entry path: ${displayPath}`);
      continue;
    }
    seenPaths.add(normalizedKey);

    if (!object.dir) {
      const ext = extensionOf(displayPath);
      if (
        (PAYLOAD_FORBIDDEN_EXTENSIONS as readonly string[]).includes(ext)
      ) {
        errors.push(`Forbidden file extension (${ext}): ${displayPath}`);
        continue;
      }
    }

    const uncompressedSize = object.dir ? 0 : getUncompressedSize(object);
    if (!object.dir) {
      if (uncompressedSize > maxSingleEntryBytes) {
        errors.push(
          `Entry exceeds single-entry size limit (${uncompressedSize} > ${maxSingleEntryBytes}): ${displayPath}`,
        );
      }
      unpackedTotal += uncompressedSize;
    }

    entries.push({ path: displayPath, uncompressedSize });
  }

  if (unpackedTotal > maxUnpackedBytes) {
    errors.push(
      `Unpacked size exceeds limit (${unpackedTotal} > ${maxUnpackedBytes})`,
    );
  }

  const fileEntries = entries.filter((e) => !e.path.endsWith("/"));
  if (fileEntries.length === 0 && errors.length === 0) {
    errors.push("ZIP contains no files");
  }

  return {
    ok: errors.length === 0,
    entries,
    errors,
  };
}
