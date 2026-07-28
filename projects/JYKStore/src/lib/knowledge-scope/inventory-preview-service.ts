import { KnowledgeScopeInventoryError } from "@/lib/knowledge-scope/inventory-types";
import { previewKindForExtension } from "@/lib/knowledge-scope/inventory-auto-exclude";
import { prisma } from "@/lib/prisma";
import { validateZipAndReadSelectedEntries } from "@/lib/distribution/payload-zip-reader";

const TEXT_PREVIEW_MAX_BYTES = 256 * 1024;
const BINARY_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

export type InventoryPreviewResult =
  | {
      kind: "text";
      itemId: string;
      relativePath: string;
      mimeType: string;
      truncated: boolean;
      text: string;
      sizeBytes: number;
    }
  | {
      kind: "pdf" | "image";
      itemId: string;
      relativePath: string;
      mimeType: string;
      sizeBytes: number;
      bytes: Uint8Array;
    }
  | {
      kind: "unsupported";
      itemId: string;
      relativePath: string;
      mimeType: string | null;
      sizeBytes: number;
      message: string;
    };

function extensionOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

function mimeForPreviewKind(kind: string, extension: string): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "image") {
    if (extension === ".png") return "image/png";
    if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
    if (extension === ".gif") return "image/gif";
    if (extension === ".webp") return "image/webp";
    if (extension === ".svg") return "image/svg+xml";
    return "application/octet-stream";
  }
  if (kind === "text") {
    if (extension === ".json") return "application/json";
    if (extension === ".md" || extension === ".markdown") return "text/markdown; charset=utf-8";
    if (extension === ".html" || extension === ".htm") return "text/html; charset=utf-8";
    if (extension === ".css") return "text/css; charset=utf-8";
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
}

async function loadZipBytesForInventory(input: {
  packId: string;
  versionId: string;
  workingCopyId?: string | null;
  env?: NodeJS.ProcessEnv;
}): Promise<Uint8Array> {
  if (input.workingCopyId) {
    const {
      getWorkerZipWorkingCopyById,
      getWorkerZipWorkingCopyBytes,
    } = await import("@/lib/python-worker/worker-zip-working-copy-service");
    const workingCopy = await getWorkerZipWorkingCopyById({
      workingCopyId: input.workingCopyId,
    });
    if (workingCopy) {
      return getWorkerZipWorkingCopyBytes({ workingCopy, env: input.env });
    }
  }

  throw new KnowledgeScopeInventoryError(
    "WORKING_COPY_REQUIRED",
    "Working Copy를 찾을 수 없어 미리보기할 수 없습니다.",
    404,
  );
}

export async function getInventoryItemPreview(input: {
  packId: string;
  itemId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
}): Promise<InventoryPreviewResult> {
  const client = input.prismaClient ?? prisma;
  const item = await client.knowledgeScopeInventoryItem.findUnique({
    where: { id: input.itemId },
    include: {
      inventory: {
        select: { id: true, packId: true, versionId: true, workingCopyId: true },
      },
    },
  });
  if (!item || item.inventory.packId !== input.packId) {
    throw new KnowledgeScopeInventoryError("ITEM_NOT_FOUND", "인벤토리 항목을 찾을 수 없습니다.", 404);
  }

  const extension = item.extension || extensionOf(item.relativePath);
  const kind = item.previewKind || previewKindForExtension(extension);

  if (kind === "unsupported") {
    return {
      kind: "unsupported",
      itemId: item.id,
      relativePath: item.relativePath,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      message: "이 파일 유형은 미리보기를 지원하지 않습니다.",
    };
  }

  if (item.sizeBytes > BINARY_PREVIEW_MAX_BYTES && kind !== "text") {
    return {
      kind: "unsupported",
      itemId: item.id,
      relativePath: item.relativePath,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      message: "파일이 너무 커서 미리보기할 수 없습니다.",
    };
  }

  const zipBytes = await loadZipBytesForInventory({
    packId: item.inventory.packId,
    versionId: item.inventory.versionId,
    workingCopyId: item.inventory.workingCopyId,
    env: input.env,
  });

  const read = await validateZipAndReadSelectedEntries(zipBytes, [item.relativePath]);
  const content = read.selectedContents[item.relativePath.replace(/\\/g, "/")];
  if (!content) {
    // try case-insensitive / normalized key match
    const wanted = item.relativePath.replace(/\\/g, "/").toLowerCase();
    const matchedKey = Object.keys(read.selectedContents).find(
      (k) => k.replace(/\\/g, "/").toLowerCase() === wanted,
    );
    if (!matchedKey) {
      throw new KnowledgeScopeInventoryError(
        "ENTRY_NOT_FOUND",
        "ZIP에서 해당 파일을 찾을 수 없습니다.",
        404,
      );
    }
    return buildPreviewFromBytes({
      itemId: item.id,
      relativePath: item.relativePath,
      kind,
      extension,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      bytes: read.selectedContents[matchedKey]!,
    });
  }

  return buildPreviewFromBytes({
    itemId: item.id,
    relativePath: item.relativePath,
    kind,
    extension,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    bytes: content,
  });
}

function buildPreviewFromBytes(input: {
  itemId: string;
  relativePath: string;
  kind: string;
  extension: string;
  mimeType: string | null;
  sizeBytes: number;
  bytes: Uint8Array;
}): InventoryPreviewResult {
  const mime = input.mimeType || mimeForPreviewKind(input.kind, input.extension);

  if (input.kind === "text") {
    const slice = input.bytes.byteLength > TEXT_PREVIEW_MAX_BYTES
      ? input.bytes.subarray(0, TEXT_PREVIEW_MAX_BYTES)
      : input.bytes;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    return {
      kind: "text",
      itemId: input.itemId,
      relativePath: input.relativePath,
      mimeType: mime,
      truncated: input.bytes.byteLength > TEXT_PREVIEW_MAX_BYTES,
      text,
      sizeBytes: input.sizeBytes,
    };
  }

  if (input.kind === "pdf" || input.kind === "image") {
    return {
      kind: input.kind,
      itemId: input.itemId,
      relativePath: input.relativePath,
      mimeType: mime,
      sizeBytes: input.sizeBytes,
      bytes: input.bytes,
    };
  }

  return {
    kind: "unsupported",
    itemId: input.itemId,
    relativePath: input.relativePath,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    message: "이 파일 유형은 미리보기를 지원하지 않습니다.",
  };
}
