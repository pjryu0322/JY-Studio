"use client";

import Link from "next/link";

export type WorkNoteButtonProps = Readonly<{
  /** 프로젝트 컨텍스트 */
  notesProjectId: string | null;
}>;

function iconButtonStyle(): React.CSSProperties {
  return {
    position: "relative",
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 10,
    width: 36,
    height: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f172a",
    cursor: "pointer",
    flexShrink: 0,
    boxSizing: "border-box",
    textDecoration: "none",
  };
}

function iconButtonStyleDisabled(): React.CSSProperties {
  return {
    ...iconButtonStyle(),
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
    opacity: 0.85,
    pointerEvents: "none",
  };
}

/** 내 작업메모(사용자 레벨) — `/work-notes` */
export function UserWorkNoteButton() {
  return (
    <Link href="/work-notes" prefetch={false} data-testid="work-note-open-user" aria-label="내 작업메모" title="내 작업메모" style={iconButtonStyle()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    </Link>
  );
}

/** 프로젝트 작업메모(프로젝트 레벨) — `/work-notes?projectId=...` */
export function ProjectWorkNoteButton(p: WorkNoteButtonProps) {
  const ctxPid = p.notesProjectId?.trim() ?? "";
  if (!ctxPid) {
    return (
      <span aria-label="프로젝트 작업메모 (프로젝트 선택 필요)" title="프로젝트를 선택한 뒤 프로젝트 메모를 이용하세요" style={iconButtonStyleDisabled()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <path d="M8 13h8M8 17h8" />
        </svg>
      </span>
    );
  }
  const href = `/work-notes?projectId=${encodeURIComponent(ctxPid)}`;
  return (
    <Link
      href={href}
      prefetch={false}
      data-testid="work-note-open-project"
      aria-label="프로젝트 작업메모"
      title="프로젝트 작업메모"
      style={iconButtonStyle()}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M8 13h8M8 17h8" />
      </svg>
    </Link>
  );
}
