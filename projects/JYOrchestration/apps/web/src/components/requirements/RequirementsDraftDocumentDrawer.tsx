"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";

/** `RequirementsPromptDocumentDrawer`와 동일한 시각 스케일 */
const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.4)",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "stretch",
};

const panel: CSSProperties = {
  position: "relative",
  width: "min(960px, 100vw)",
  maxWidth: "100%",
  background: "#fafbfc",
  boxShadow: "-12px 0 48px rgba(15, 23, 42, 0.18)",
  display: "flex",
  flexDirection: "column",
  borderLeft: "1px solid #e2e8f0",
};

const docBlock: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  padding: "18px 22px",
  marginBottom: 14,
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

const labelSm: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: "#64748b",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const bodyLg: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: "#0f172a",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
};

const headerBtn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  color: "#0f172a",
};

function sanitizeExportFileStem(name: string): string {
  const trimmed = name.trim().slice(0, 80);
  const base = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "");
  return base.length > 0 ? base : "project";
}

function localDateSlug(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function linesToMdList(items: readonly string[]): string {
  if (!items.length) return "_없음_\n";
  return items.map((x) => `- ${x}`).join("\n") + "\n";
}

function draftToPlainText(d: RequirementsDraftDoc): string {
  const blocks: string[] = [];
  blocks.push(`요구사항 정리본 v${d.version} (${d.status})`);
  blocks.push(`생성: ${d.createdAt} · 수정: ${d.updatedAt}`);
  blocks.push("");
  blocks.push("— 프로젝트 개요 —");
  blocks.push(d.overview.trim() || "(없음)");
  blocks.push("");
  blocks.push("— 대상 사용자 —");
  blocks.push(d.users.length ? d.users.map((x) => `• ${x}`).join("\n") : "(없음)");
  blocks.push("");
  blocks.push("— 핵심 기능 —");
  blocks.push(d.features.length ? d.features.map((x) => `• ${x}`).join("\n") : "(없음)");
  blocks.push("");
  blocks.push("— 권한/역할 —");
  blocks.push(d.goals.length ? d.goals.map((x) => `• ${x}`).join("\n") : "(없음)");
  blocks.push("");
  blocks.push("— 운영 요구사항 —");
  blocks.push("비기능·운영:");
  blocks.push(d.nonFunctional.length ? d.nonFunctional.map((x) => `• ${x}`).join("\n") : "(없음)");
  blocks.push("성공·측정 기준:");
  blocks.push(d.successCriteria.length ? d.successCriteria.map((x) => `• ${x}`).join("\n") : "(없음)");
  blocks.push("");
  blocks.push("— 미정 항목 —");
  blocks.push(d.openIssues.length ? d.openIssues.map((x) => `• ${x}`).join("\n") : "(없음)");
  blocks.push("");
  blocks.push("— 다음 단계 제안 —");
  blocks.push("• 기능 정리 단계에서 요구사항을 기능 단위로 나누어 진행할 수 있습니다.");
  blocks.push("• 필요 시 「정리 요청」으로 본 문서를 AI가 갱신하게 할 수 있습니다.");
  if (d.excluded.length) {
    blocks.push("");
    blocks.push("참고 — 범위에서 제외된 항목:");
    blocks.push(d.excluded.map((x) => `• ${x}`).join("\n"));
  }
  return blocks.join("\n");
}

function draftToMarkdown(d: RequirementsDraftDoc): string {
  const lines: string[] = [];
  lines.push(`# 요구사항 정리본 v${d.version}`);
  lines.push("");
  lines.push(`_상태: ${d.status === "DRAFT" ? "최신 초안" : "확정"} · 생성 ${d.createdAt} · 수정 ${d.updatedAt}_`);
  lines.push("");
  lines.push("## 프로젝트 개요");
  lines.push("");
  lines.push(d.overview.trim() || "_없음_");
  lines.push("");
  lines.push("## 대상 사용자");
  lines.push("");
  lines.push(linesToMdList(d.users));
  lines.push("## 핵심 기능");
  lines.push("");
  lines.push(linesToMdList(d.features));
  lines.push("## 권한/역할");
  lines.push("");
  lines.push(linesToMdList(d.goals));
  lines.push("## 운영 요구사항");
  lines.push("");
  lines.push("### 비기능·운영");
  lines.push("");
  lines.push(linesToMdList(d.nonFunctional));
  lines.push("### 성공·측정 기준");
  lines.push("");
  lines.push(linesToMdList(d.successCriteria));
  lines.push("## 미정 항목");
  lines.push("");
  lines.push(linesToMdList(d.openIssues));
  lines.push("## 다음 단계 제안");
  lines.push("");
  lines.push("- 기능 정리 단계에서 요구사항을 기능 단위로 나누어 진행할 수 있습니다.");
  lines.push("- 필요 시 「정리 요청」으로 본 문서를 AI가 갱신하게 할 수 있습니다.");
  if (d.excluded.length) {
    lines.push("");
    lines.push("### 범위에서 제외");
    lines.push("");
    lines.push(linesToMdList(d.excluded));
  }
  return lines.join("\n");
}

function BulletBlock({ items }: { readonly items: readonly string[] }) {
  if (!items.length) {
    return <div style={{ ...bodyLg, color: "#64748b" }}>(없음)</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 20, ...bodyLg }}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function DrawerClipboardIcon({ size = 20 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function RequirementsDraftDocumentDrawer({
  open,
  onClose,
  draft,
  exportBaseName,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly draft: RequirementsDraftDoc;
  readonly exportBaseName?: string | null;
}) {  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exportStem = useMemo(() => sanitizeExportFileStem(exportBaseName ?? ""), [exportBaseName]);

  const versionLabel = useMemo(() => {
    const v = `v${draft.version}`;
    const tag = draft.status === "DRAFT" ? "최신" : "확정";
    return `${v} · ${tag}`;
  }, [draft.status, draft.version]);

  const fullCopyText = useMemo(() => draftToPlainText(draft), [draft]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
    };
  }, []);

  const showCopyToast = useCallback(() => {
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    setCopyToastVisible(true);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToastVisible(false);
      copyToastTimerRef.current = null;
    }, 2000);
  }, []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullCopyText);
      showCopyToast();
    } catch {
      /* ignore */
    }
  }, [fullCopyText, showCopyToast]);

  const onSaveAllFormats = useCallback(() => {
    const date = localDateSlug();
    const base = `${exportStem}-requirements-draft-v${draft.version}-${date}`;
    downloadTextFile(`${base}.txt`, draftToPlainText(draft), "text/plain;charset=utf-8");
    window.setTimeout(() => {
      downloadTextFile(`${base}.md`, draftToMarkdown(draft), "text/markdown;charset=utf-8");
    }, 200);
    window.setTimeout(() => {
      downloadTextFile(`${base}.json`, `${JSON.stringify(draft, null, 2)}\n`, "application/json;charset=utf-8");
    }, 400);
  }, [draft, exportStem]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="requirements-draft-drawer-title"
      style={backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>        {copyToastVisible ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              top: 56,
              right: 16,
              zIndex: 2,
              padding: "8px 14px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
              maxWidth: "min(320px, 90vw)",
            }}
          >
            정리본이 복사되었습니다.
          </div>
        ) : null}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
          }}
        >
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <h2 id="requirements-draft-drawer-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              요구사항 정리본
            </h2>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "#64748b" }}>{versionLabel}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
            <button
              type="button"
              aria-label="정리본 복사"
              title="클립보드에 복사"
              onClick={() => void onCopy()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <DrawerClipboardIcon />
            </button>
            <button type="button" onClick={onSaveAllFormats} style={{ ...headerBtn, border: "1px solid #cbd5e1" }}>
              저장
            </button>
            <button type="button" onClick={onClose} style={{ ...headerBtn, color: "#475569" }}>
              닫기
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px 28px" }}>
          <div style={docBlock}>
            <div style={labelSm}>프로젝트 개요</div>
            <div style={bodyLg}>{draft.overview.trim() || "(없음)"}</div>
          </div>
          <div style={docBlock}>
            <div style={labelSm}>대상 사용자</div>
            <BulletBlock items={draft.users} />
          </div>
          <div style={docBlock}>
            <div style={labelSm}>핵심 기능</div>
            <BulletBlock items={draft.features} />
          </div>
          <div style={docBlock}>
            <div style={labelSm}>권한/역할</div>
            <BulletBlock items={draft.goals} />
          </div>
          <div style={docBlock}>
            <div style={labelSm}>운영 요구사항</div>
            <div style={{ ...labelSm, marginTop: 10, textTransform: "none", letterSpacing: "normal" }}>비기능·운영</div>
            <BulletBlock items={draft.nonFunctional} />
            <div style={{ ...labelSm, marginTop: 14, textTransform: "none", letterSpacing: "normal" }}>성공·측정 기준</div>
            <BulletBlock items={draft.successCriteria} />
          </div>
          <div style={docBlock}>
            <div style={labelSm}>미정 항목</div>
            <BulletBlock items={draft.openIssues} />
          </div>
          <div style={docBlock}>
            <div style={labelSm}>다음 단계 제안</div>
            <ul style={{ margin: 0, paddingLeft: 20, ...bodyLg }}>
              <li>기능 정리 단계에서 요구사항을 기능 단위로 나누어 진행할 수 있습니다.</li>
              <li>필요 시 「정리 요청」으로 본 문서를 AI가 갱신하게 할 수 있습니다.</li>
            </ul>
            {draft.excluded.length ? (
              <>
                <div style={{ ...labelSm, marginTop: 14, textTransform: "none", letterSpacing: "normal" }}>범위에서 제외된 항목</div>
                <BulletBlock items={draft.excluded} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
