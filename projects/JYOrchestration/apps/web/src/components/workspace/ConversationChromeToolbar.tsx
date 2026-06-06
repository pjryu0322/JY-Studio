"use client";

import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

/** 프로젝트 SingleChat·메신저 대화방 공통 — 대화 초기화·마크다운 다운로드 */
export function ConversationChromeToolbar(p: {
  readonly onResetConversation: () => void | Promise<void>;
  readonly onDownloadConversationMarkdown: () => void | Promise<void>;
  readonly resetDisabled?: boolean;
  readonly downloadDisabled?: boolean;
}) {
  return (
    <>
      <WorkspaceHubChromeIconButton
        title="대화 내역 마크다운 다운로드"
        ariaLabel="대화 내역 마크다운 다운로드"
        disabled={Boolean(p.downloadDisabled)}
        onClick={() => p.onDownloadConversationMarkdown()}
      >
        <DownloadIcon />
      </WorkspaceHubChromeIconButton>
      <WorkspaceHubChromeIconButton
        title="대화 초기화 (전체 초기화 후 새로고침)"
        ariaLabel="대화 초기화 — 기획·구현 파생 데이터 전체 초기화 후 새로고침"
        disabled={Boolean(p.resetDisabled)}
        onClick={() => p.onResetConversation()}
      >
        <RefreshIcon />
      </WorkspaceHubChromeIconButton>
    </>
  );
}
