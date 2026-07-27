/**
 * Admin "사전정리" — scan Provider-submitted ZIP central directory and flag
 * exclusion candidates using the Worker default policy (no Worker execution).
 */
import yauzl from "yauzl";
import {
  buildZipExclusionPolicy,
  evaluateZipEntryExclusion,
  type ZipExclusionPolicy,
  type ZipExclusionReason,
} from "@/lib/python-worker/zip-exclusion-policy";

export type ZipPreflightEntryKind = "file" | "folder";

export type ZipPreflightInventoryEntry = {
  path: string;
  kind: ZipPreflightEntryKind;
  /** File extension including dot; empty for folders / extensionless files. */
  extension: string;
  sizeBytes: number | null;
  exclusionCandidate: boolean;
  exclusionReason: ZipExclusionReason | null;
  exclusionDetail: string | null;
};

export type ZipPreflightInventory = {
  originalFileName: string | null;
  zipSizeBytes: number;
  entryCount: number;
  fileCount: number;
  folderCount: number;
  exclusionCandidateCount: number;
  entries: ZipPreflightInventoryEntry[];
};

function openZipFromBuffer(bytes: Uint8Array): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      Buffer.from(bytes),
      { lazyEntries: true, validateEntrySizes: true },
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

function extensionOf(entryPath: string, isDirectory: boolean): string {
  if (isDirectory) return "";
  const base = entryPath.split("/").pop() ?? entryPath;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

/**
 * List ZIP entries (central directory only) and mark exclusion candidates.
 */
export async function buildZipPreflightInventory(
  bytes: Uint8Array,
  options?: {
    originalFileName?: string | null;
    policy?: ZipExclusionPolicy;
  },
): Promise<ZipPreflightInventory> {
  const policy = options?.policy ?? buildZipExclusionPolicy();
  const zip = await openZipFromBuffer(bytes);
  const entries: ZipPreflightInventoryEntry[] = [];

  await new Promise<void>((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", () => resolve());
    zip.on("entry", (entry: yauzl.Entry) => {
      const rawPath = entry.fileName.replace(/\\/g, "/");
      const isDirectory = /\/$/.test(rawPath);
      const path = rawPath.replace(/\/+$/, "") || rawPath;
      const sizeBytes = isDirectory ? null : Number(entry.uncompressedSize ?? 0);
      const exclusion = isDirectory
        ? null
        : evaluateZipEntryExclusion(policy, path, sizeBytes);
      entries.push({
        path,
        kind: isDirectory ? "folder" : "file",
        extension: extensionOf(path, isDirectory),
        sizeBytes,
        exclusionCandidate: Boolean(exclusion),
        exclusionReason: exclusion?.reason ?? null,
        exclusionDetail: exclusion?.detail ?? null,
      });
      zip.readEntry();
    });
    zip.readEntry();
  });

  entries.sort((a, b) => a.path.localeCompare(b.path, "ko"));
  const fileCount = entries.filter((e) => e.kind === "file").length;
  const folderCount = entries.filter((e) => e.kind === "folder").length;
  const exclusionCandidateCount = entries.filter((e) => e.exclusionCandidate).length;

  return {
    originalFileName: options?.originalFileName?.trim() || null,
    zipSizeBytes: bytes.byteLength,
    entryCount: entries.length,
    fileCount,
    folderCount,
    exclusionCandidateCount,
    entries,
  };
}
