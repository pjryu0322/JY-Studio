"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type AppendFromChatHandler = (plainText: string) => void;

export type WorkNoteChatSelectionBridgeValue = {
  readonly projectId: string;
  readonly registerWorkNoteAppendFromChat: (handler: AppendFromChatHandler | null) => void;
  /** 대화에서 선택한 텍스트를 작업메모에 붙이도록 요청(등록된 핸들러로 전달) */
  readonly requestAppendFromChat: (plainText: string) => void;
};

const WorkNoteChatSelectionBridgeContext = createContext<WorkNoteChatSelectionBridgeValue | null>(null);

export function WorkNoteChatSelectionBridgeProvider({
  projectId,
  children,
}: {
  readonly projectId: string;
  readonly children: ReactNode;
}) {
  const handlerRef = useRef<AppendFromChatHandler | null>(null);
  const registerWorkNoteAppendFromChat = useCallback((handler: AppendFromChatHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const requestAppendFromChat = useCallback((plainText: string) => {
    const t = plainText.trim();
    if (!t) return;
    const fn = handlerRef.current;
    if (fn) {
      fn(t);
      return;
    }
    window.alert("작업메모를 이 프로젝트에 연결할 수 없습니다. 상단 작업메모 버튼이 있는 화면인지 확인해 주세요.");
  }, []);

  const value = useMemo(
    (): WorkNoteChatSelectionBridgeValue => ({
      projectId: projectId.trim(),
      registerWorkNoteAppendFromChat,
      requestAppendFromChat,
    }),
    [projectId, registerWorkNoteAppendFromChat, requestAppendFromChat]
  );

  return <WorkNoteChatSelectionBridgeContext.Provider value={value}>{children}</WorkNoteChatSelectionBridgeContext.Provider>;
}

export function useWorkNoteChatSelectionBridge(): WorkNoteChatSelectionBridgeValue | null {
  return useContext(WorkNoteChatSelectionBridgeContext);
}

/** 기능 정리 등 — 브리지의 projectId와 일치할 때만 요청 함수를 노출 */
export function useWorkNoteChatSelectionRequester(localProjectId: string): ((text: string) => void) | undefined {
  const b = useWorkNoteChatSelectionBridge();
  const id = localProjectId.trim();
  if (!b || b.projectId !== id) return undefined;
  return b.requestAppendFromChat;
}
