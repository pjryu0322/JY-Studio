"use client";

/**
 * 메신저형 채팅 3분할(고정 헤더 · 메시지 스크롤 · 고정 입력)용 빌딩 블록 별칭.
 * DOM은 전역 `.chat-page` > `.chat-header-fixed` / `.chat-body` > `.chat-messages-scroll` / `.chat-input-fixed`.
 */
export { WorkspaceShell as MessengerChatLayout } from "@/components/workspace/WorkspaceShell";
export { WorkspaceMessageList as ChatMessagesScrollArea } from "@/components/workspace/WorkspaceMessageList";
export { WorkspaceComposerFooter as ChatInputBar } from "@/components/workspace/WorkspaceComposerFooter";
