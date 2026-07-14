/**
 * Browser multipart uploader for Docling 3-file import.
 * Uses presigned PUT parts — never logs URLs or credentials.
 */

import {
  DOCLING_JSON_EXTENSIONS,
  DOCLING_MARKDOWN_EXTENSIONS,
  DOCLING_SOURCE_EXTENSIONS,
  extensionOfFileName,
} from "@/lib/docling-import/docling-import-file-constants";
import type {
  PartPresignDto,
  UploadSessionFilePublicDto,
  UploadSessionPublicDto,
  UploadSessionUploadedPartDto,
} from "@/lib/docling-import/docling-upload-session-service";
import type { DoclingUploadPolicy } from "@/lib/docling-import/docling-upload-policy";
import { formatByteSize } from "@/lib/docling-import/docling-upload-policy";
import type { DoclingImportBundlePublicDto } from "@/lib/docling-import/docling-import-dto";
import {
  computeFileFingerprint,
  DOCLING_FINGERPRINT_TAIL_SKIP_BYTES,
  DOCLING_RESUME_FINGERPRINT_MISMATCH_MESSAGE,
  fingerprintsMatch,
  type DoclingFileFingerprint,
  type DoclingRoleFingerprintMap,
  type StoredDoclingUploadSession,
} from "@/lib/docling-import/docling-upload-fingerprint";
import {
  abortProviderDoclingUploadSessionApi,
  completeProviderDoclingUploadSessionApi,
  createProviderDoclingUploadSessionApi,
  fetchProviderDoclingImportApi,
  fetchProviderDoclingUploadPolicyApi,
  fetchProviderDoclingUploadSessionApi,
  presignProviderDoclingUploadPartsApi,
  type DoclingUploadPolicyDto,
} from "@/lib/provider-center-api";
import { logDoclingUploadClientEvent } from "@/lib/docling-import/docling-upload-client-log";

export type DoclingUploadRole = "SOURCE_ORIGINAL" | "DOCLING_JSON" | "DOCLING_MARKDOWN";

export type DoclingUploadStage =
  | "idle"
  | "validating"
  | "preparing"
  | "uploading"
  | "completing"
  | "integrity"
  | "validating_server"
  | "normalizing"
  | "done"
  | "error"
  | "cancelled";

export const DOCLING_UPLOAD_STAGE_LABELS: Record<DoclingUploadStage, string> = {
  idle: "대기",
  validating: "파일 확인",
  preparing: "업로드 준비",
  uploading: "원본·JSON 업로드",
  completing: "서버 무결성 확인",
  integrity: "서버 무결성 확인",
  validating_server: "검증",
  normalizing: "정규화",
  done: "등록 완료",
  error: "오류",
  cancelled: "취소됨",
};

export type FileUploadProgress = {
  role: DoclingUploadRole;
  fileName: string;
  bytesTotal: number;
  bytesUploaded: number;
  percent: number;
  speedBps: number;
  etaSeconds: number | null;
  status: "pending" | "uploading" | "done" | "error";
};

export type MultipartUploadProgress = {
  stage: DoclingUploadStage;
  stageLabel: string;
  message: string | null;
  files: FileUploadProgress[];
  overallPercent: number;
  overallSpeedBps: number;
  overallEtaSeconds: number | null;
  sessionId: string | null;
  bundleId: string | null;
};

export type MultipartUploadResult = {
  sessionId: string;
  bundleId: string;
  bundle: DoclingImportBundlePublicDto;
};

export type MultipartUploadFiles = {
  sourceFile: File;
  doclingJsonFile: File;
  doclingMarkdownFile?: File | null;
};

const SESSION_STORAGE_KEY_PREFIX = "jykstore:docling-upload-session:";
const MAX_RETRIES = 3;
const DEFAULT_CONCURRENCY = 3;
/** Placeholder when browser cannot read ETag due to missing CORS ExposeHeaders. */
const SERVER_LIST_ETAG_PLACEHOLDER = "__server_list__";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 250);
}

export function doclingUploadSessionStorageKey(packId: string): string {
  return `${SESSION_STORAGE_KEY_PREFIX}${packId}`;
}

export function readStoredUploadSessionId(packId: string): string | null {
  const stored = readStoredUploadSession(packId);
  return stored?.sessionId ?? null;
}

export function readStoredUploadSession(packId: string): StoredDoclingUploadSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(doclingUploadSessionStorageKey(packId));
    if (!raw?.trim()) return null;
    // Legacy: plain session id string
    if (!raw.trimStart().startsWith("{")) {
      return { sessionId: raw.trim(), fingerprints: {} };
    }
    const parsed = JSON.parse(raw) as StoredDoclingUploadSession;
    if (!parsed?.sessionId || typeof parsed.sessionId !== "string") return null;
    return {
      sessionId: parsed.sessionId,
      fingerprints: parsed.fingerprints ?? {},
    };
  } catch {
    return null;
  }
}

export function persistUploadSessionId(packId: string, sessionId: string): void {
  persistUploadSession(packId, { sessionId, fingerprints: {} });
}

export function persistUploadSession(
  packId: string,
  stored: StoredDoclingUploadSession,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(doclingUploadSessionStorageKey(packId), JSON.stringify(stored));
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredUploadSessionId(packId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(doclingUploadSessionStorageKey(packId));
  } catch {
    // ignore
  }
}

async function computeUploadFingerprints(
  files: MultipartUploadFiles,
): Promise<DoclingRoleFingerprintMap> {
  // Sequential: keep peak memory low and avoid parallel EOF scans on huge files.
  const source = await computeFileFingerprint(files.sourceFile);
  const json = await computeFileFingerprint(files.doclingJsonFile);
  const result: DoclingRoleFingerprintMap = {
    SOURCE_ORIGINAL: source,
    DOCLING_JSON: json,
  };
  if (files.doclingMarkdownFile) {
    result.DOCLING_MARKDOWN = await computeFileFingerprint(files.doclingMarkdownFile);
  }
  return result;
}

/**
 * Compare selected file fingerprints against server session files (preferred) or local storage.
 * Returns mismatch roles; empty array means OK to resume.
 */
export function findResumeFingerprintMismatches(input: {
  selected: DoclingRoleFingerprintMap;
  sessionFiles?: UploadSessionFilePublicDto[];
  storedFingerprints?: DoclingRoleFingerprintMap;
}): DoclingUploadRole[] {
  const mismatched: DoclingUploadRole[] = [];
  const serverByRole = new Map(
    (input.sessionFiles ?? []).map((f) => [f.role as DoclingUploadRole, f]),
  );
  const roles = new Set<DoclingUploadRole>([
    "SOURCE_ORIGINAL",
    "DOCLING_JSON",
    ...([...serverByRole.keys()] as DoclingUploadRole[]),
    ...(Object.keys(input.selected) as DoclingUploadRole[]),
  ]);
  for (const role of roles) {
    const selected = input.selected[role];
    const server = serverByRole.get(role);
    // Optional markdown: absent on both sides is OK.
    if (!selected && !server) continue;
    if (!selected || !server) {
      mismatched.push(role);
      continue;
    }
    const expected = {
      originalFileName: server.originalFileName,
      declaredFileSize: server.declaredFileSize,
      lastModifiedMs: server.lastModifiedMs,
      headSha256: server.headSha256,
      tailSha256: server.tailSha256,
    };
    const stored = input.storedFingerprints?.[role];
    if (!fingerprintsMatch(selected, expected) && !fingerprintsMatch(selected, stored)) {
      mismatched.push(role);
    }
  }
  return mismatched;
}

function buildCreateSessionFiles(
  files: MultipartUploadFiles,
  fingerprints: DoclingRoleFingerprintMap,
) {
  const fp = (role: DoclingUploadRole): DoclingFileFingerprint | undefined => fingerprints[role];
  const entries: Array<{
    role: DoclingUploadRole;
    fileName: string;
    mimeType: string | null;
    declaredFileSize: number;
    lastModifiedMs: number;
    headSha256: string | null;
    tailSha256: string | null;
  }> = [
    {
      role: "SOURCE_ORIGINAL",
      fileName: files.sourceFile.name,
      mimeType: files.sourceFile.type || null,
      declaredFileSize: files.sourceFile.size,
      lastModifiedMs: files.sourceFile.lastModified,
      headSha256: fp("SOURCE_ORIGINAL")?.headSha256 ?? null,
      tailSha256: fp("SOURCE_ORIGINAL")?.tailSha256 ?? null,
    },
    {
      role: "DOCLING_JSON",
      fileName: files.doclingJsonFile.name,
      mimeType: files.doclingJsonFile.type || "application/json",
      declaredFileSize: files.doclingJsonFile.size,
      lastModifiedMs: files.doclingJsonFile.lastModified,
      headSha256: fp("DOCLING_JSON")?.headSha256 ?? null,
      tailSha256: fp("DOCLING_JSON")?.tailSha256 ?? null,
    },
  ];
  if (files.doclingMarkdownFile) {
    entries.push({
      role: "DOCLING_MARKDOWN",
      fileName: files.doclingMarkdownFile.name,
      mimeType: files.doclingMarkdownFile.type || "text/markdown",
      declaredFileSize: files.doclingMarkdownFile.size,
      lastModifiedMs: files.doclingMarkdownFile.lastModified,
      headSha256: fp("DOCLING_MARKDOWN")?.headSha256 ?? null,
      tailSha256: fp("DOCLING_MARKDOWN")?.tailSha256 ?? null,
    });
  }
  return entries;
}

function maxBytesForRole(
  role: DoclingUploadRole,
  policy: DoclingUploadPolicyDto | DoclingUploadPolicy,
): number {
  switch (role) {
    case "SOURCE_ORIGINAL":
      return policy.maxSourceBytes;
    case "DOCLING_JSON":
      return policy.maxJsonBytes;
    case "DOCLING_MARKDOWN":
      return policy.maxMarkdownBytes;
  }
}

function assertClientExtension(role: DoclingUploadRole, fileName: string): void {
  const ext = extensionOfFileName(fileName);
  const allowed =
    role === "SOURCE_ORIGINAL"
      ? (DOCLING_SOURCE_EXTENSIONS as readonly string[])
      : role === "DOCLING_JSON"
        ? (DOCLING_JSON_EXTENSIONS as readonly string[])
        : (DOCLING_MARKDOWN_EXTENSIONS as readonly string[]);
  if (!ext || !allowed.includes(ext)) {
    const label =
      role === "SOURCE_ORIGINAL"
        ? "원본문서"
        : role === "DOCLING_JSON"
          ? "Docling JSON"
          : "Docling Markdown";
    throw new Error(`${label} 확장자가 올바르지 않습니다. (${fileName})`);
  }
}

export function preValidateDoclingUploadFiles(
  files: MultipartUploadFiles,
  policy: DoclingUploadPolicyDto | DoclingUploadPolicy,
): void {
  const entries: Array<{ role: DoclingUploadRole; file: File }> = [
    { role: "SOURCE_ORIGINAL", file: files.sourceFile },
    { role: "DOCLING_JSON", file: files.doclingJsonFile },
  ];
  if (files.doclingMarkdownFile) {
    entries.push({ role: "DOCLING_MARKDOWN", file: files.doclingMarkdownFile });
  }
  let total = 0;
  for (const { role, file } of entries) {
    if (!file || file.size <= 0) {
      throw new Error("빈 파일은 업로드할 수 없습니다.");
    }
    assertClientExtension(role, file.name);
    const max = maxBytesForRole(role, policy);
    if (file.size > max) {
      throw new Error(`${file.name}이(가) 최대 크기(${formatByteSize(max)})를 초과했습니다.`);
    }
    total += file.size;
  }
  if (total > policy.maxBundleBytes) {
    throw new Error(`번들 크기가 최대(${formatByteSize(policy.maxBundleBytes)})를 초과했습니다.`);
  }
}

function slicePartBlob(file: File, partNumber: number, partSizeBytes: number): Blob {
  const start = (partNumber - 1) * partSizeBytes;
  const end = Math.min(start + partSizeBytes, file.size);
  return file.slice(start, end);
}

function putPresignedPart(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.responseType = "text";

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded);
    };
    xhr.onload = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag =
          xhr.getResponseHeader("ETag")?.replaceAll('"', "").trim() ||
          xhr.getResponseHeader("etag")?.replaceAll('"', "").trim() ||
          "";
        // MinIO community builds often omit CORS ExposeHeaders, so browsers cannot
        // read ETag. CompleteMultipart then uses server-side ListParts instead.
        resolve(etag || SERVER_LIST_ETAG_PLACEHOLDER);
        return;
      }
      reject(new Error(`파트 업로드 실패 (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new Error("파트 업로드 네트워크 오류 (MinIO CORS·연결을 확인하세요)"));
    };
    xhr.onabort = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload aborted", "AbortError"));
    };
    xhr.send(body);
  });
}

async function putWithRetry(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError");
    try {
      let loaded = 0;
      return await putPresignedPart(
        url,
        body,
        (n) => {
          loaded = n;
          onProgress(loaded);
        },
        signal,
      );
    } catch (err) {
      lastError = err;
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (attempt < MAX_RETRIES - 1) {
        onProgress(0);
        await sleep(backoffMs(attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("파트 업로드 재시도 실패");
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = items.slice();
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

type RoleFileBinding = {
  role: DoclingUploadRole;
  file: File;
  sessionFile: UploadSessionFilePublicDto;
  completed: Map<number, { etag: string; size: number }>;
};

function emptyProgress(files: MultipartUploadFiles): MultipartUploadProgress {
  const entries: FileUploadProgress[] = [
    {
      role: "SOURCE_ORIGINAL",
      fileName: files.sourceFile.name,
      bytesTotal: files.sourceFile.size,
      bytesUploaded: 0,
      percent: 0,
      speedBps: 0,
      etaSeconds: null,
      status: "pending",
    },
    {
      role: "DOCLING_JSON",
      fileName: files.doclingJsonFile.name,
      bytesTotal: files.doclingJsonFile.size,
      bytesUploaded: 0,
      percent: 0,
      speedBps: 0,
      etaSeconds: null,
      status: "pending",
    },
  ];
  if (files.doclingMarkdownFile) {
    entries.push({
      role: "DOCLING_MARKDOWN",
      fileName: files.doclingMarkdownFile.name,
      bytesTotal: files.doclingMarkdownFile.size,
      bytesUploaded: 0,
      percent: 0,
      speedBps: 0,
      etaSeconds: null,
      status: "pending",
    });
  }
  return {
    stage: "idle",
    stageLabel: DOCLING_UPLOAD_STAGE_LABELS.idle,
    message: null,
    files: entries,
    overallPercent: 0,
    overallSpeedBps: 0,
    overallEtaSeconds: null,
    sessionId: null,
    bundleId: null,
  };
}

function recomputeOverall(
  progress: MultipartUploadProgress,
  startedAt: number,
): MultipartUploadProgress {
  const total = progress.files.reduce((s, f) => s + f.bytesTotal, 0);
  const uploaded = progress.files.reduce((s, f) => s + f.bytesUploaded, 0);
  const elapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
  const speed = uploaded / elapsed;
  const remaining = Math.max(0, total - uploaded);
  return {
    ...progress,
    overallPercent: total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0,
    overallSpeedBps: speed,
    overallEtaSeconds: speed > 0 ? Math.ceil(remaining / speed) : null,
  };
}

function mapUploadedParts(
  parts: UploadSessionUploadedPartDto[] | undefined,
): Map<number, { etag: string; size: number }> {
  const map = new Map<number, { etag: string; size: number }>();
  for (const p of parts ?? []) {
    if (p.partNumber > 0 && p.etag) {
      map.set(p.partNumber, { etag: p.etag.replaceAll('"', ""), size: p.size });
    }
  }
  return map;
}

async function pollBundleUntilSettled(
  packId: string,
  bundleId: string,
  onProgress: (p: MultipartUploadProgress) => void,
  base: MultipartUploadProgress,
  signal?: AbortSignal,
): Promise<DoclingImportBundlePublicDto> {
  const terminalOk = new Set(["REVIEW_READY", "NORMALIZED"]);
  const terminalFail = new Set(["VALIDATION_FAILED", "NORMALIZATION_FAILED"]);
  let delay = 1500;
  for (let i = 0; i < 120; i += 1) {
    if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError");
    const data = await fetchProviderDoclingImportApi(packId);
    const candidate =
      data.stagingBundle?.id === bundleId
        ? data.stagingBundle
        : data.bundle?.id === bundleId
          ? data.bundle
          : data.stagingBundle ?? data.bundle;
    if (!candidate || candidate.id !== bundleId) {
      await sleep(delay);
      delay = Math.min(delay + 500, 5000);
      continue;
    }

    let stage: DoclingUploadStage = "integrity";
    if (candidate.status === "VALIDATING" || candidate.status === "UPLOADED") {
      stage = "validating_server";
    } else if (candidate.status === "NORMALIZING" || candidate.status === "VALID") {
      stage = "normalizing";
    } else if (terminalOk.has(candidate.status)) {
      stage = "done";
    } else if (terminalFail.has(candidate.status)) {
      throw new Error(candidate.lastErrorMessage ?? `처리 실패 (${candidate.status})`);
    }

    // Do not surface stale lastErrorMessage while processing is still in-flight —
    // file upload may already be 100% but server work is separate.
    const processingHint =
      stage === "validating_server"
        ? "파일 전송은 완료되었습니다. 서버에서 검증 중입니다…"
        : stage === "normalizing"
          ? "파일 전송은 완료되었습니다. 서버에서 정규화 중입니다…"
          : stage === "integrity"
            ? "파일 전송은 완료되었습니다. 처리 상태를 확인 중입니다…"
            : null;

    onProgress({
      ...base,
      stage,
      stageLabel: DOCLING_UPLOAD_STAGE_LABELS[stage],
      message: processingHint,
      bundleId,
    });

    if (isDoclingUploadPollTerminalSuccess(candidate)) {
      return candidate;
    }

    await sleep(delay);
    delay = Math.min(delay + 500, 5000);
  }
  throw new Error("처리 상태 확인 시간이 초과되었습니다. 새로고침 후 상태를 확인하세요.");
}

/** Staging NORMALIZED (inactive) is success after provider-confirm gating. */
export function isDoclingUploadPollTerminalSuccess(candidate: {
  status: string;
  isActive?: boolean;
}): boolean {
  return candidate.status === "NORMALIZED" || candidate.status === "REVIEW_READY";
}

/**
 * Upload Docling source+JSON (Markdown optional) via multipart sessions.
 * Supports refresh resume via sessionStorage.
 */
export async function uploadDoclingMultipart(input: {
  packId: string;
  files: MultipartUploadFiles;
  onProgress?: (progress: MultipartUploadProgress) => void;
  signal?: AbortSignal;
  resumeSessionId?: string | null;
}): Promise<MultipartUploadResult> {
  const { packId, files, signal } = input;
  const emit = (p: MultipartUploadProgress) => input.onProgress?.(p);
  let progress = emptyProgress(files);
  const startedAt = Date.now();

  const setStage = (stage: DoclingUploadStage, message: string | null = null) => {
    progress = {
      ...progress,
      stage,
      stageLabel: DOCLING_UPLOAD_STAGE_LABELS[stage],
      message,
    };
    emit(progress);
  };

  try {
    await logDoclingUploadClientEvent(packId, "upload_start", {
      sourceBytes: files.sourceFile.size,
      jsonBytes: files.doclingJsonFile.size,
      markdownBytes: files.doclingMarkdownFile?.size ?? 0,
      sourceName: files.sourceFile.name,
      jsonName: files.doclingJsonFile.name,
      markdownName: files.doclingMarkdownFile?.name ?? null,
      webCryptoSubtle: typeof globalThis.crypto?.subtle?.digest === "function",
      isSecureContext:
        typeof globalThis.isSecureContext === "boolean" ? globalThis.isSecureContext : null,
    });

    setStage("validating");
    const { policy } = await fetchProviderDoclingUploadPolicyApi(packId);
    preValidateDoclingUploadFiles(files, policy);
    await logDoclingUploadClientEvent(packId, "policy_ok", {
      maxJsonBytes: policy.maxJsonBytes,
      multipartPartBytes: policy.multipartPartBytes,
    });

    const totalBytes =
      files.sourceFile.size +
      files.doclingJsonFile.size +
      (files.doclingMarkdownFile?.size ?? 0);
    const largePrep =
      totalBytes > DOCLING_FINGERPRINT_TAIL_SKIP_BYTES
        ? "대용량 파일 확인 중… (브라우저에서 파일 끝 탐색을 건너뜁니다)"
        : null;
    setStage("preparing", largePrep);
    // Yield so React can paint "업로드 준비" before hashing.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await logDoclingUploadClientEvent(packId, "fingerprint_start", { totalBytes });
    const fingerprints = await computeUploadFingerprints(files);
    await logDoclingUploadClientEvent(packId, "fingerprint_done", {
      roles: Object.keys(fingerprints),
    });
    let session: UploadSessionPublicDto;
    const stored = input.resumeSessionId
      ? { sessionId: input.resumeSessionId, fingerprints: {} as DoclingRoleFingerprintMap }
      : readStoredUploadSession(packId);
    const resumeId = stored?.sessionId ?? null;

    const createFreshSession = async () => {
      const created = await createProviderDoclingUploadSessionApi(packId, {
        files: buildCreateSessionFiles(files, fingerprints),
      });
      return created.session;
    };

    if (resumeId) {
      try {
        const resumed = await fetchProviderDoclingUploadSessionApi(packId, resumeId);
        if (
          resumed.session.status === "CREATED" ||
          resumed.session.status === "UPLOADING"
        ) {
          const mismatches = findResumeFingerprintMismatches({
            selected: fingerprints,
            sessionFiles: resumed.session.files,
            storedFingerprints: stored?.fingerprints,
          });
          if (mismatches.length > 0) {
            try {
              await abortProviderDoclingUploadSessionApi(packId, resumeId);
            } catch {
              // best-effort
            }
            clearStoredUploadSessionId(packId);
            setStage("preparing", DOCLING_RESUME_FINGERPRINT_MISMATCH_MESSAGE);
            session = await createFreshSession();
          } else {
            session = resumed.session;
          }
        } else {
          clearStoredUploadSessionId(packId);
          session = await createFreshSession();
        }
      } catch {
        clearStoredUploadSessionId(packId);
        session = await createFreshSession();
      }
    } else {
      session = await createFreshSession();
    }

    persistUploadSession(packId, {
      sessionId: session.id,
      fingerprints,
    });
    await logDoclingUploadClientEvent(packId, "session_ready", {
      sessionId: session.id,
      bundleId: session.bundleId,
      fileCount: session.files.length,
    });
    progress = { ...progress, sessionId: session.id, bundleId: session.bundleId };
    emit(progress);

    const fileByRole: Partial<Record<DoclingUploadRole, File>> = {
      SOURCE_ORIGINAL: files.sourceFile,
      DOCLING_JSON: files.doclingJsonFile,
    };
    if (files.doclingMarkdownFile) {
      fileByRole.DOCLING_MARKDOWN = files.doclingMarkdownFile;
    }

    const bindings: RoleFileBinding[] = session.files.map((sf) => {
      const role = sf.role as DoclingUploadRole;
      const file = fileByRole[role];
      if (!file) {
        throw new Error(`${role} 파일이 세션과 일치하지 않습니다.`);
      }
      return {
        role,
        file,
        sessionFile: sf,
        completed: mapUploadedParts(sf.uploadedParts),
      };
    });

    // Seed progress from already-uploaded parts (resume).
    for (const binding of bindings) {
      const uploaded = [...binding.completed.values()].reduce((s, p) => s + p.size, 0);
      progress = {
        ...progress,
        files: progress.files.map((f) =>
          f.role === binding.role
            ? {
                ...f,
                bytesUploaded: Math.min(f.bytesTotal, uploaded),
                percent:
                  f.bytesTotal > 0
                    ? Math.min(100, Math.round((uploaded / f.bytesTotal) * 100))
                    : 0,
                status: uploaded >= f.bytesTotal && f.bytesTotal > 0 ? "done" : "pending",
              }
            : f,
        ),
      };
    }
    progress = recomputeOverall(progress, startedAt);
    setStage("uploading");
    await logDoclingUploadClientEvent(packId, "parts_upload_start", {
      sessionId: session.id,
      roles: bindings.map((b) => b.role),
    });

    const concurrency = policy.multipartConcurrency || DEFAULT_CONCURRENCY;
    const partProgressLoaded = new Map<string, number>();

    const refreshFileProgress = (role: DoclingUploadRole, baseUploaded: number) => {
      let inFlight = 0;
      for (const [key, loaded] of partProgressLoaded) {
        if (key.startsWith(`${role}:`)) inFlight += loaded;
      }
      const bytesUploaded = Math.min(
        fileByRole[role]!.size,
        baseUploaded + inFlight,
      );
      const elapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
      const speed = bytesUploaded / elapsed;
      const remaining = Math.max(0, fileByRole[role]!.size - bytesUploaded);
      progress = {
        ...progress,
        files: progress.files.map((f) =>
          f.role === role
            ? {
                ...f,
                bytesUploaded,
                percent:
                  f.bytesTotal > 0
                    ? Math.min(100, Math.round((bytesUploaded / f.bytesTotal) * 100))
                    : 0,
                speedBps: speed,
                etaSeconds: speed > 0 ? Math.ceil(remaining / speed) : null,
                status: bytesUploaded >= f.bytesTotal ? "done" : "uploading",
              }
            : f,
        ),
      };
      progress = recomputeOverall(progress, startedAt);
      emit(progress);
    };

    for (const binding of bindings) {
      if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError");
      const { sessionFile, file, role, completed } = binding;
      const partSize = sessionFile.partSizeBytes;
      const partCount = sessionFile.partCount;
      const missing: number[] = [];
      for (let n = 1; n <= partCount; n += 1) {
        if (!completed.has(n)) missing.push(n);
      }

      const baseUploaded = [...completed.values()].reduce((s, p) => s + p.size, 0);
      if (missing.length === 0) {
        refreshFileProgress(role, baseUploaded);
        continue;
      }

      // Presign in batches of 20
      const PRESIGN_BATCH = 20;
      const urlByPart = new Map<string, string>();
      for (let i = 0; i < missing.length; i += PRESIGN_BATCH) {
        const batch = missing.slice(i, i + PRESIGN_BATCH);
        const { presigns } = await presignProviderDoclingUploadPartsApi(packId, session.id, {
          requests: [{ role, partNumbers: batch }],
        });
        const entry = presigns.find((p: PartPresignDto) => p.role === role);
        for (const part of entry?.parts ?? []) {
          urlByPart.set(`${role}:${part.partNumber}`, part.url);
        }
      }

      await runPool(missing, concurrency, async (partNumber) => {
        if (signal?.aborted) throw new DOMException("Upload aborted", "AbortError");
        const url = urlByPart.get(`${role}:${partNumber}`);
        if (!url) throw new Error(`파트 ${partNumber} presign URL이 없습니다.`);
        const blob = slicePartBlob(file, partNumber, partSize);
        const key = `${role}:${partNumber}`;
        const etag = await putWithRetry(
          url,
          blob,
          (loaded) => {
            partProgressLoaded.set(key, loaded);
            refreshFileProgress(role, baseUploaded);
          },
          signal,
        );
        partProgressLoaded.delete(key);
        completed.set(partNumber, { etag, size: blob.size });
        refreshFileProgress(
          role,
          [...completed.values()].reduce((s, p) => s + p.size, 0),
        );
      });
    }

    setStage("completing");
    const partsByRole: Record<string, Array<{ partNumber: number; etag: string }>> = {};
    let needsServerPartList = false;
    for (const binding of bindings) {
      const parts = [...binding.completed.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([partNumber, { etag }]) => ({ partNumber, etag }));
      if (parts.some((p) => !p.etag || p.etag === SERVER_LIST_ETAG_PLACEHOLDER)) {
        needsServerPartList = true;
      }
      partsByRole[binding.role] = parts;
    }

    await logDoclingUploadClientEvent(packId, "complete_start", {
      sessionId: session.id,
      needsServerPartList,
    });

    // Prefer server ListParts when ETag was not readable (common with MinIO CORS limits).
    const completedRes = await completeProviderDoclingUploadSessionApi(
      packId,
      session.id,
      needsServerPartList ? undefined : { partsByRole },
    );
    const bundleId = completedRes.bundleId;
    progress = { ...progress, bundleId };
    setStage("integrity");

    const bundle = await pollBundleUntilSettled(packId, bundleId, emit, progress, signal);
    clearStoredUploadSessionId(packId);
    setStage("done");
    await logDoclingUploadClientEvent(packId, "upload_done", {
      sessionId: session.id,
      bundleId,
      status: bundle.status,
    });
    return { sessionId: session.id, bundleId, bundle };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      setStage("cancelled", "업로드가 취소되었습니다.");
      await logDoclingUploadClientEvent(packId, "upload_cancelled", {}, "warn");
      throw err;
    }
    const message = err instanceof Error ? err.message : "업로드에 실패했습니다.";
    setStage("error", message);
    await logDoclingUploadClientEvent(packId, "upload_error", { message }, "error");
    throw err;
  }
}

export async function cancelDoclingMultipartUpload(packId: string, sessionId?: string | null) {
  const id = sessionId ?? readStoredUploadSessionId(packId);
  if (!id) return;
  try {
    await abortProviderDoclingUploadSessionApi(packId, id);
  } finally {
    clearStoredUploadSessionId(packId);
  }
}

export function formatUploadSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "—";
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatEtaSeconds(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}분 ${s}초`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}
