import type { KnowledgePack } from "@/types/pack";

function formatBytes(size: number | null | undefined): string | null {
  if (size == null || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMimeLabel(mimeType: string | null | undefined, fileName: string | null | undefined): string | null {
  if (mimeType?.includes("wordprocessingml") || fileName?.toLowerCase().endsWith(".docx")) return "DOCX";
  if (mimeType?.includes("msword") || fileName?.toLowerCase().endsWith(".doc")) return "DOC";
  if (mimeType?.includes("pdf") || fileName?.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mimeType?.includes("haansoft") || fileName?.toLowerCase().endsWith(".hwp")) return "HWP";
  if (fileName?.toLowerCase().endsWith(".hwpx")) return "HWPX";
  if (mimeType?.includes("zip") || fileName?.toLowerCase().endsWith(".zip")) return "ZIP";
  if (mimeType) return mimeType;
  return null;
}

function shortenChecksum(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 20) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

function publicPayloadDownloadHref(packId: string) {
  return `/api/v1/packs/${encodeURIComponent(packId)}/payload/download`;
}

export function PackDownloadInfoSection({ pack }: { readonly pack: KnowledgePack }) {
  const info = pack.downloadInfo;
  const available = info?.available || pack.capabilities?.download.status === "READY";
  if (!available && !info?.originalFileName) return null;

  const artifactKind = info?.artifactKind ?? (info?.mimeType?.includes("zip") ? "KNOWLEDGE_PACKAGE" : "SOURCE_ORIGINAL");
  const isPackage = artifactKind === "KNOWLEDGE_PACKAGE";
  const typeLabel = formatMimeLabel(info?.mimeType, info?.originalFileName);
  const sizeLabel = formatBytes(info?.fileSize ?? null);
  const checksum = shortenChecksum(info?.checksumSha256);

  return (
    <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <h2 className="text-sm font-bold text-slate-900">다운로드 정보</h2>
      <div className="mt-3 space-y-2 text-sm text-slate-800">
        {info?.originalFileName ? (
          <p className="break-all font-semibold text-slate-900">{info.originalFileName}</p>
        ) : (
          <p className="text-store-muted">{isPackage ? "지식팩 패키지" : "원본문서"}</p>
        )}
        <p className="text-xs text-store-muted">
          {[typeLabel, sizeLabel].filter(Boolean).join(" · ") || "파일 유형 정보 없음"}
        </p>
        {checksum ? (
          <p className="break-all font-mono text-[11px] text-slate-600">SHA-256: {checksum}</p>
        ) : null}
        <p className="text-xs text-store-muted">
          최종 업데이트 · {pack.updatedAt}
          {" · "}
          {available ? "다운로드 가능" : "다운로드 준비 중"}
        </p>
        <p className="text-xs leading-relaxed text-store-muted">
          {isPackage
            ? "표준 지식팩 ZIP Package가 제공됩니다."
            : "일반 사용자에게는 원본문서가 제공됩니다."}
        </p>
      </div>
      {available ? (
        <a
          href={publicPayloadDownloadHref(pack.packId)}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90"
        >
          {isPackage ? "지식팩 패키지 다운로드" : "원본문서 다운로드"}
        </a>
      ) : null}
    </section>
  );
}
