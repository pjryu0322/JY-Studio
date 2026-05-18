"use client";

import Link from "next/link";
import { platformRailNavPrimaryText, platformRailNavTextCell } from "@/lib/layout/platformTopNavConstants";

export type WorkNoteButtonProps = Readonly<{
  /** 프로젝트 컨텍스트 */
  notesProjectId: string | null;
  /** 좌측 레일: 텍스트 전용 셀에 표시할 라벨 */
  railFooterLabel?: string;
}>;

function iconButtonStyle(): React.CSSProperties {
  return {
    position: "relative",
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 9,
    width: 32,
    height: 32,
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

function FileTextGlyph({ size = 16 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function railTextCell(label: string, disabled: boolean): React.CSSProperties {
  return {
    ...platformRailNavTextCell,
    ...(disabled ? { opacity: 0.75, cursor: "not-allowed", pointerEvents: "none" as const } : {}),
    textDecoration: "none",
    color: "inherit",
  };
}

type UserBtnProps = Readonly<{ railFooterLabel?: string }>;

/** 사용자 메모 — `/work-notes` (채팅 멘션 `:메모`와 별개 UI 라벨은 레일에서「메모」) */
export function UserWorkNoteButton(p: UserBtnProps = {}) {
  const { railFooterLabel } = p;
  const label = railFooterLabel?.trim();
  if (label) {
    return (
      <Link
        href="/work-notes"
        prefetch={false}
        data-testid="work-note-open-user"
        aria-label="메모, 사용자 작업 메모 화면으로 이동"
        title="메모"
        style={railTextCell(label, false)}
      >
        <span style={platformRailNavPrimaryText}>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href="/work-notes"
      prefetch={false}
      data-testid="work-note-open-user"
      aria-label="메모, 사용자 작업 메모 화면으로 이동"
      title="메모"
      style={iconButtonStyle()}
    >
      <FileTextGlyph />
    </Link>
  );
}

/** 프로젝트 작업메모(프로젝트 레벨) — `/work-notes?projectId=...` */
export function ProjectWorkNoteButton(p: WorkNoteButtonProps) {
  const ctxPid = p.notesProjectId?.trim() ?? "";
  const label = p.railFooterLabel?.trim();
  if (label) {
    if (!ctxPid) {
      return (
        <span
          aria-label="프로젝트 작업메모 (프로젝트 선택 필요)"
          title="프로젝트를 선택한 뒤 프로젝트 메모를 이용하세요"
          style={railTextCell(label, true)}
        >
          <span style={{ ...platformRailNavPrimaryText, color: "#94a3b8" }}>{label}</span>
        </span>
      );
    }
    const href = `/work-notes?projectId=${encodeURIComponent(ctxPid)}`;
    return (
      <Link
        href={href}
        prefetch={false}
        data-testid="work-note-open-project"
        aria-label="문서 · 프로젝트 작업메모로 이동"
        title="프로젝트 작업메모 (문서)"
        style={railTextCell(label, false)}
      >
        <span style={platformRailNavPrimaryText}>{label}</span>
      </Link>
    );
  }
  if (!ctxPid) {
    return (
      <span
        aria-label="프로젝트 작업메모 (프로젝트 선택 필요)"
        title="프로젝트를 선택한 뒤 프로젝트 메모를 이용하세요"
        style={iconButtonStyleDisabled()}
      >
        <FileTextGlyph />
      </span>
    );
  }
  const href = `/work-notes?projectId=${encodeURIComponent(ctxPid)}`;
  return (
    <Link
      href={href}
      prefetch={false}
      data-testid="work-note-open-project"
      aria-label="문서 · 프로젝트 작업메모로 이동"
      title="프로젝트 작업메모 (문서)"
      style={iconButtonStyle()}
    >
      <FileTextGlyph />
    </Link>
  );
}
