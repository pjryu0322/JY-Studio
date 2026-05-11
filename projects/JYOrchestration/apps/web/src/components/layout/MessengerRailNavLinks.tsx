"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { parseMessengerHomePanel, type MessengerHomePanel } from "@/components/messenger/messengerHomePanel";
import { createMessengerChatRoom } from "@/lib/messenger/messengerChatRoomApi";
import { openMessengerChatRoomWindow } from "@/lib/messenger/openMessengerChatRoomWindow";
import { registerPlatformPopupFromOpenedUrl } from "@/lib/platform/platformPopupRegistry";
import {
  platformRailMessengerActiveShell,
  platformRailMessengerActiveText,
  platformRailNavPrimaryText,
  platformRailNavTextCell,
} from "@/lib/layout/platformTopNavConstants";

function railLinkActive(panel: MessengerHomePanel, current: MessengerHomePanel, pathname: string): boolean {
  if (!pathname || pathname === "/") return panel === current;
  return false;
}

type QuickCreateKind = "chat" | "aichat";

export function MessengerRailNavLinks() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { effectiveLayout } = useWorkspaceMode();
  const current = parseMessengerHomePanel(searchParams.get("panel"));
  const [quickBusy, setQuickBusy] = useState<QuickCreateKind | null>(null);
  const quickBusyRef = useRef(false);

  const createQuickRoom = useCallback(
    async (kind: QuickCreateKind) => {
      if (quickBusyRef.current) return;
      quickBusyRef.current = true;
      setQuickBusy(kind);
      try {
        const payload =
          kind === "aichat"
            ? ({ roomType: "DIRECT", aiParticipationMode: "AUTO" } as const)
            : ({ roomType: "DIRECT", aiParticipationMode: "MENTION_ONLY" } as const);
        const { id } = await createMessengerChatRoom(payload);
        const opened = openMessengerChatRoomWindow(id, { effectiveLayout, discardEmptyOnClose: true });
        if (!opened) {
          const url = `${window.location.origin}/chat/${encodeURIComponent(id)}?discardEmpty=1`;
          const w = window.open(url, "_blank", "noopener,noreferrer");
          registerPlatformPopupFromOpenedUrl(w, url);
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
      } finally {
        quickBusyRef.current = false;
        setQuickBusy(null);
      }
    },
    [effectiveLayout]
  );

  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  const projectsActive = pathOnly === "/workspace" || pathOnly.startsWith("/workspace/");
  const friendsActive = railLinkActive("friends", current, pathname);
  const logActive = pathOnly === "/prompt-timeline" || pathOnly.startsWith("/prompt-timeline/");
  const knowledgePacksActive = pathOnly === "/knowledge-packs" || pathOnly.startsWith("/knowledge-packs/");

  /** 빠른 생성 버튼은 내비 ‘선택’과 무관하게 배경을 쓰지 않음(선택 강조는 Chat·친구 등 링크만). */
  const actionCol = (extra?: CSSProperties): CSSProperties => ({
    ...platformRailNavTextCell,
    appearance: "none",
    WebkitAppearance: "none",
    font: "inherit",
    width: "100%",
    minWidth: 0,
    ...extra,
  });

  const navCol = (active: boolean, extra?: CSSProperties): CSSProperties => ({
    ...platformRailNavTextCell,
    ...(active ? platformRailMessengerActiveShell : {}),
    appearance: "none",
    WebkitAppearance: "none",
    font: "inherit",
    width: "100%",
    minWidth: 0,
    ...extra,
  });

  return (
    <>
      <button
        type="button"
        aria-label="새 일반 대화방 (1:N) — 새 창에서 열기"
        title="1:N · 새 일반 대화방"
        disabled={Boolean(quickBusy)}
        onClick={() => void createQuickRoom("chat")}
        style={{
          ...actionCol(),
          opacity: quickBusy && quickBusy !== "chat" ? 0.55 : 1,
          cursor: quickBusy ? "wait" : "pointer",
        }}
      >
        <span style={platformRailNavPrimaryText}>1:N</span>
      </button>
      <button
        type="button"
        aria-label="새 AI 대화방 (1:Agent) — 새 창에서 열기"
        title="1:Agent · 새 AI 채팅"
        disabled={Boolean(quickBusy)}
        onClick={() => void createQuickRoom("aichat")}
        style={{
          ...actionCol(),
          opacity: quickBusy && quickBusy !== "aichat" ? 0.55 : 1,
          cursor: quickBusy ? "wait" : "pointer",
        }}
      >
        <span style={platformRailNavPrimaryText}>1:Agent</span>
      </button>
      <Link
        href="/workspace"
        prefetch={false}
        data-testid="platform-workspace-rail"
        aria-label="프로젝트 목록으로 이동"
        title="프로젝트 목록"
        style={{
          ...navCol(projectsActive),
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <span style={projectsActive ? platformRailMessengerActiveText : platformRailNavPrimaryText}>프로젝트</span>
      </Link>
      <Link
        href="/knowledge-packs"
        prefetch={false}
        data-testid="platform-knowledge-packs-rail"
        aria-label="지식팩 · AI 개발 기준"
        title="지식팩 — Grid 등 AI개발자 참조 기준"
        style={{
          ...navCol(knowledgePacksActive),
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span style={knowledgePacksActive ? platformRailMessengerActiveText : platformRailNavPrimaryText}>지식팩</span>
      </Link>
      <Link
        href="/?panel=friends"
        prefetch={false}
        aria-label="친구 · 휴먼 멤버"
        title="친구"
        style={{
          ...navCol(friendsActive),
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <span style={friendsActive ? platformRailMessengerActiveText : platformRailNavPrimaryText}>친구</span>
      </Link>
      <Link
        href="/prompt-timeline"
        prefetch={false}
        aria-label="로그 · 프롬프트 타임라인"
        title="메신저 등 OpenAI 호출 기록"
        style={{
          ...navCol(logActive),
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <span style={logActive ? platformRailMessengerActiveText : platformRailNavPrimaryText}>로그</span>
      </Link>
    </>
  );
}
