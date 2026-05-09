"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { MessengerRailNavLinks } from "@/components/layout/MessengerRailNavLinks";
import { PlatformNotificationsBell } from "@/components/layout/PlatformNotificationsBell";
import { PlatformSettingsTrigger } from "@/components/layout/PlatformSettingsTrigger";
import { ProjectWorkNoteButton, UserWorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { WorkNotePendingChatNav } from "@/components/worknote/WorkNotePendingChatNav";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";

const CONTACTS_MEMBERS_PLACEHOLDER_MSG = "내 연락처에 있는 사용자 목록 보여지게 개발 예정 입니다.";

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
  /** 좌측 세로 레일에서 아이콘을 세로로 쌓을 때 */
  readonly layout?: "horizontal" | "vertical";
}>;

function ProjectMembersNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProjectListNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <circle cx="9" cy="10" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 플랫폼 헤더·사이드 레일: 프로필 · 알림 · 작업메모 · 연락처/멤버(준비 안내) · 로그아웃 · 설정 */
function profileHoverTitle(me: TopRightToolbarMe): string {
  const nick = me.displayName.trim() || "사용자";
  const mail = me.email.trim();
  if (mail) return `닉네임: ${nick}\n이메일: ${mail}`;
  return `닉네임: ${nick}`;
}

export function TopRightToolbar(p: TopRightToolbarProps) {
  const pathname = usePathname() || "/";
  const showMessengerRailNav = pathname === "/" || pathname.startsWith("/chat/");
  const gap = p.compact ? 6 : 8;
  const vertical = p.layout === "vertical";
  const stackGap = p.compact ? 8 : 10;

  const profileBlock =
    p.meReady && p.me ? (
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
          alignSelf: vertical ? "center" : undefined,
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
      <span style={{ fontSize: 12, color: "#94a3b8", textAlign: vertical ? "center" : undefined, alignSelf: vertical ? "center" : undefined }}>
        로그인 필요
      </span>
    ) : (
      <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: vertical ? "center" : undefined }}>…</span>
    );

  const notificationsBell = p.hasSession ? <PlatformNotificationsBell enabled /> : null;
  const promptTimelineBtn =
    p.hasSession && isPromptTimelineDebugClient() && p.workNotesProjectId?.trim() ? (
      <Link
        href={`/prompt-timeline?projectId=${encodeURIComponent(p.workNotesProjectId.trim())}`}
        prefetch={false}
        aria-label="프롬프트 타임라인"
        title="프롬프트 타임라인 (디버그)"
        style={{
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#fff",
          color: "#334155",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxSizing: "border-box",
          cursor: "pointer",
          outlineOffset: 2,
          textDecoration: "none",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      </Link>
    ) : null;
  const workNoteBtn = p.hasSession ? <UserWorkNoteButton /> : null;
  const projectWorkNoteBtn = p.hasSession ? (
    <>
      {p.workNotesProjectId?.trim() ? <WorkNotePendingChatNav projectId={p.workNotesProjectId} /> : null}
      <ProjectWorkNoteButton notesProjectId={p.workNotesProjectId} />
    </>
  ) : null;
  const projectListBtn = (
    <Link
      href="/?panel=chat"
      prefetch={false}
      data-testid="platform-project-list"
      aria-label="대화 목록으로 이동"
      title="대화 목록"
      style={{
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#334155",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxSizing: "border-box",
        cursor: "pointer",
        outlineOffset: 2,
        textDecoration: "none",
      }}
    >
      <ProjectListNavIcon />
    </Link>
  );
  const projectMembersPlaceholderBtn =
    p.hasSession && !showMessengerRailNav ? (
      <button
        type="button"
        data-testid="platform-project-members"
        aria-label={CONTACTS_MEMBERS_PLACEHOLDER_MSG}
        title="연락처 사용자 (준비 중)"
        onClick={() => {
          window.alert(CONTACTS_MEMBERS_PLACEHOLDER_MSG);
        }}
        style={{
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#fff",
          color: "#334155",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxSizing: "border-box",
          cursor: "pointer",
          outlineOffset: 2,
        }}
      >
        <ProjectMembersNavIcon />
      </button>
    ) : null;

  const logoutButton = p.hasSession ? (
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
  ) : null;

  const settingsTrigger = <PlatformSettingsTrigger />;

  if (vertical) {
    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: stackGap,
              flexShrink: 0,
            }}
          >
            {profileBlock}
            {projectListBtn}
            {showMessengerRailNav ? (
              <Suspense fallback={null}>
                <MessengerRailNavLinks />
              </Suspense>
            ) : null}
            {promptTimelineBtn}
            {notificationsBell}
            {workNoteBtn}
            {projectWorkNoteBtn}
            {projectMembersPlaceholderBtn}
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: stackGap,
              flexShrink: 0,
              paddingTop: stackGap,
            }}
          >
            {logoutButton}
            {settingsTrigger}
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
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
        {profileBlock}
      </div>

      {notificationsBell}
      {workNoteBtn}
      {projectMembersPlaceholderBtn}
      {logoutButton}
      {settingsTrigger}
    </div>
  );
}
