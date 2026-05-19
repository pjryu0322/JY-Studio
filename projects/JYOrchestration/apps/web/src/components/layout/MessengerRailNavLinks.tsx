"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { parseMessengerHomePanel, type MessengerHomePanel } from "@/components/messenger/messengerHomePanel";
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

export function MessengerRailNavLinks() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const current = parseMessengerHomePanel(searchParams.get("panel"));

  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  const projectsActive = pathOnly === "/workspace" || pathOnly.startsWith("/workspace/");
  const friendsActive = railLinkActive("friends", current, pathname);
  const logActive = pathOnly === "/prompt-timeline" || pathOnly.startsWith("/prompt-timeline/");
  const knowledgePacksActive = pathOnly === "/knowledge-packs" || pathOnly.startsWith("/knowledge-packs/");

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
