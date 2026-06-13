"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { describeSampleDataArtifactFile } from "@/lib/prototype/sampleDataCodeTaskPlanner";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 65,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel: CSSProperties = {
  width: "min(720px, 100%)",
  maxHeight: "min(88vh, 640px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  background: "#fafbfc",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
  border: "1px solid #e2e8f0",
};

type ArtifactFile = Readonly<{
  readonly path: string;
  readonly found: boolean;
  readonly contentUtf8: string | null;
}>;

type FetchPayload = Readonly<{
  readonly success?: boolean;
  readonly ok?: boolean;
  readonly message?: string;
  readonly workBranch?: string;
  readonly gitRef?: string;
  readonly commitSha?: string | null;
  readonly repositoryFullName?: string | null;
  readonly files?: readonly ArtifactFile[];
  readonly quality?: {
    readonly ok: boolean;
    readonly missing: readonly string[];
    readonly warning: readonly string[];
    readonly status?: string;
    readonly passedChecks?: readonly string[];
    readonly integrationRequired?: readonly string[];
  };
  readonly userMessage?: string | null;
}>;

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function DownloadIcon({ size = 18 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function SampleDataArtifactsModal(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly codeTaskTitle?: string;
}): ReactNode {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<FetchPayload | null>(null);

  const load = useCallback(async () => {
    const pid = props.projectId.trim();
    const cid = props.codeTaskId.trim();
    if (!pid || !cid) return;
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const res = await credentialsIncludeFetch(
        `/api/projects/${encodeURIComponent(pid)}/sample-data-artifacts?codeTaskId=${encodeURIComponent(cid)}`,
      );
      const json = (await res.json()) as FetchPayload & { message?: string };
      if (!res.ok || json.success !== true) {
        setError(json.message ?? "샘플 데이터를 불러오지 못했습니다.");
        return;
      }
      setPayload(json);
    } catch {
      setError("샘플 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [props.projectId, props.codeTaskId]);

  useEffect(() => {
    if (!props.open) return;
    void load();
  }, [props.open, load]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const files = payload?.files ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="샘플 데이터 산출물"
      data-testid="sample-data-artifacts-modal"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", overflow: "auto", flex: 1 }}>
          {loading ? <p style={{ fontSize: 14 }}>GitHub branch에서 파일을 읽는 중…</p> : null}
          {error ? (
            <p style={{ fontSize: 14, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{error}</p>
          ) : null}

          {payload && !loading ? (
            <>
              {payload.quality ? (
                <div style={{ fontSize: 13, color: "#334155", marginBottom: 16, lineHeight: 1.5 }}>
                  산출물 품질 검사:{" "}
                  <strong
                    style={{
                      color:
                        payload.quality.status === "pending"
                          ? "#64748b"
                          : payload.quality.ok
                            ? "#15803d"
                            : "#b45309",
                    }}
                  >
                    {payload.quality.status === "pending"
                      ? "검증 대기"
                      : payload.quality.ok
                        ? "통과"
                        : "미충족"}
                  </strong>
                  {!payload.quality.ok && payload.quality.missing.length ? (
                    <span style={{ display: "block", marginTop: 4, color: "#64748b" }}>
                      missing: {payload.quality.missing.join(", ")}
                    </span>
                  ) : null}
                  {payload.quality.integrationRequired?.length ? (
                    <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                      <strong>통합 필요:</strong>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {payload.quality.integrationRequired.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {payload.userMessage ? (
                <p style={{ margin: "0 0 12px", color: "#b45309", fontSize: 13, whiteSpace: "pre-wrap" }}>
                  {payload.userMessage}
                </p>
              ) : null}

              {files.length ? (
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.4fr) 44px",
                      gap: 0,
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      textAlign: "center",
                    }}
                  >
                    <span>파일명</span>
                    <span>설명</span>
                    <span />
                  </div>
                  {files.map((f, index) => {
                    const canDownload = f.found && Boolean(f.contentUtf8?.trim());
                    const testSlug = f.path.replace(/\//g, "-");
                    return (
                      <div
                        key={f.path}
                        data-testid={`sample-data-file-row-${testSlug}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.4fr) 44px",
                          gap: 12,
                          padding: "10px 12px",
                          alignItems: "center",
                          fontSize: 13,
                          borderBottom: index < files.length - 1 ? "1px solid #f1f5f9" : undefined,
                          opacity: canDownload ? 1 : 0.65,
                        }}
                      >
                        <code
                          style={{
                            fontSize: 12,
                            color: "#0f172a",
                            wordBreak: "break-all",
                          }}
                        >
                          {f.path}
                        </code>
                        <span style={{ color: "#475569", lineHeight: 1.45 }}>
                          {describeSampleDataArtifactFile(f.path)}
                          {!canDownload ? (
                            <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                              branch에 없음
                            </span>
                          ) : null}
                        </span>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button
                            type="button"
                            data-testid={`sample-data-download-file-${testSlug}`}
                            disabled={!canDownload}
                            title={canDownload ? `${basename(f.path)} 다운로드` : "다운로드 불가"}
                            aria-label={canDownload ? `${f.path} 다운로드` : `${f.path} 다운로드 불가`}
                            onClick={() => {
                              if (!f.contentUtf8) return;
                              downloadTextFile(basename(f.path), f.contentUtf8, "text/plain;charset=utf-8");
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 36,
                              height: 36,
                              padding: 0,
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: canDownload ? "#fff" : "#f1f5f9",
                              color: canDownload ? "#2563eb" : "#94a3b8",
                              cursor: canDownload ? "pointer" : "not-allowed",
                            }}
                          >
                            <DownloadIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "#64748b" }}>branch에 표시할 파일이 없습니다.</p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
