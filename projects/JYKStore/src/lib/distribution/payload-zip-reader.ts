import yauzl from "yauzl";
import type { PayloadZipEntry } from "@/lib/distribution/payload-types";
import { getPayloadLimitConfig, type PayloadLimitConfig } from "@/lib/distribution/payload-limit-config";
import { findUnsafeZipPathReason } from "@/lib/distribution/payload-zip-path";
import { PAYLOAD_FORBIDDEN_EXTENSIONS } from "@/lib/distribution/payload-types";

const UNIX_S_IFMT = 0xf000;
const UNIX_S_IFLNK = 0xa000;
const GP_ENCRYPTED = 0x1;

export type ZipCentralEntry = PayloadZipEntry & {
  compressedSize: number;
  isDirectory: boolean;
  isEncrypted: boolean;
  isSymlink: boolean;
};

export type ZipReadResult = {
  ok: boolean;
  entries: ZipCentralEntry[];
  selectedContents: Record<string, Uint8Array>;
  totalCompressedBytes: number;
  totalUncompressedBytes: number;
  warnings: string[];
  errors: string[];
};

function extensionOf(entryPath: string): string {
  const base = entryPath.split("/").pop() ?? entryPath;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function isUnixSymlink(externalFileAttributes: number): boolean {
  const mode = (externalFileAttributes >>> 16) & 0xffff;
  return (mode & UNIX_S_IFMT) === UNIX_S_IFLNK;
}

function openZipFromBuffer(bytes: Uint8Array): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes),
      {
        lazyEntries: true,
        validateEntrySizes: true,
      },
      (error, zip) => {
        if (error || !zip) {
          reject(error ?? new Error("Failed to open ZIP"));
          return;
        }
        resolve(zip);
      },
    );
  });
}

function readEntryBuffer(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(err ?? new Error("Failed to open entry stream"));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    });
  });
}

/**
 * Validate ZIP via central directory metadata (yauzl.fromBuffer) and optionally read selected entries.
 * Never writes ZIP bytes to the local filesystem.
 */
export async function validateZipAndReadSelectedEntries(
  bytes: Uint8Array,
  requestedEntrypoints: string[] = [],
  limits: PayloadLimitConfig = getPayloadLimitConfig(),
): Promise<ZipReadResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: ZipCentralEntry[] = [];
  const selectedContents: Record<string, Uint8Array> = {};
  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;

  if (!bytes || bytes.byteLength === 0) {
    return {
      ok: false,
      entries: [],
      selectedContents: {},
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      warnings,
      errors: ["ZIP is empty"],
    };
  }
  if (bytes.byteLength > limits.maxZipBytes) {
    return {
      ok: false,
      entries: [],
      selectedContents: {},
      totalCompressedBytes: 0,
      totalUncompressedBytes: 0,
      warnings,
      errors: [`ZIP exceeds maximum size of ${limits.maxZipBytes} bytes`],
    };
  }

  const requested = new Set(
    requestedEntrypoints.map((p) => p.replace(/\\/g, "/").replace(/^\/+/, "")),
  );

  try {
    const zip = await openZipFromBuffer(bytes);

    await new Promise<void>((resolve, reject) => {
      const seen = new Set<string>();

      zip.on("error", reject);
      zip.on("end", () => resolve());
      zip.on("entry", (entry: yauzl.Entry) => {
        void (async () => {
          try {
            const rawPath = entry.fileName;
            const displayPath = rawPath.replace(/\\/g, "/");
            const isDirectory = /\/$/.test(displayPath);
            const pathReason = findUnsafeZipPathReason(rawPath, limits.maxPathLength);
            if (pathReason) {
              errors.push(pathReason);
              zip.readEntry();
              return;
            }

            const encrypted = Boolean((entry.generalPurposeBitFlag ?? 0) & GP_ENCRYPTED);
            const symlink = isUnixSymlink(entry.externalFileAttributes ?? 0);
            if (encrypted) {
              errors.push(`Encrypted entry not allowed: ${displayPath}`);
            }
            if (symlink) {
              errors.push(`Symbolic links are not allowed: ${displayPath}`);
            }

            const normalizedKey = displayPath.replace(/\/+$/, "").toLowerCase();
            if (seen.has(normalizedKey)) {
              errors.push(`Duplicate entry path: ${displayPath}`);
            } else {
              seen.add(normalizedKey);
            }

            const compressedSize = entry.compressedSize ?? 0;
            const uncompressedSize = entry.uncompressedSize ?? 0;

            if (!isDirectory) {
              const ext = extensionOf(displayPath);
              if ((PAYLOAD_FORBIDDEN_EXTENSIONS as readonly string[]).includes(ext)) {
                errors.push(`Forbidden file extension (${ext}): ${displayPath}`);
              }
              if (uncompressedSize > limits.maxSingleEntryBytes) {
                errors.push(
                  `Entry exceeds single-entry size limit (${uncompressedSize} > ${limits.maxSingleEntryBytes}): ${displayPath}`,
                );
              }
              if (
                uncompressedSize >= limits.compressionRatioMinUncompressedBytes &&
                uncompressedSize / Math.max(compressedSize, 1) > limits.maxCompressionRatio
              ) {
                errors.push(`Suspicious compression ratio for ${displayPath}`);
              }
              totalCompressedBytes += compressedSize;
              totalUncompressedBytes += uncompressedSize;
            }

            entries.push({
              path: displayPath,
              uncompressedSize: isDirectory ? 0 : uncompressedSize,
              compressedSize,
              isDirectory,
              isEncrypted: encrypted,
              isSymlink: symlink,
            });

            const normalizedPath = displayPath.replace(/^\/+/, "");
            if (!isDirectory && requested.has(normalizedPath)) {
              const content = await readEntryBuffer(zip, entry);
              selectedContents[normalizedPath] = content;
            }

            zip.readEntry();
          } catch (error) {
            reject(error);
          }
        })();
      });

      zip.readEntry();
    });

    if (entries.length === 0) {
      errors.push("ZIP has no entries");
    }
    if (entries.length > limits.maxEntries) {
      errors.push(`ZIP has too many entries (${entries.length} > ${limits.maxEntries})`);
    }
    if (totalUncompressedBytes > limits.maxUnpackedBytes) {
      errors.push(
        `Unpacked size exceeds limit (${totalUncompressedBytes} > ${limits.maxUnpackedBytes})`,
      );
    }
    const fileEntries = entries.filter((e) => !e.isDirectory);
    if (fileEntries.length === 0 && errors.length === 0) {
      errors.push("ZIP contains no files");
    }

    return {
      ok: errors.length === 0,
      entries,
      selectedContents,
      totalCompressedBytes,
      totalUncompressedBytes,
      warnings,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) {
      return {
        ok: false,
        entries,
        selectedContents,
        totalCompressedBytes,
        totalUncompressedBytes,
        warnings,
        errors: ["Encrypted ZIP entries are not allowed"],
      };
    }
    return {
      ok: false,
      entries,
      selectedContents,
      totalCompressedBytes,
      totalUncompressedBytes,
      warnings,
      errors: [`Invalid ZIP: ${message}`],
    };
  }
}
