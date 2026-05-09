"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseMessengerHomePanel, type MessengerHomePanel } from "@/components/messenger/messengerHomePanel";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { platformRailIconLinkStyle } from "@/lib/layout/platformTopNavConstants";

function ChatBubbleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AiChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function railLinkActive(panel: MessengerHomePanel, current: MessengerHomePanel, pathname: string): boolean {
  if (!pathname || pathname === "/") return panel === current;
  return false;
}

type QuickCreateKind = "chat" | "aichat";

export function MessengerRailNavLinks() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const current = parseMessengerHomePanel(searchParams.get("panel"));
  const [quickBusy, setQuickBusy] = useState<QuickCreateKind | null>(null);
  const quickBusyRef = useRef(false);

  const createQuickRoom = useCallback(async (kind: QuickCreateKind) => {
    if (quickBusyRef.current) return;
    quickBusyRef.current = true;
    setQuickBusy(kind);
    try {
      const body =
        kind === "aichat"
          ? { roomType: "DIRECT", aiParticipationMode: "AUTO" }
          : { roomType: "DIRECT", aiParticipationMode: "MENTION_ONLY" };
      const res = await credentialsIncludeFetch("/api/chat-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; data?: { id?: string }; message?: string };
      if (!res.ok || !json.success || !json.data?.id) {
        window.alert(json.message || "대화방을 만들지 못했습니다.");
        return;
      }
      window.location.href = `/chat/${encodeURIComponent(json.data.id)}`;
    } catch {
      window.alert("네트워크 오류가 발생했습니다.");
    } finally {
      quickBusyRef.current = false;
      setQuickBusy(null);
    }
  }, []);

  const activeStyle = (active: boolean): CSSProperties =>
    active
      ? {
          ...platformRailIconLinkStyle,
          // `border` 단축만 쓰고 borderColor를 따로 두지 않음(리렌더 시 단축/개별 혼용 경고 방지)
          border: "1px solid #0d9488",
          background: "#ecfdf5",
          color: "#0f766e",
          boxShadow: "inset 0 0 0 1px rgba(13,148,136,0.25)",
        }
      : platformRailIconLinkStyle;

  const chatActive = railLinkActive("chat", current, pathname);
  const aiChatActive = railLinkActive("aichat", current, pathname);
  const friendsActive = railLinkActive("friends", current, pathname);

  const railBtn = (active: boolean, extra?: CSSProperties): CSSProperties => ({
    ...activeStyle(active),
    appearance: "none",
    WebkitAppearance: "none",
    font: "inherit",
    ...(extra ?? {}),
  });

  return (
    <>
      <button
        type="button"
        aria-label="Chat — AI기획자 멘션 시만 응답 방 만들기"
        title="Chat"
        disabled={Boolean(quickBusy)}
        onClick={() => void createQuickRoom("chat")}
        style={{
          ...railBtn(chatActive),
          opacity: quickBusy && quickBusy !== "chat" ? 0.55 : 1,
          cursor: quickBusy ? "wait" : "pointer",
        }}
      >
        <ChatBubbleIcon />
      </button>
      <button
        type="button"
        aria-label="AIChat — AI기획자와 대화하기 방 만들기"
        title="AIChat"
        disabled={Boolean(quickBusy)}
        onClick={() => void createQuickRoom("aichat")}
        style={{
          ...railBtn(aiChatActive),
          opacity: quickBusy && quickBusy !== "aichat" ? 0.55 : 1,
          cursor: quickBusy ? "wait" : "pointer",
        }}
      >
        <AiChatIcon />
      </button>
      <Link
        href="/?panel=friends"
        prefetch={false}
        aria-label="친구"
        title="친구"
        style={{
          ...activeStyle(friendsActive),
          flexDirection: "column",
          gap: 1,
          height: "auto",
          minHeight: 36,
          padding: "5px 2px 6px",
          lineHeight: 1,
        }}
      >
        <FriendsIcon />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "-0.02em" }}>친구</span>
      </Link>
    </>
  );
}
