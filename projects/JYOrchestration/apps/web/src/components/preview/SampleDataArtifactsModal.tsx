"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

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
  width: "min(920px, 100%)",
  maxHeight: "min(88vh, 820px)",
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
  readonly quality?: { readonly ok: boolean; readonly missing: readonly string[]; readonly warning: readonly string[] };
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

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
      const firstFound = json.files?.find((f) => f.found && f.contentUtf8)?.path ?? null;
      setSelectedPath(firstFound);
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

  const foundFiles = useMemo(
    () => (payload?.files ?? []).filter((f) => f.found && f.contentUtf8),
    [payload?.files],
  );

  const selectedContent =
    foundFiles.find((f) => f.path === selectedPath)?.contentUtf8 ??
    foundFiles[0]?.contentUtf8 ??
    null;

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-data-artifacts-modal-title"
      data-testid="sample-data-artifacts-modal"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
            flexShrink: 0,
          }}
        >
          <h2
            id="sample-data-artifacts-modal-title"
            style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", flex: "1 1 auto" }}
          >
            샘플 데이터 산출물
          </h2>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ fontSize: 13 }}>
            새로고침
          </button>
          <button type="button" onClick={props.onClose} style={{ fontSize: 13 }}>
            닫기
          </button>
        </div>

        <div style={{ padding: "12px 20px", overflow: "auto", flex: 1 }}>
          {props.codeTaskTitle ? (
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#475569" }}>{props.codeTaskTitle}</p>
          ) : null}

          {loading ? <p style={{ fontSize: 14 }}>GitHub branch에서 파일을 읽는 중…</p> : null}
          {error ? (
            <p style={{ fontSize: 14, color: "#b91c1c", whiteSpace: "pre-wrap" }}>{error}</p>
          ) : null}

          {payload && !loading ? (
            <>
              <div style={{ fontSize: 13, color: "#334155", marginBottom: 12, lineHeight: 1.5 }}>
                {payload.repositoryFullName ? (
                  <div>
                    저장소: <code>{payload.repositoryFullName}</code>
                  </div>
                ) : null}
                {payload.workBranch ? (
                  <div>
                    work branch: <code>{payload.workBranch}</code>
                    {payload.gitRef && payload.gitRef !== payload.workBranch ? (
                      <>
                        {" "}
                        · ref: <code>{payload.gitRef}</code>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {payload.quality ? (
                  <div style={{ marginTop: 6 }}>
                    Preview 품질 검사:{" "}
                    <strong style={{ color: payload.quality.ok ? "#15803d" : "#b45309" }}>
                      {payload.quality.ok ? "통과" : "미충족"}
                    </strong>
                    {!payload.quality.ok && payload.quality.missing.length ? (
                      <span style={{ display: "block", marginTop: 4, color: "#64748b" }}>
                        missing: {payload.quality.missing.join(", ")}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {payload.userMessage ? (
                  <p style={{ margin: "8px 0 0", color: "#b45309", whiteSpace: "pre-wrap" }}>{payload.userMessage}</p>
                ) : null}
              </div>

              {foundFiles.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {foundFiles.map((f) => (
                    <button
                      key={f.path}
                      type="button"
                      data-testid={`sample-data-file-tab-${f.path.replace(/\//g, "-")}`}
                      onClick={() => setSelectedPath(f.path)}
                      style={{
                        fontSize: 12,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: selectedPath === f.path ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: selectedPath === f.path ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "#64748b" }}>branch에 표시할 파일이 없습니다.</p>
              )}

              {selectedContent ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button
                      type="button"
                      data-testid="sample-data-download-selected"
                      onClick={() => {
                        const path = selectedPath ?? foundFiles[0]?.path ?? "sampleData.ts";
                        downloadTextFile(basename(path), selectedContent, "text/plain;charset=utf-8");
                      }}
                    >
                      선택 파일 다운로드
                    </button>
                    <button
                      type="button"
                      data-testid="sample-data-download-bundle"
                      onClick={() => {
                        const bundle = foundFiles
                          .map((f) => `// === ${f.path} ===\n${f.contentUtf8 ?? ""}`)
                          .join("\n\n");
                        downloadTextFile(
                          `sample-data-${props.codeTaskId}.txt`,
                          bundle,
                          "text/plain;charset=utf-8",
                        );
                      }}
                    >
                      전체 묶음 다운로드
                    </button>
                  </div>
                  <pre
                    data-testid="sample-data-artifacts-preview"
                    style={{
                      margin: 0,
                      padding: 12,
                      fontSize: 12,
                      lineHeight: 1.45,
                      background: "#0f172a",
                      color: "#e2e8f0",
                      borderRadius: 8,
                      overflow: "auto",
                      maxHeight: "50vh",
                    }}
                  >
                    {selectedContent}
                  </pre>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
