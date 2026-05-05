"use client";

import Link from "next/link";
import { PlatformNotificationsBell } from "@/components/layout/PlatformNotificationsBell";
import { PlatformSettingsTrigger } from "@/components/layout/PlatformSettingsTrigger";
import { SettingsPanel } from "@/components/layout/SettingsPanel";
import { WorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { useWorkNoteComposerInsertHandler } from "@/components/worknote/WorkNoteComposerInsertContext";

export type TopRightToolbarMe = Readonly<{
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}>;

export type TopRightToolbarProps = Readonly<{
  readonly meReady: boolean;
  readonly me: TopRightToolbarMe | null;
  readonly avatarLoadFailed: boolean;
  readonly onAvatarError: () => void;
  readonly hasSession: boolean;
  readonly compact: boolean;
  readonly workNotesProjectId: string | null;
  readonly workNotesProjectName?: string | null;
  readonly onLogout: () => void | Promise<void>;
}>;

/** 플랫폼 상단 우측: 프로필 · 알림 · 작업메모 · 로그아웃 · 설정 */
function profileHoverTitle(me: TopRightToolbarMe): string {
  const nick = me.displayName.trim() || "사용자";
  const mail = me.email.trim();
  if (mail) return `닉네임: ${nick}\n이메일: ${mail}`;
  return `닉네임: ${nick}`;
}

export function TopRightToolbar(p: TopRightToolbarProps) {
  const insertMemoIntoComposer = useWorkNoteComposerInsertHandler();
  const gap = p.compact ? 6 : 8;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "nowrap",
        alignItems: "center",
        justifyContent: "flex-end",
        gap,
        flexShrink: 0,
        ...(p.compact ? { maxWidth: "100%" as const, minWidth: 0 } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          maxWidth: p.compact ? "100%" : "min(100%, 360px)",
        }}
      >
        {p.meReady && p.me ? (
          <Link
            href="/account"
            prefetch={false}
            data-testid="platform-top-menu-account"
            aria-label={`프로필 및 계정 설정으로 이동. ${profileHoverTitle(p.me).replace(/\n/g, " · ")}`}
            title={profileHoverTitle(p.me)}
            style={{
              display: "inline-flex",
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              borderRadius: 9999,
              outlineOffset: 2,
            }}
          >
            {p.me.avatarUrl && !p.avatarLoadFailed ? (
              <img
                src={p.me.avatarUrl}
                alt=""
                width={30}
                height={30}
                onError={p.onAvatarError}
                style={{ borderRadius: 9999, objectFit: "cover", border: "1px solid #e2e8f0", display: "block" }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9999,
                  border: "1px solid #e2e8f0",
                  background: "#e2e8f0",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                {(p.me.displayName.trim().charAt(0) || "?").toUpperCase()}
              </span>
            )}
          </Link>
        ) : p.meReady ? (
          <span style={{ fontSize: 13, color: "#94a3b8" }}>로그인 필요</span>
        ) : (
          <span style={{ fontSize: 13, color: "#94a3b8" }}>…</span>
        )}
      </div>

      {p.hasSession ? <PlatformNotificationsBell enabled /> : null}
      {p.hasSession ? (
        <WorkNoteButton
          notesProjectId={p.workNotesProjectId}
          projectDisplayName={p.workNotesProjectName ?? null}
          onShareToComposer={insertMemoIntoComposer}
        />
      ) : null}
      {p.hasSession ? (
        <button
          type="button"
          data-testid="platform-top-logout"
          aria-label="로그아웃"
          title="로그아웃"
          onClick={() => void p.onLogout()}
          style={{
            width: 36,
            height: 36,
            padding: 0,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer",
            color: "#334155",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      ) : null}
      <PlatformSettingsTrigger />
      <SettingsPanel />
    </div>
  );
}
