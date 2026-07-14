/**
 * Resume fingerprints for Docling multipart uploads (head/tail SHA-256 slices).
 * Prefer Web Crypto (`globalThis.crypto.subtle`). Fall back to pure-JS SHA-256 when
 * subtle is missing (some non-secure Origins / odd browser contexts).
 *
 * Large files skip the tail slice: some browsers materialize the whole File when
 * seeking near EOF, which freezes 100MB+ uploads before the session is created.
 */

/** Sample size for head (and optional tail) SHA-256. */
export const DOCLING_FINGERPRINT_SLICE_BYTES = 256 * 1024;

/**
 * Above this size, only the head slice is hashed (tail is mirrored from head).
 * Avoids EOF seeks on huge Docling JSON / Markdown files.
 */
export const DOCLING_FINGERPRINT_TAIL_SKIP_BYTES = 32 * 1024 * 1024;

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

function toUint8Copy(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  return new Uint8Array(data.slice(0));
}

/**
 * Pure JS SHA-256 (for environments where `crypto.subtle` is undefined).
 * Not optimized — only used for small fingerprint slices (≤256 KiB).
 */
export function sha256HexFallback(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
    0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
    0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
    0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
    0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
    0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
    0xc67178f2,
  ]);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const len = bytes.length;
  const bitLenHi = Math.floor((len * 8) / 0x1_0000_0000);
  const bitLenLo = (len * 8) >>> 0;
  const withPad = new Uint8Array(((len + 9 + 63) & ~63));
  withPad.set(bytes);
  withPad[len] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 8, bitLenHi, false);
  dv.setUint32(withPad.length - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j += 1) {
      w[j] = dv.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j += 1) {
      const s0 = rotr(7, w[j - 15]!) ^ rotr(18, w[j - 15]!) ^ (w[j - 15]! >>> 3);
      const s1 = rotr(17, w[j - 2]!) ^ rotr(19, w[j - 2]!) ^ (w[j - 2]! >>> 10);
      w[j] = (w[j - 16]! + s0 + w[j - 7]! + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let j = 0; j < 64; j += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j]! + w[j]!) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  outDv.setUint32(0, h0, false);
  outDv.setUint32(4, h1, false);
  outDv.setUint32(8, h2, false);
  outDv.setUint32(12, h3, false);
  outDv.setUint32(16, h4, false);
  outDv.setUint32(20, h5, false);
  outDv.setUint32(24, h6, false);
  outDv.setUint32(28, h7, false);
  return bytesToHex(out);
}

export function isWebCryptoSubtleAvailable(): boolean {
  const subtle = globalThis.crypto?.subtle;
  return typeof subtle?.digest === "function";
}

/** SHA-256 hex of an ArrayBuffer / TypedArray view (unit-test friendly). */
export async function sha256HexOfArrayBuffer(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  const view = toUint8Copy(data);
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest === "function") {
    const digest = await subtle.digest("SHA-256", view);
    return bytesToHex(digest);
  }
  return sha256HexFallback(view);
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

export function shouldSkipFingerprintTail(size: number): boolean {
  return size > DOCLING_FINGERPRINT_TAIL_SKIP_BYTES;
}

export async function computeFileFingerprint(file: Sliceable): Promise<DoclingFileFingerprint> {
  const sliceBytes = DOCLING_FINGERPRINT_SLICE_BYTES;
  const headEnd = Math.min(sliceBytes, file.size);
  const headBuf = await file.slice(0, headEnd).arrayBuffer();
  const headSha256 = await sha256HexOfArrayBuffer(headBuf);

  let tailSha256 = headSha256;
  if (!shouldSkipFingerprintTail(file.size) && file.size > headEnd) {
    const tailStart = Math.max(0, file.size - sliceBytes);
    const tailBuf = await file.slice(tailStart, file.size).arrayBuffer();
    tailSha256 = await sha256HexOfArrayBuffer(tailBuf);
  }

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
  if (expected.headSha256 || expected.tailSha256) {
    return (
      Number(size) === selected.size &&
      (!expected.headSha256 || expected.headSha256 === selected.headSha256) &&
      (!expected.tailSha256 || expected.tailSha256 === selected.tailSha256)
    );
  }
  return (
    (name == null || name === selected.name) &&
    (size == null || Number(size) === selected.size) &&
    (lastModified == null || lastModified === selected.lastModified)
  );
}

export const DOCLING_RESUME_FINGERPRINT_MISMATCH_MESSAGE =
  "선택한 파일이 이어받기 세션에 저장된 파일과 일치하지 않습니다. 새 업로드 세션으로 다시 시작합니다.";
