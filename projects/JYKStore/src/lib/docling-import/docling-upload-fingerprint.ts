/**
 * Resume fingerprints for Docling multipart uploads (head/tail SHA-256 slices).
 * Works in browser (Web Crypto) and Node 22+ (global crypto.subtle).
 */

export const DOCLING_FINGERPRINT_SLICE_BYTES = 1024 * 1024;

export type DoclingFileFingerprint = {
  name: string;
  size: number;
  lastModified: number;
  headSha256: string;
  tailSha256: string;
};

export type DoclingRoleFingerprintMap = Partial<
  Record<"SOURCE_ORIGINAL" | "DOCLING_JSON" | "DOCLING_MARKDOWN", DoclingFileFingerprint>
>;

export type StoredDoclingUploadSession = {
  sessionId: string;
  fingerprints: DoclingRoleFingerprintMap;
};

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

/** SHA-256 hex of an ArrayBuffer / TypedArray view (unit-test friendly). */
export async function sha256HexOfArrayBuffer(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  const buffer =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
  return bytesToHex(digest);
}

export async function computeHeadTailSha256FromSlices(input: {
  size: number;
  headBytes: ArrayBuffer | Uint8Array;
  tailBytes: ArrayBuffer | Uint8Array;
}): Promise<{ headSha256: string; tailSha256: string }> {
  const [headSha256, tailSha256] = await Promise.all([
    sha256HexOfArrayBuffer(input.headBytes),
    sha256HexOfArrayBuffer(input.tailBytes),
  ]);
  return { headSha256, tailSha256 };
}

type Sliceable = {
  size: number;
  name: string;
  lastModified: number;
  slice: (start: number, end?: number) => Blob;
};

export async function computeFileFingerprint(file: Sliceable): Promise<DoclingFileFingerprint> {
  const sliceBytes = DOCLING_FINGERPRINT_SLICE_BYTES;
  const headEnd = Math.min(sliceBytes, file.size);
  const tailStart = Math.max(0, file.size - sliceBytes);
  const headBuf = await file.slice(0, headEnd).arrayBuffer();
  const tailBuf = await file.slice(tailStart, file.size).arrayBuffer();
  const { headSha256, tailSha256 } = await computeHeadTailSha256FromSlices({
    size: file.size,
    headBytes: headBuf,
    tailBytes: tailBuf,
  });
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    headSha256,
    tailSha256,
  };
}

export type FingerprintComparable = {
  originalFileName?: string | null;
  name?: string | null;
  declaredFileSize?: number | null;
  size?: number | null;
  lastModifiedMs?: number | bigint | null;
  lastModified?: number | null;
  headSha256?: string | null;
  tailSha256?: string | null;
};

/**
 * True when selected file fingerprint matches server (preferred) or stored fingerprint.
 */
export function fingerprintsMatch(
  selected: DoclingFileFingerprint,
  expected: FingerprintComparable | null | undefined,
): boolean {
  if (!expected) return false;
  const name = expected.originalFileName ?? expected.name ?? null;
  const size = expected.declaredFileSize ?? expected.size ?? null;
  const lastModifiedRaw = expected.lastModifiedMs ?? expected.lastModified ?? null;
  const lastModified =
    lastModifiedRaw == null
      ? null
      : typeof lastModifiedRaw === "bigint"
        ? Number(lastModifiedRaw)
        : lastModifiedRaw;
  if (name != null && name !== selected.name) return false;
  if (size != null && Number(size) !== selected.size) return false;
  if (lastModified != null && lastModified !== selected.lastModified) return false;
  if (expected.headSha256 && expected.headSha256 !== selected.headSha256) return false;
  if (expected.tailSha256 && expected.tailSha256 !== selected.tailSha256) return false;
  // Require at least size + one hash when server has hashes.
  if (expected.headSha256 || expected.tailSha256) {
    return (
      Number(size) === selected.size &&
      (!expected.headSha256 || expected.headSha256 === selected.headSha256) &&
      (!expected.tailSha256 || expected.tailSha256 === selected.tailSha256)
    );
  }
  // Legacy sessions without hashes: name+size+lastModified when present.
  return (
    (name == null || name === selected.name) &&
    (size == null || Number(size) === selected.size) &&
    (lastModified == null || lastModified === selected.lastModified)
  );
}

export const DOCLING_RESUME_FINGERPRINT_MISMATCH_MESSAGE =
  "선택한 파일이 이어받기 세션에 저장된 파일과 일치하지 않습니다. 새 업로드 세션으로 다시 시작합니다.";
